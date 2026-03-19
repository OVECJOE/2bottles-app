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
import { sharedStyles } from '../../styles/shared-styles.js';
import '../../components/ui/location-input.js';
import '../../components/ui/screen-shell.js';
import type { GeocodeSuggestion } from '../../services/geocoding.service.js';
import type { Coordinates } from '../../types/index.js';

@customElement('create-session')
export class CreateSession extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host { display: block; }

    /* Local overrides */
    .sheet { animation: slide-up var(--duration-sheet) var(--ease-out) both; }

    .gps-row {
      display: flex; align-items: center; gap: var(--space-3);
      width: 100%;
      background: rgba(77,114,152,0.07);
      border: 1px solid rgba(77,114,152,0.15);
      border-radius: var(--border-radius-md);
      padding: var(--space-3);
      margin-bottom: var(--space-3);
      cursor: pointer;
      font: inherit;
      text-align: left;
      transition: background var(--duration-fast);
    }
    button.gps-row { appearance: none; }
    .gps-row:hover { background: rgba(77,114,152,0.12); }
    .gps-row:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }
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

    .error {
      font-size: var(--text-xs); color: var(--color-danger-text);
      text-align: center; margin-top: var(--space-2);
    }

    .name-input {
        box-sizing: border-box;
        width: 100%; padding: 12px;
        border: 1px solid rgba(0,0,0,0.1); border-radius: var(--border-radius-md);
        font-family: var(--font-sans); font-size: var(--text-md);
        background: var(--color-sheet-bg);
    }
    .name-input:focus { outline: none; border-color: var(--color-blue); box-shadow: 0 0 0 2px rgba(77,114,152,0.1); }
    .name-input { margin-top: var(--space-4); }
  `  ];

  @state() private _gpsName = 'Detecting your location…';
  @state() private _gpsReady = false;
  @state() private _usingGps = true;
  @state() private _manualSelection: GeocodeSuggestion | null = null;
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _name = '';
 
  private _unsub?: () => void;
  private _lastGeocodeTime = 0;
  private _lastGeocodePos: Coordinates | null = null;
  private _reverseInFlight = false;

  override connectedCallback() {
    super.connectedCallback();
    void this._startWatchingIfGranted();
    this._unsub = locationStore.subscribe(() => this._onLocationUpdate());
    this._onLocationUpdate();
  }

  private async _startWatchingIfGranted() {
    if (!navigator.geolocation || !window.isSecureContext) return;
    try {
      if (!navigator.permissions?.query) return;
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state === 'granted') {
        locationStore.startWatching();
      }
    } catch {
      // Ignore permission API failures; manual location entry still works.
    }
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
    // Bug 205: Debounce to prevent 429 Rate Limit
    const now = Date.now();
    const distMoved = this._lastGeocodePos ? ( (Math.abs(own.lat - this._lastGeocodePos.lat) + Math.abs(own.lng - this._lastGeocodePos.lng)) * 111000 ) : Infinity;
    
    if (this._reverseInFlight) return;
    if (now - this._lastGeocodeTime < 15000 && distMoved < 80) return;

    try {
      this._reverseInFlight = true;
      // Stamp now so frequent GPS updates don't queue concurrent reverse requests.
      this._lastGeocodeTime = now;
      this._gpsName = await reverseGeocode(own.lat, own.lng);
      this._lastGeocodePos = { ...own };
    } catch {
      this._gpsName = `${own.lat.toFixed(4)}, ${own.lng.toFixed(4)}`;
      this._lastGeocodePos = { ...own };
      this._lastGeocodeTime = Date.now();
    } finally {
      this._reverseInFlight = false;
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
    const trimmedName = this._name.trim();
    const hasLocation = this._usingGps ? this._gpsReady : !!this._manualSelection;
    const canProceed = hasLocation && trimmedName.length >= 2;
    if (!canProceed) {
      this._error = !hasLocation
        ? 'We need your location to find a fair meetup spot.'
        : 'Please enter a name with at least 2 characters.';
      return;
    }

    this._loading = true;
    uiStore.setLoading(true);
    this._error = '';

    try {
      if (!this._usingGps && this._manualSelection) {
        locationStore.setOwnLocation({ lat: this._manualSelection.lat, lng: this._manualSelection.lng });
      }

      sessionStore.setOwnName(trimmedName);

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
    const hasLocation = this._usingGps ? this._gpsReady : !!this._manualSelection;
    const canProceed = hasLocation && this._name.trim().length >= 2;
    const acc = locationStore.accuracy;

    return html`
      <screen-shell screen='create-session'>
      <div class="sheet">
        <div class="handle"></div>
        <div class="title">Start a Rendezvous</div>
        <div class="subtitle">Your location helps us find a fair spot for both of you</div>

        <button
          type="button"
          class="gps-row ${this._usingGps && this._gpsReady ? 'active' : ''}"
          @click=${this._useGps}
          aria-pressed=${this._usingGps ? 'true' : 'false'}
          aria-label="Use current GPS location"
        >
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
        </button>

        <div class="or-row">or enter address manually</div>

        <location-input
          placeholder="e.g. Nicon Town, Lekki Phase 1"
          @location-selected=${this._onLocationSelected}
        ></location-input>

        <input
          type="text"
          class="input-base name-input"
          placeholder="Your Name (Required)"
          .value=${this._name}
          @input=${(e: InputEvent) => {
            this._name = (e.target as HTMLInputElement).value;
            this._error = '';
          }}
          required
          minlength="2"
          maxlength="48"
        />

        ${this._manualSelection && !this._usingGps ? html`
          <div class="selected-manual">
            <span>📍</span>
            <span>${this._manualSelection.shortName}</span>
            <button type="button" @click=${this._useGps} title="Clear" aria-label="Clear manual location">✕</button>
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