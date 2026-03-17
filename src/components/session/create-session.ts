/**
 * <create-session> — first screen.
 * Shows live GPS location. Lets the user override with a manual
 * address via <location-input> (real Nominatim autocomplete).
 * On confirm, calls sessionService.createSession() which hits
 * the API and navigates to invite-partner.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { locationStore, uiStore, sessionStore } from '../../store/index.js';
import { reverseGeocode } from '../../services/geocoding.service.js';
import { p2pService } from '../../services/p2p.service.js';
import '../../components/ui/location-input.js';
import '../../components/ui/screen-shell.js';
import type { GeocodeSuggestion } from '../../services/geocoding.service.js';

@customElement('create-session')
export class CreateSession extends LitElement {
  static override styles = css`
    :host { display: block; }

    .sheet {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-8));
      z-index: var(--z-sheet);
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle {
      width: 36px; height: 4px; background: rgba(0,0,0,0.12);
      border-radius: var(--border-radius-pill); margin: 0 auto var(--space-4);
    }

    .title    { font-size: var(--text-xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); }
    .subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-4); }

    .gps-row {
      display: flex; align-items: center; gap: var(--space-3);
      background: rgba(77,114,152,0.07);
      border: 1px solid rgba(77,114,152,0.15);
      border-radius: var(--border-radius-md);
      padding: var(--space-3);
      margin-bottom: var(--space-3);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .gps-row:hover { background: rgba(77,114,152,0.12); }
    .gps-row.active {
      border-color: var(--color-blue);
      background: var(--color-blue-light);
    }

    .gps-icon {
      width: 36px; height: 36px; border-radius: var(--border-radius-sm);
      background: var(--color-blue-light);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 16px;
    }

    .gps-text { flex: 1; min-width: 0; }
    .gps-name {
      font-size: var(--text-md); font-weight: var(--weight-medium);
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .gps-meta { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px; }

    .live-badge {
      font-size: 10px; font-weight: var(--weight-bold);
      background: var(--color-green); color: var(--color-green-text);
      padding: 2px 8px; border-radius: var(--border-radius-pill); flex-shrink: 0;
    }
    .pending-badge {
      font-size: 10px; color: var(--color-text-muted); flex-shrink: 0;
    }

    .or-row {
      display: flex; align-items: center; gap: var(--space-3);
      margin: var(--space-1) 0 var(--space-3);
      font-size: var(--text-xs); color: var(--color-text-muted);
    }
    .or-row::before, .or-row::after {
      content: ''; flex: 1; height: 0.5px; background: rgba(0,0,0,0.1);
    }

    .selected-manual {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: rgba(208,239,177,0.4);
      border: 1px solid rgba(208,239,177,0.9);
      border-radius: var(--border-radius-md);
      margin-top: var(--space-2);
      font-size: var(--text-sm);
    }
    .selected-manual button {
      margin-left: auto; background: none; border: none;
      font-size: 14px; cursor: pointer; color: var(--color-text-muted); padding: 0;
    }

    .btn {
      display: block; width: 100%; padding: 13px var(--space-4);
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer;
      text-align: center; line-height: 1;
      transition: all var(--duration-fast) var(--ease-out);
      -webkit-tap-highlight-color: transparent;
      margin-top: var(--space-3);
    }
    .btn:active { transform: scale(0.98); opacity: 0.9; }

    .btn-primary {
      background: var(--color-blue); color: #fff;
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
    }
    .btn-primary:hover { background: var(--color-blue-mid); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

    .error {
      font-size: var(--text-xs); color: var(--color-danger-text);
      text-align: center; margin-top: var(--space-2);
    }

    .name-input {
        width: 100%; padding: 12px; margin-top: var(--space-4);
        border: 1px solid rgba(0,0,0,0.1); border-radius: var(--border-radius-md);
        font-family: var(--font-sans); font-size: var(--text-md);
        background: var(--color-sheet-bg);
    }
    .name-input:focus { outline: none; border-color: var(--color-blue); box-shadow: 0 0 0 2px rgba(77,114,152,0.1); }
  `;

  @state() private _gpsName = 'Detecting your location…';
  @state() private _gpsReady = false;
  @state() private _usingGps = true;
  @state() private _manualSelection: GeocodeSuggestion | null = null;
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _name = '';

  private _unsub?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    locationStore.startWatching();
    this._unsub = locationStore.subscribe(() => this._onLocationUpdate());
    this._onLocationUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  private async _onLocationUpdate() {
    const own = locationStore.own;
    if (!own) return;

    this._gpsReady = true;

    this.dispatchEvent(new CustomEvent('map-view:move-to', {
      bubbles: true, composed: true,
      detail: { coords: own, zoom: 15 },
    }));

    // Reverse geocode for a human-readable name
    try {
      this._gpsName = await reverseGeocode(own.lat, own.lng);
    } catch {
      this._gpsName = `${own.lat.toFixed(4)}, ${own.lng.toFixed(4)}`;
    }
  }

  private _onLocationSelected(e: CustomEvent<GeocodeSuggestion>) {
    this._manualSelection = e.detail;
    this._usingGps = false;
    this.dispatchEvent(new CustomEvent('map-view:move-to', {
      bubbles: true, composed: true,
      detail: { coords: { lat: e.detail.lat, lng: e.detail.lng }, zoom: 15 },
    }));
  }

  private _useGps() {
    this._usingGps = true;
    this._manualSelection = null;
  }

  private async _handleCreate() {
    const canProceed = (this._usingGps ? this._gpsReady : !!this._manualSelection) && this._name.trim().length >= 2;
    if (!canProceed) {
      this._error = 'We need your location to find a fair meetup spot.';
      return;
    }

    this._loading = true;
    uiStore.setLoading(true);
    this._error = '';

    try {
      if (!this._usingGps && this._manualSelection) {
        locationStore.own = { lat: this._manualSelection.lat, lng: this._manualSelection.lng };
      }

      sessionStore.setOwnName(this._name);
      
      const peerId = await p2pService.init();
      await sessionStore.createSession(peerId);

      uiStore.goToInvite();
    } catch (err: any) {
      console.error('[CreateSession] Error:', err);
      this._error = err?.message ?? 'Something went wrong. Please try again.';
    } finally {
      this._loading = false;
      uiStore.setLoading(false);
    }
  }

  override render() {
    const canProceed = this._usingGps ? this._gpsReady : !!this._manualSelection;
    const acc = locationStore.accuracy;

    return html`
      <screen-shell screen='create-session'>
      <div class="sheet">
        <div class="handle"></div>
        <div class="title">Start a Rendezvous</div>
        <div class="subtitle">Your location helps us find a fair spot for both of you</div>

        <div class="gps-row ${this._usingGps && this._gpsReady ? 'active' : ''}" @click=${this._useGps}>
          <div class="gps-icon">📍</div>
          <div class="gps-text">
            <div class="gps-name">${this._gpsName}</div>
            <div class="gps-meta">
              ${this._gpsReady
        ? `GPS · ${acc ? `±${Math.round(acc)}m` : 'high accuracy'}`
        : 'Waiting for GPS signal…'}
            </div>
          </div>
          ${this._gpsReady
        ? html`<span class="live-badge">LIVE</span>`
        : html`<span class="pending-badge">…</span>`}
        </div>

        <div class="or-row">or enter address manually</div>

        <location-input
          country="NG"
          placeholder="e.g. Nicon Town, Lekki Phase 1"
          @location-selected=${this._onLocationSelected}
        ></location-input>

        <input
          type="text"
          class="name-input"
          placeholder="Your Name (Required)"
          .value=${this._name}
          @input=${(e: any) => { this._name = e.target.value; this._error = ''; }}
          required
          minlength="2"
        />

        ${this._manualSelection && !this._usingGps ? html`
          <div class="selected-manual">
            <span>📍</span>
            <span>${this._manualSelection.shortName}</span>
            <button @click=${this._useGps} title="Clear">✕</button>
          </div>
        ` : ''}

        <button
          class="btn btn-primary"
          ?disabled=${this._loading || !canProceed}
          @click=${this._handleCreate}
        >
          ${this._loading
        ? html`<span>Creating…</span>`
        : html`<span>Create Session</span><span>→</span>`}
        </button>

        ${this._error ? html`<div class="error">${this._error}</div>` : ''}
      </div>
      </screen-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'create-session': CreateSession; }
}