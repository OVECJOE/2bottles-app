import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { uiStore, sessionStore } from '../store/index.js';
import { p2pService } from '../services/p2p.service.js';
import { Router } from '@vaadin/router';

import './map-view.js';

@customElement('app-shell')
export class AppShell extends LitElement {
    static createRenderRoot() { return this; }

    @state() private _toast: string | null = null;
    @state() private _loading = false;

    private _router?: Router;
    private _unsubUI?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this._unsubUI = uiStore.subscribe(() => {
            this._toast = uiStore.toastMessage;
            this._loading = uiStore.isLoading;
        });
    }

    override async firstUpdated() {
        // 1. Initialize stores
        await Promise.all([
            uiStore.init(),
            sessionStore.init()
        ]);

        // 2. Setup Router
        const outlet = this.renderRoot.querySelector('#outlet');
        this._router = new Router(outlet);
        
        this._router.setRoutes([
            { path: '/', component: 'create-session', action: async () => { await import('./session/create-session.js'); } },
            { path: '/invite', component: 'invite-partner', action: async () => { await import('./session/invite-partner.js'); } },
            { path: '/join/:peerId', component: 'partner-invite-received', action: async () => { await import('./partner/partner-invite-received.js'); } },
            { path: '/select-venue', component: 'select-rendezvous', action: async () => { await import('./rendezvous/select-rendezvous.js'); } },
            { path: '/coordinate', component: 'partner-agree-refuse', action: async () => { await import('./partner/partner-agree-refuse.js'); } },
            { path: '/tracking', component: 'live-tracking', action: async () => { await import('./tracking/live-tracking.js'); } },
            { path: '/chat', component: 'live-chat', action: async () => { await import('./tracking/live-chat-screen.js'); } },
            { path: '/session-link', component: 'session-link', action: async () => { await import('./session/session-link.js'); } },
            { path: '/ended', component: 'end-session', action: async () => { await import('./tracking/end-session.js'); } },
            { path: '(.*)', component: 'create-session' }
        ]);

        // 3. Handle reconnection logic (if not on a join route)
        const path = window.location.pathname;
        if (!path.startsWith('/join/') && sessionStore.session && sessionStore.session.status !== 'ended') {
            console.log('[AppShell] Resuming existing session:', sessionStore.session.id);
            try {
                if (sessionStore.isHost) {
                    await p2pService.init(sessionStore.session.id);
                } else if (sessionStore.session.id) {
                    await p2pService.connect(sessionStore.session.id);
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
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'app-shell': AppShell; }
}