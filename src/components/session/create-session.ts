/**
 * <create-session> — first screen.
 * Shows live GPS location. User can tap Edit on the live card
 * to reveal manual search and overwrite the current location.
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
    .sheet { animation: slide-up var(--duration-sheet) var(--ease-out) both; }

    .gps-card {
      position: relative;
      box-sizing: border-box;
      background: var(--color-info);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--border-radius-md);
      padding: var(--space-3);
      margin-bottom: var(--space-3);
      transition: background var(--duration-fast), border-color var(--duration-fast);
    }
    .gps-card.active {
      border-color: var(--color-blue);
      background: var(--color-blue-light);
    }
    .gps-row {
      display: flex; align-items: center; gap: var(--space-3);
      padding-right: 72px;
    }

    .edit-btn {
      position: absolute;
      top: 0.8em;
      right: 0.8em;
      border: 1px solid var(--color-border-strong);
      background: var(--color-surface);
      color: var(--color-blue-dark);
      border-radius: var(--border-radius-pill);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      padding: 0.25em 0.75em;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .edit-btn:hover { background: var(--color-blue-light); border-color: var(--color-blue); }
    .edit-btn:active { transform: scale(0.97); }

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

    .manual-editor {
      margin-top: var(--space-3);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-border);
      display: grid;
      gap: var(--space-2);
    }
    .manual-hint {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .error {
      font-size: var(--text-xs); color: var(--color-danger-text);
      text-align: center; margin-top: var(--space-2);
    }

    .name-input {
        box-sizing: border-box;
        width: 100%; padding: 12px;
      border: 1px solid var(--color-border); border-radius: var(--border-radius-md);
        font-family: var(--font-sans); font-size: var(--text-md);
        background: var(--color-sheet-bg);
    }
    .name-input:focus { outline: none; border-color: var(--color-blue); box-shadow: 0 0 0 2px var(--color-blue-light); }
    .name-input { margin-top: var(--space-4); }
  `  ];

  @state() private _gpsName = 'Detecting your location…';
  @state() private _gpsReady = false;
  @state() private _manualOverride = false;
  @state() private _showManualEditor = false;
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

    if (this._manualOverride) return;

    const now = Date.now();
    const distMoved = this._lastGeocodePos ? ( (Math.abs(own.lat - this._lastGeocodePos.lat) + Math.abs(own.lng - this._lastGeocodePos.lng)) * 111000 ) : Infinity;
    
    if (this._reverseInFlight) return;
    if (now - this._lastGeocodeTime < 15000 && distMoved < 80) return;

    try {
      this._reverseInFlight = true;
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
    const selected = e.detail;
    const coords = { lat: selected.lat, lng: selected.lng };

    this._manualOverride = true;
    this._showManualEditor = false;
    this._gpsName = selected.shortName;
    this._gpsReady = true;
    this._lastGeocodePos = coords;
    this._lastGeocodeTime = Date.now();

    if (locationStore.isWatching) locationStore.stopWatching();
    locationStore.setOwnLocation(coords);

    this.dispatchEvent(new CustomEvent('map-view:move-to', {
      bubbles: true, composed: true,
      detail: { coords, zoom: 15 },
    }));

    this._error = '';
  }

  private _toggleManualEditor() {
    this._showManualEditor = !this._showManualEditor;
  }

  private async _handleCreate() {
    const trimmedName = this._name.trim();
    const hasLocation = this._gpsReady;
    const canProceed = hasLocation && trimmedName.length >= 2;
    if (!canProceed) {
      this._error = !hasLocation
        ? 'We need your location to find a fair meetup spot.'
        : 'Add your name so your partner knows it is you.';
      return;
    }

    this._loading = true;
    uiStore.setLoading(true);
    this._error = '';

    try {
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
    const hasLocation = this._gpsReady;
    const canProceed = hasLocation && this._name.trim().length >= 2;
    const acc = locationStore.accuracy;

    return html`
      <screen-shell screen='create-session'>
      <div class="sheet">
        <div class="handle"></div>
        <div>
          <h2 class="title">Start a Rendezvous</h2>
          <p class="subtitle">We only use your location to find a fair place to meet.</p>
        </div>

        <div class="gps-card ${this._gpsReady ? 'active' : ''}">
          <div class="gps-row" aria-live="polite">
            <div class="gps-icon">📍</div>
            <div class="gps-text">
              <div class="gps-name">${this._gpsName}</div>
              <div class="gps-meta">
                ${this._manualOverride
                  ? 'Manual location selected'
                  : this._gpsReady
                    ? `GPS · ${acc ? `±${Math.round(acc)}m` : 'high accuracy'}`
                    : 'Waiting for GPS signal…'}
              </div>
            </div>
            ${this._gpsReady
              ? html`<span class="live-badge">${this._manualOverride ? 'MANUAL' : 'LIVE'}</span>`
              : html`<span class="pending-badge">…</span>`}
          </div>

          <button
            type="button"
            class="edit-btn"
            @click=${this._toggleManualEditor}
            aria-expanded=${this._showManualEditor ? 'true' : 'false'}
            aria-controls="manual-location-editor"
          >
            ${this._showManualEditor ? 'Done' : 'Edit'}
          </button>

          ${this._showManualEditor ? html`
            <div class="manual-editor" id="manual-location-editor">
              <div class="manual-hint">Search for a place if your live pin is off.</div>
              <location-input
                placeholder="Search a place or address"
                @location-selected=${this._onLocationSelected}
              ></location-input>
            </div>
          ` : ''}
        </div>

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