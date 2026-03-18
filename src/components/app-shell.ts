import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { uiStore, sessionStore, locationStore } from '../store/index.js';
import { p2pService } from '../services/p2p.service.js';
import { Router } from '@vaadin/router';

import './map-view.js';
import './ui/custom-dialog.js';

@customElement('app-shell')
export class AppShell extends LitElement {
    static createRenderRoot() { return this; }

    @state() private _toast: string | null = null;
    @state() private _loading = false;
    @state() private _dialog: { title: string; message: string; confirmLabel?: string; cancelLabel?: string } | null = null;

    private _router?: Router;
    private _unsubUI?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this._unsubUI = uiStore.subscribe(() => {
            this._toast = uiStore.toastMessage;
            this._loading = uiStore.isLoading;
            this._dialog = uiStore.dialogConfig;
        });
    }

    override async firstUpdated() {
        // 1. Initialize stores
        await Promise.all([
            uiStore.init(),
            sessionStore.init(),
            locationStore.init()
        ]);

        // Force early GPS permission request when the app has no known user location yet.
        if (!locationStore.own && !locationStore.isWatching) {
            locationStore.startWatching();
        }

        // 2. Setup Router
        const outlet = this.renderRoot.querySelector('#outlet');
        this._router = new Router(outlet);
        
        this._router.setRoutes([
            { path: '/', component: 'create-session', action: async () => { await import('./session/create-session.js'); } },
            { path: '/invite', component: 'invite-partner', action: async () => { await import('./session/invite-partner.js'); } },
            { path: '/join/:peerId', component: 'partner-invite-received', action: async () => { await import('./partner/partner-invite-received.js'); } },
            { path: '/rejected', component: 'partner-ended', action: async () => { await import('./partner/partner-ended.js'); } },
            { path: '/select-venue', component: 'select-rendezvous', action: async () => { await import('./rendezvous/select-rendezvous.js'); } },
            { path: '/coordinate', component: 'partner-agree-refuse', action: async () => { await import('./partner/partner-agree-refuse.js'); } },
            { path: '/tracking', component: 'live-tracking', action: async () => { await import('./tracking/live-tracking.js'); } },
            { path: '/chat', component: 'live-chat', action: async () => { await import('./tracking/live-chat-screen.js'); } },
            { path: '/session-link', component: 'session-link', action: async () => { await import('./session/session-link.js'); } },
            { path: '/ended', component: 'end-session', action: async () => { await import('./tracking/end-session.js'); } },
            { path: '(.*)', component: 'create-session' }
        ]);

        // 3. Handle reconnection logic
        const path = window.location.pathname;
        const session = sessionStore.session;
        
        if (session && session.status !== 'ended') {
            console.log('[AppShell] Resuming existing session:', session.id);
            try {
                if (sessionStore.isHost) {
                    await p2pService.init(session.id);
                } else if (!path.startsWith('/join/')) {
                    // If we are on home but have a session, maybe redirect to coordinate?
                    await p2pService.connect(session.id);
                } else {
                    // If we are on /join/ID, the component handles it, but we can ensure p2p is ready
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
    }

    override render() {
        return html`
      <map-view></map-view>
 
      <main id="outlet"></main>

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
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'app-shell': AppShell; }
}