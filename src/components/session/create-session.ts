/**
 * <create-session> — first screen.
 * Detects GPS, lets user optionally enter a location manually,
 * then calls the API to create a session.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { locationStore } from '../../store/index.js';
import { uiStore } from '../../store/index.js';
import { sessionStore } from '../../store/index.js';

@customElement('create-session')
export class CreateSession extends LitElement {
    static override styles = css`
    :host { display: block; }

    .status-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: var(--map-status-bar-height);
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-5);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      color: rgba(30,30,30,0.7);
      z-index: var(--z-topbar);
    }

    .sheet {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) env(safe-area-inset-bottom, var(--space-8));
      z-index: var(--z-sheet);
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle {
      width: 36px; height: 4px;
      background: rgba(0,0,0,0.12);
      border-radius: var(--border-radius-pill);
      margin: 0 auto var(--space-4);
    }

    .title {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      color: var(--color-text-primary);
      margin-bottom: var(--space-1);
    }

    .subtitle {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin-bottom: var(--space-4);
    }

    .location-row {
      display: flex; align-items: center; gap: var(--space-3);
      background: rgba(77,114,152,0.07);
      border: 1px solid rgba(77,114,152,0.15);
      border-radius: var(--border-radius-md);
      padding: var(--space-3) var(--space-3);
      margin-bottom: var(--space-3);
    }

    .location-icon {
      width: 36px; height: 36px;
      border-radius: var(--border-radius-sm);
      background: var(--color-blue-light);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      font-size: 16px;
    }

    .location-text { flex: 1; min-width: 0; }

    .location-name {
      font-size: var(--text-md);
      font-weight: var(--weight-medium);
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .location-meta { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px; }

    .live-badge {
      font-size: 10px; font-weight: var(--weight-bold);
      background: var(--color-green); color: var(--color-green-text);
      padding: 2px 8px; border-radius: var(--border-radius-pill);
      flex-shrink: 0;
    }

    .or-divider {
      display: flex; align-items: center; gap: var(--space-3);
      margin: var(--space-2) 0;
      color: var(--color-text-muted); font-size: var(--text-xs);
    }
    .or-divider::before, .or-divider::after {
      content: ''; flex: 1; height: 0.5px; background: rgba(0,0,0,0.1);
    }

    .manual-input {
      width: 100%;
      box-sizing: border-box;
      padding: var(--space-3) var(--space-3);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--border-radius-md);
      font-family: var(--font-sans);
      font-size: var(--text-md);
      color: var(--color-text-primary);
      background: rgba(0,0,0,0.03);
      outline: none;
      transition: border-color var(--duration-fast);
      margin-bottom: var(--space-3);
    }
    .manual-input:focus { border-color: var(--color-blue); }
    .manual-input::placeholder { color: var(--color-text-muted); }

    .btn-primary {
      width: 100%; padding: 14px;
      background: var(--color-blue); color: #fff;
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer;
      transition: background var(--duration-fast), transform var(--duration-fast);
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
    }
    .btn-primary:hover { background: var(--color-blue-mid); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .error {
      font-size: var(--text-xs); color: var(--color-danger-text);
      text-align: center; margin-top: var(--space-2);
    }
  `;

    @state() private _locationName = 'Detecting location…';
    @state() private _locationReady = false;
    @state() private _loading = false;
    @state() private _error = '';
    @state() private _manualAddress = '';

    private _unsub?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        locationStore.startWatching();
        this._unsub = locationStore.subscribe(() => this._onLocationUpdate());
        this._onLocationUpdate();

        if (locationStore.own) {
            this.dispatchEvent(new CustomEvent('map-view:move-to', {
                bubbles: true, composed: true,
                detail: { coords: locationStore.own, zoom: 15 },
            }));
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsub?.();
    }

    private _onLocationUpdate() {
        if (locationStore.own) {
            this._locationReady = true;
            const acc = locationStore.accuracy;
            this._locationName = acc && acc < 50 ? 'Your location' : 'Approximate location';
            this.dispatchEvent(new CustomEvent('map-view:move-to', {
                bubbles: true, composed: true,
                detail: { coords: locationStore.own, zoom: 15 },
            }));
        }
    }

    private async _handleCreate() {
        if (!locationStore.own && !this._manualAddress) {
            this._error = 'We need your location to find a fair meetup spot.';
            return;
        }

        this._loading = true;
        uiStore.setLoading(true);
        this._error = '';

        try {
            const id = crypto.randomUUID().slice(0, 6).toUpperCase();
            sessionStore.createSession(id);
            uiStore.goToInvite();
        } catch {
            this._error = 'Something went wrong. Please try again.';
        } finally {
            this._loading = false;
            uiStore.setLoading(false);
        }
    }

    override render() {
        return html`
      <div class="status-bar">
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>●●●</span>
      </div>

      <div class="sheet">
        <div class="handle"></div>
        <div class="title">Start a Rendezvous</div>
        <div class="subtitle">Share your location to find a fair spot for both of you</div>

        <div class="location-row">
          <div class="location-icon">📍</div>
          <div class="location-text">
            <div class="location-name">${this._locationName}</div>
            <div class="location-meta">
              ${locationStore.accuracy ? `±${Math.round(locationStore.accuracy)}m accuracy` : 'Waiting for GPS…'}
            </div>
          </div>
          ${this._locationReady ? html`<span class="live-badge">LIVE</span>` : ''}
        </div>

        <div class="or-divider">or enter address manually</div>

        <input
          class="manual-input"
          type="text"
          placeholder="e.g. 42 Admiralty Way, Lekki"
          .value=${this._manualAddress}
          @input=${(e: InputEvent) => { this._manualAddress = (e.target as HTMLInputElement).value; }}
        />

        <button
          class="btn-primary"
          ?disabled=${this._loading || (!this._locationReady && !this._manualAddress)}
          @click=${this._handleCreate}
        >
          ${this._loading ? html`<span>Creating…</span>` : html`<span>Create Session</span><span>→</span>`}
        </button>

        ${this._error ? html`<div class="error">${this._error}</div>` : ''}
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'create-session': CreateSession; }
}