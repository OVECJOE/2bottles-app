// =============================================================
// 2bottles — <app-shell>
//
// Root component. Three jobs only:
//   1. Mount the persistent <map-view> (never unmounts)
//   2. Lazily swap screen components on top as AppScreen changes
//   3. Surface global overlays: toast + loading spinner
//
// No shadow DOM — global.css owns all styles.
// Stores are singletons; imported directly, no context needed.
// =============================================================

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';

import { uiStore } from '../store/index.js';
import type { AppScreen } from '../types/index.js';

import './map-view.js';

// Screen tag map — AppScreen value → registered custom element name
const SCREEN_TAGS: Record<AppScreen, string> = {
    'create-session': 'create-session',
    'invite-partner': 'invite-partner',
    'partner-notified': 'partner-invite-received',
    'partner-rejected': 'partner-ended',
    'select-rendezvous': 'select-rendezvous',
    'partner-agree-refuse': 'partner-agree-refuse',
    'session-link': 'session-link',
    'live-tracking': 'live-tracking',
    'end-session': 'end-session',
};

// Lazy-load screen bundles only when first needed
async function loadScreen(screen: AppScreen): Promise<void> {
    switch (screen) {
        case 'create-session': await import('./session/create-session.js'); break;
        case 'invite-partner': await import('./session/invite-partner.js'); break;
        case 'partner-notified': await import('./partner/partner-invite-received.js'); break;
        case 'partner-rejected': await import('./partner/partner-ended.js'); break;
        case 'select-rendezvous': await import('./rendezvous/select-rendezvous.js'); break;
        case 'partner-agree-refuse': await import('./partner/partner-agree-refuse.js'); break;
        case 'session-link': await import('./session/session-link.js'); break;
        case 'live-tracking': await import('./tracking/live-tracking.js'); break;
        case 'end-session': await import('./tracking/end-session.js'); break;
    }
}

@customElement('app-shell')
export class AppShell extends LitElement {
    static createRenderRoot() { return this; }

    @state() private _screen: AppScreen = uiStore.screen;
    @state() private _screenReady = false;
    @state() private _toast: string | null = null;
    @state() private _loading = false;

    // Cached screen element — reused across re-renders if tag unchanged
    private _screenEl: HTMLElement | null = null;
    private _unsubUI?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this._unsubUI = uiStore.subscribe(() => {
            const next = uiStore.screen;
            if (next !== this._screen) this._transition(next);
            this._toast = uiStore.toastMessage;
            this._loading = uiStore.isLoading;
        });
        this._transition(uiStore.screen);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubUI?.();
    }

    private async _transition(screen: AppScreen) {
        this._screenReady = false;
        await loadScreen(screen);
        this._screen = screen;
        this._screenReady = true;
    }

    private _currentScreenEl(): HTMLElement {
        const tag = SCREEN_TAGS[this._screen];
        if (!this._screenEl || this._screenEl.tagName.toLowerCase() !== tag) {
            this._screenEl = document.createElement(tag);
        }
        return this._screenEl;
    }

    override render() {
        return html`
      <map-view></map-view>

      ${this._screenReady ? this._currentScreenEl() : nothing}

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