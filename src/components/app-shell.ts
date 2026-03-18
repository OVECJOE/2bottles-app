import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { uiStore, sessionStore, locationStore, authStore } from '../store/index.js';
import { p2pService } from '../services/p2p.service.js';
import { Router } from '@vaadin/router';
import { billingEnabled, usersApi } from '../api/users.api.js';

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
            authStore.init(),
            uiStore.init(),
            sessionStore.init(),
            locationStore.init()
        ]);

        await this._handleBillingReturn();

        // 2. Setup Router
        const outlet = this.renderRoot.querySelector('#outlet');
        this._router = new Router(outlet);
        
        this._router.setRoutes([
            { path: '/', component: 'create-session', action: async () => { await import('./session/create-session.js'); } },
            { path: '/account', component: 'account-screen', action: async () => { await import('./account/account-screen.js'); } },
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

    private async _handleBillingReturn() {
        const url = new URL(window.location.href);
        const billing = url.searchParams.get('billing');
        if (!billing) return;

        if (!billingEnabled) {
            url.searchParams.delete('billing');
            const nextNoBilling = `${url.pathname}${url.search}${url.hash}`;
            window.history.replaceState({}, '', nextNoBilling || '/');
            return;
        }

        if (billing === 'success') {
            uiStore.setLoading(true);
            try {
                const entitlements = await usersApi.getEntitlements();
                if (entitlements.membership === 'paid') {
                    uiStore.showToast('Payment successful. Paid membership is now active.');
                } else {
                    uiStore.showToast('Payment received. Activating membership, please refresh in a moment.');
                }
            } catch {
                uiStore.showToast('Payment received. We are confirming your membership.');
            } finally {
                uiStore.setLoading(false);
            }
        } else if (billing === 'cancel') {
            uiStore.showToast('Checkout cancelled. You can try again anytime.');
        }

        url.searchParams.delete('billing');
        const next = `${url.pathname}${url.search}${url.hash}`;
        window.history.replaceState({}, '', next || '/');
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