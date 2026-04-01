/**
 * <app-shell> — top-level application container.
 *
 * Responsibilities:
 *   route setup and lazy screen loading
 *   global overlays (toasts, loading, dialogs)
 *   app install prompt wiring and location permission takeover
 */
import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { uiStore, sessionStore, locationStore } from '../store/index.js';
import { p2pService } from '../services/p2p.service.js';
import { Router } from '@vaadin/router';

import './map-view.js';
import './ui/custom-dialog.js';
import './ui/location-permission-toast.js';

type LocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unknown';
type LandingActionDetail = { action: 'start' | 'install'; byUserClick?: boolean };

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@customElement('app-shell')
export class AppShell extends LitElement {
    static createRenderRoot() { return this; }

    @state() private _toast: string | null = null;
    @state() private _loading = false;
    @state() private _dialog: { title: string; message: string; confirmLabel?: string; cancelLabel?: string } | null = null;
    @state() private _canInstall = false;
    @state() private _locationTakeoverOpen = false;
    @state() private _locationPermissionState: LocationPermissionState = 'unknown';
    @state() private _locationTakeoverDismissed = false;

    private _router?: Router;
    private _unsubUI?: () => void;
    private _unsubLocation?: () => void;
    private _deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
    private _permissionStatus?: PermissionStatus;

    private _hasActiveSession(): boolean {
        return sessionStore.isSessionActive;
    }

    private _isHostFlow(): boolean {
        return this._hasActiveSession() && sessionStore.isHost;
    }

    override connectedCallback() {
        super.connectedCallback();
        this._unsubUI = uiStore.subscribe(() => {
            this._toast = uiStore.toastMessage;
            this._loading = uiStore.isLoading;
            this._dialog = uiStore.dialogConfig;
        });
        this._unsubLocation = locationStore.subscribe(() => {
            if (locationStore.own) {
                this._locationTakeoverOpen = false;
            }
            this.requestUpdate();
        });
    }

    override async firstUpdated() {
        await Promise.all([
            uiStore.init(),
            sessionStore.init(),
            locationStore.init()
        ]);

        this._setupInstallPromptHandlers();
        await this._syncLocationPermissionState();

        const outlet = this.renderRoot.querySelector('#outlet');
        this._router = new Router(outlet);
        
        this._router.setRoutes([
            { path: '/', component: 'landing-page', action: async () => { await import('./marketing/landing-page.ts'); } },
            { path: '/create-session', component: 'create-session', action: async () => { await import('./session/create-session.js'); } },
            {
                path: '/invite',
                component: 'invite-partner',
                action: async () => {
                    if (!this._isHostFlow()) {
                        uiStore.showToast('Start a new session before opening invite.');
                        Router.go('/create-session');
                        return;
                    }
                    await import('./session/invite-partner.js');
                }
            },
            { path: '/join/:peerId', component: 'partner-invite-received', action: async () => { await import('./partner/partner-invite-received.js'); } },
            { path: '/rejected', component: 'partner-ended', action: async () => { await import('./partner/partner-ended.js'); } },
            {
                path: '/select-venue',
                component: 'select-rendezvous',
                action: async () => {
                    if (!this._hasActiveSession()) {
                        uiStore.showToast('Create or join a session first.');
                        Router.go('/create-session');
                        return;
                    }
                    await import('./rendezvous/select-rendezvous.js');
                }
            },
            {
                path: '/coordinate',
                component: 'partner-agree-refuse',
                action: async () => {
                    if (!this._hasActiveSession()) {
                        uiStore.showToast('Create or join a session first.');
                        Router.go('/create-session');
                        return;
                    }
                    if (!sessionStore.selectedVenue) {
                        uiStore.showToast('Pick a meetup spot before coordination.');
                        Router.go('/select-venue');
                        return;
                    }
                    await import('./partner/partner-agree-refuse.js');
                }
            },
            {
                path: '/tracking',
                component: 'live-tracking',
                action: async () => {
                    if (!this._hasActiveSession()) {
                        uiStore.showToast('Create or join a session before tracking.');
                        Router.go('/create-session');
                        return;
                    }
                    if (!sessionStore.selectedVenue) {
                        uiStore.showToast('Pick a meetup spot before tracking starts.');
                        Router.go('/select-venue');
                        return;
                    }
                    await import('./tracking/live-tracking.js');
                }
            },
            {
                path: '/chat',
                component: 'live-chat',
                action: async () => {
                    if (!this._hasActiveSession()) {
                        uiStore.showToast('Create or join a session before opening chat.');
                        Router.go('/create-session');
                        return;
                    }
                    await import('./tracking/live-chat-screen.js');
                }
            },
            {
                path: '/session-link',
                component: 'session-link',
                action: async () => {
                    if (!this._hasActiveSession()) {
                        uiStore.showToast('Create or join a session first.');
                        Router.go('/create-session');
                        return;
                    }
                    await import('./session/session-link.js');
                }
            },
            {
                path: '/ended',
                component: 'end-session',
                action: async () => {
                    if (!sessionStore.session && !sessionStore.selectedVenue) {
                        uiStore.showToast('No session summary is available yet.');
                        Router.go('/create-session');
                        return;
                    }
                    await import('./tracking/end-session.js');
                }
            },
            {
                path: '/save-spot',
                component: 'save-spot-page',
                action: async () => {
                    if (!sessionStore.selectedVenue) {
                        uiStore.showToast('Finish a meetup before saving a spot.');
                        Router.go('/ended');
                        return;
                    }
                    await import('./spot/save-spot-page.js');
                }
            },
            {
                path: '(.*)',
                action: () => {
                    Router.go('/create-session');
                }
            }
        ]);

        const path = window.location.pathname;
        const session = sessionStore.session;
        
        if (session && session.status !== 'ended') {
            console.log('[AppShell] Resuming existing session:', session.id);
            try {
                if (sessionStore.isHost) {
                    await p2pService.init(session.id);
                } else if (!path.startsWith('/join/')) {
                    await p2pService.connect(session.id);
                } else {
                    await p2pService.init(); 
                }
            } catch (err) {
                console.warn('[AppShell] Re-connect failed:', err);
            }
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubUI?.();
        this._unsubLocation?.();
        this._permissionStatus?.removeEventListener('change', this._onPermissionChange);
        window.removeEventListener('beforeinstallprompt', this._onBeforeInstallPrompt as EventListener);
        window.removeEventListener('appinstalled', this._onAppInstalled);
    }

    private _setupInstallPromptHandlers() {
        window.addEventListener('beforeinstallprompt', this._onBeforeInstallPrompt as EventListener);
        window.addEventListener('appinstalled', this._onAppInstalled);
    }

    private _onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
        event.preventDefault();
        this._deferredInstallPrompt = event;
        this._canInstall = true;
    };

    private _onAppInstalled = () => {
        this._deferredInstallPrompt = null;
        this._canInstall = false;
        uiStore.showToast('2bottles installed successfully.');
    };

    private _onPermissionChange = async () => {
        await this._syncLocationPermissionState();
    };

    private async _syncLocationPermissionState() {
        if (!navigator.geolocation || !window.isSecureContext) {
            this._locationPermissionState = 'unknown';
            this._locationTakeoverOpen = false;
            return;
        }

        try {
            if (!navigator.permissions?.query) {
                this._locationPermissionState = 'prompt';
            } else {
                this._permissionStatus?.removeEventListener('change', this._onPermissionChange);
                const status = await navigator.permissions.query({ name: 'geolocation' });
                this._permissionStatus = status;
                this._permissionStatus.addEventListener('change', this._onPermissionChange);
                this._locationPermissionState = (status.state as LocationPermissionState) || 'unknown';
            }
        } catch {
            this._locationPermissionState = 'prompt';
        }

        if (this._locationPermissionState === 'granted') {
            this._locationTakeoverOpen = false;
            if (!locationStore.isWatching) {
                locationStore.startWatching();
            }
            return;
        }

        const shouldPrompt = !locationStore.own && !locationStore.isWatching && !this._locationTakeoverDismissed;
        this._locationTakeoverOpen = shouldPrompt;
    }

    private _handleLandingAction = async (event: CustomEvent<LandingActionDetail>) => {
        if (!event.detail.byUserClick) return;

        if (event.detail.action === 'install') {
            await this._requestInstall();
            return;
        }

        Router.go('/create-session');
        if (!locationStore.own && this._locationPermissionState !== 'granted') {
            this._locationTakeoverOpen = true;
        }
    };

    private async _requestInstall() {
        if (!this._deferredInstallPrompt) {
            uiStore.showToast('Install option is unavailable on this browser right now.');
            return;
        }

        await this._deferredInstallPrompt.prompt();
        const choice = await this._deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            this._canInstall = false;
            this._deferredInstallPrompt = null;
        }
    }

    private async _requestLocationPermission() {
        uiStore.setLoading(true);
        try {
            await locationStore.fetchOnce();
            this._locationPermissionState = 'granted';
            locationStore.startWatching();
            this._locationTakeoverOpen = false;
            this._locationTakeoverDismissed = true;
        } catch {
            await this._syncLocationPermissionState();
            if (this._locationPermissionState === 'denied') {
                uiStore.showToast('Location permission blocked. You can continue with manual location search.');
            }
        } finally {
            uiStore.setLoading(false);
        }
    }

    private _continueWithManualSearch() {
        this._locationTakeoverDismissed = true;
        this._locationTakeoverOpen = false;
        uiStore.showToast('You can use manual address search for now.');
    }

    private get _showLocationPermissionToast(): boolean {
        if (this._locationPermissionState === 'granted') return false;
        if (locationStore.isWatching) return false;
        if (locationStore.own) return false;
        return this._locationTakeoverOpen;
    }

    override render() {
        return html`
      <map-view></map-view>
 
    <main id="outlet" @landing-action=${this._handleLandingAction}></main>

      ${this._toast ? html`
        <div class="app-toast" role="status" aria-live="polite">${this._toast}</div>
      ` : nothing}

      ${this._loading ? html`
        <div class="app-loading" aria-hidden="true">
          <div class="app-loading__spinner"></div>
        </div>
      ` : nothing}

      <custom-dialog
        ?open=${!!this._dialog}
        .title=${this._dialog?.title || ''}
        .message=${this._dialog?.message || ''}
        .confirmLabel=${this._dialog?.confirmLabel || 'Confirm'}
        .cancelLabel=${this._dialog?.cancelLabel || 'Cancel'}
        @dialog-result=${(e: CustomEvent) => uiStore.handleDialogResult(e.detail.confirmed)}
      ></custom-dialog>

            ${this._showLocationPermissionToast ? html`
                <location-permission-toast
                    .permissionState=${this._locationPermissionState}
                    .canInstall=${this._canInstall}
                    @request-location=${() => this._requestLocationPermission()}
                    @continue-manual=${() => this._continueWithManualSearch()}
                    @request-install=${() => this._requestInstall()}
                ></location-permission-toast>
            ` : nothing}
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'app-shell': AppShell; }
}