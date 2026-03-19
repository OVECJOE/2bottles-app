/**
 * <select-rendezvous> — venue selection screen.
 *
 * Two modes:
 *   1. Midpoint suggestions — auto-calculated from both coords.
 *   2. Custom search — <location-input> lets either party search
 *      for a specific place they already have in mind.
 *
 * Uses <venue-card> for each suggestion row.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import { suggestMeetupVenues } from '../../services/geocoding.service.js';
import { sharedStyles } from '../../styles/shared-styles.js';
import './venue-card.js';
import '../ui/location-input.js';
import type { Venue } from '../../types/index.js';
import type { GeocodeSuggestion } from '../../services/geocoding.service.js';
import '../ui/screen-shell.js';


@customElement('select-rendezvous')
export class SelectRendezvous extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host { display: block; }

    .top-pill {
      position: absolute;
      top: var(--map-status-bar-height); left: var(--space-4); right: var(--space-4);
      z-index: var(--z-topbar);
    }
    .pill-inner {
      background: rgba(255,255,255,0.96); border-radius: var(--border-radius-md);
      padding: var(--space-2) var(--space-3);
      display: flex; align-items: center; gap: var(--space-2);
      box-shadow: var(--shadow-md); font-size: var(--text-sm);
    }
    .pill-label { flex: 1; font-weight: var(--weight-medium); color: var(--color-text-primary); }
    .pill-badge {
      font-size: 10px; font-weight: var(--weight-bold);
      background: var(--color-green); color: var(--color-green-text);
      padding: 2px 8px; border-radius: var(--border-radius-pill);
    }

    .sheet { max-height: 68vh; }
    .tabs {
      display: flex; gap: var(--space-2);
      margin-bottom: var(--space-3); flex-shrink: 0;
    }
    .tab {
      flex: 1; padding: var(--space-2) var(--space-3);
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0,0,0,0.1);
      background: transparent; font-family: var(--font-sans);
      font-size: var(--text-sm); font-weight: var(--weight-medium);
      color: var(--color-text-muted); cursor: pointer;
      transition: all var(--duration-fast);
    }
    .tab.active {
      background: var(--color-blue); color: #fff; border-color: var(--color-blue);
    }

    .venues { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3);
      text-align: center;
      padding: var(--space-6);
      color: var(--color-text-muted);
    }

    .loading-spinner {
      width: 22px;
      height: 22px;
      border: 2px solid rgba(0, 0, 0, 0.12);
      border-top-color: var(--color-blue);
      border-radius: 50%;
      animation: spin 700ms linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .search-section { flex-shrink: 0; }

    .custom-selected {
      display: flex; align-items: flex-start; gap: var(--space-3);
      padding: var(--space-3); margin-top: var(--space-3);
      background: rgba(208,239,177,0.35);
      border: 1px solid rgba(208,239,177,0.8);
      border-radius: var(--border-radius-md);
    }
    .custom-icon {
      width: 40px; height: 40px; border-radius: var(--border-radius-sm);
      background: var(--color-green); display: flex; align-items: center;
      justify-content: center; font-size: 18px; flex-shrink: 0;
    }
    .custom-name { font-size: var(--text-md); font-weight: var(--weight-medium); }
    .custom-addr { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
    .custom-clear {
      margin-left: auto; background: none; border: none;
      font-size: 14px; cursor: pointer; color: var(--color-text-muted); padding: 0; flex-shrink: 0;
    }
  `];

  @state() private _tab: 'midpoint' | 'custom' = 'midpoint';
  @state() private _selectedId: string | null = null;
  @state() private _venues: Venue[] = [];
  @state() private _customSpot: GeocodeSuggestion | null = null;
  @state() private _isComputing = false;
  @state() private _suggestionError = '';

  private _unsub?: () => void;
  private _unsubSession?: () => void;
  private _nextSuggestAt = 0;
  private _lastSuggestKey = '';
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;
  private _frameTimer: ReturnType<typeof setTimeout> | null = null;
  private _fitTimer: ReturnType<typeof setTimeout> | null = null;

  private _participantShiftMeters(a: string, b: string): number {
    if (!a || !b) return Infinity;
    const [aOwn, aPartner] = a.split('|');
    const [bOwn, bPartner] = b.split('|');
    if (!aOwn || !aPartner || !bOwn || !bPartner) return Infinity;

    const [aOwnLat, aOwnLng] = aOwn.split('_').map(Number);
    const [aPartnerLat, aPartnerLng] = aPartner.split('_').map(Number);
    const [bOwnLat, bOwnLng] = bOwn.split('_').map(Number);
    const [bPartnerLat, bPartnerLng] = bPartner.split('_').map(Number);

    if ([aOwnLat, aOwnLng, aPartnerLat, aPartnerLng, bOwnLat, bOwnLng, bPartnerLat, bPartnerLng].some((n) => Number.isNaN(n))) {
      return Infinity;
    }

    const distance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const dLat = (lat1 - lat2) * 111_320;
      const dLng = (lng1 - lng2) * 111_320 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
      return Math.sqrt(dLat * dLat + dLng * dLng);
    };

    return Math.max(
      distance(aOwnLat, aOwnLng, bOwnLat, bOwnLng),
      distance(aPartnerLat, aPartnerLng, bPartnerLat, bPartnerLng),
    );
  }

    override connectedCallback() {
        super.connectedCallback();
        if (!locationStore.own && !locationStore.isWatching) {
          locationStore.startWatching();
        }
        this._computeVenues();
        this._frameMap();

    this._unsub = locationStore.subscribe(() => {
      if (!this._isComputing && locationStore.own && locationStore.partner && !this._venues.length) {
        this._computeVenues();
      }
    });

    this._unsubSession = sessionStore.subscribe(() => {
      this.requestUpdate();
    });

    if (!sessionStore.isHost) {
      uiStore.showToast(`Waiting for ${sessionStore.partnerName || 'host'} to pick a spot...`);
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._unsubSession?.();
    if (this._retryTimer) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
    if (this._frameTimer) {
      clearTimeout(this._frameTimer);
      this._frameTimer = null;
    }
    if (this._fitTimer) {
      clearTimeout(this._fitTimer);
      this._fitTimer = null;
    }
    if (!sessionStore.selectedVenue) {
      locationStore.clearDestination();
    }
    this.dispatchEvent(new CustomEvent('map-view:clear-midpoint', { bubbles: true, composed: true }));
  }

  private async _computeVenues() {
    const own = locationStore.own;
    const partner = locationStore.partner;
    if (!own || !partner || this._isComputing) return;

    const mid = sessionStore.midpoint;
    const suggestKey = `${own.lat.toFixed(4)}_${own.lng.toFixed(4)}|${partner.lat.toFixed(4)}_${partner.lng.toFixed(4)}`;
    const shiftedMeters = this._participantShiftMeters(this._lastSuggestKey, suggestKey);
    const hasMaterialShift = shiftedMeters > 120;

    const now = Date.now();
    if (!hasMaterialShift && now < this._nextSuggestAt) return;

    if (!hasMaterialShift && this._venues.length > 0 && this._lastSuggestKey === suggestKey) return;

    this._isComputing = true;
    this._suggestionError = '';
    this._lastSuggestKey = suggestKey;
    uiStore.setLoading(true);
    try {
      this._venues = await suggestMeetupVenues({
        own,
        partner,
        maxResults: 10,
      });
      this._nextSuggestAt = Date.now() + (hasMaterialShift ? 8_000 : 30_000);
      sessionStore.setVenueSuggestions(this._venues);

      if (mid) {
        this.dispatchEvent(new CustomEvent('map-view:show-midpoint', {
          bubbles: true, composed: true,
          detail: { coords: mid },
        }));
      }
    } catch (err) {
      this._venues = [];
      this._suggestionError = 'Could not load meetup suggestions. Retrying...';
      uiStore.showToast(this._suggestionError);
      this._nextSuggestAt = Date.now() + 45_000;
      if (this._retryTimer) clearTimeout(this._retryTimer);
      this._retryTimer = setTimeout(() => {
        this._retryTimer = null;
        this._computeVenues();
      }, 45_000);
    } finally {
      uiStore.setLoading(false);
      this._isComputing = false;
    }
  }

  private _frameMap() {
    const own = locationStore.own;
    const partner = locationStore.partner;
    if (own && partner) {
      if (this._frameTimer) clearTimeout(this._frameTimer);
      this._frameTimer = setTimeout(() => {
        (document.querySelector('map-view') as any)?.fitBounds?.(own, partner, 80);
        this._frameTimer = null;
      }, 300);
    }
  }

  private _selectVenue(venue: Venue) {
    this._selectedId = venue.id;
    locationStore.setDestination(venue.coordinates);

    // Fit bounds to show you + partner + the venue
    const own = locationStore.own;
    const partner = locationStore.partner;
    if (own && partner) {
      if (this._fitTimer) clearTimeout(this._fitTimer);
      this._fitTimer = setTimeout(() => {
        const mapView = document.querySelector('map-view') as any;
        mapView?.fitBounds?.(own, partner, 80, venue.coordinates);
        this._fitTimer = null;
      }, 100);
    } else {
      this.dispatchEvent(new CustomEvent('map-view:move-to', {
        bubbles: true, composed: true,
        detail: { coords: venue.coordinates, zoom: 14 },
      }));
    }
  }

  private _onCustomLocation(e: CustomEvent<GeocodeSuggestion>) {
    this._customSpot = e.detail;
    this.dispatchEvent(new CustomEvent('map-view:move-to', {
      bubbles: true, composed: true,
      detail: { coords: { lat: e.detail.lat, lng: e.detail.lng }, zoom: 15 },
    }));
  }

  private _suggest() {
    if (!sessionStore.isHost) return;

    let venue: Venue | undefined;
    if (this._tab === 'custom' && this._customSpot) {
      venue = {
        id: 'custom',
        name: this._customSpot.shortName,
        category: 'place',
        emoji: '📍',
        address: this._customSpot.displayName.split(', ').slice(1, 3).join(', '),
        coordinates: { lat: this._customSpot.lat, lng: this._customSpot.lng },
        distanceKm: 0,
        etaMinutesFromYou: 0,
        etaMinutesFromPartner: 0,
      };
    } else {
      venue = this._venues.find(v => v.id === this._selectedId);
    }

    if (!venue) return;

    sessionStore.selectVenue(venue);
    locationStore.setDestination(venue.coordinates);

    // Broadcast to partner
    p2pService.broadcastVenue(venue);

    uiStore.goToAgreeRefuse();
  }

  private get _canProceed() {
    return this._tab === 'midpoint' ? !!this._selectedId : !!this._customSpot;
  }

  override render() {
    return html`
      <screen-shell screen='select-rendezvous'>
      <div class="top-pill">
        <div class="pill-inner">
          <span>⊙</span>
          <span class="pill-label">Fair area prepared</span>
          <span class="pill-badge">${this._venues.length} spots nearby</span>
        </div>
      </div>

      <div class="sheet">
        <div class="handle"></div>

        <div class="sheet-header">
          <div class="title">Pick a Spot</div>
          <div class="subtitle">Where should you two meet?</div>
        </div>

        <div class="tabs">
          <button class="tab ${this._tab === 'midpoint' ? 'active' : ''}" @click=${() => { this._tab = 'midpoint'; }}>
            ⊙ Fairness suggestions
          </button>
          <button class="tab ${this._tab === 'custom' ? 'active' : ''}" @click=${() => { this._tab = 'custom'; }}>
            🔍 Search a place
          </button>
        </div>

        ${this._tab === 'midpoint' ? html`
          <div class="venues">
            ${this._isComputing && this._venues.length === 0 ? html`
              <div class="loading-state" aria-live="polite">
                <div class="loading-spinner"></div>
                <div>Finding fair meetup spots...</div>
              </div>
            ` : this._venues.length === 0 ? html`
              <div style="text-align:center; padding:var(--space-6); color:var(--color-text-muted)">
                <div style="font-size:32px; margin-bottom:var(--space-2)">☕?</div>
                <div>${this._suggestionError || 'No spots found near the midpoint. Try searching for a specific place.'}</div>
              </div>
            ` : this._venues.map(v => html`
              <venue-card
                .emoji=${v.emoji}
                .name=${v.name}
                .address=${v.address}
                .distanceKm=${v.distanceKm}
                .etaMinutes=${v.etaMinutesFromYou}
                ?selected=${this._selectedId === v.id}
                @venue-select=${() => this._selectVenue(v)}
              ></venue-card>
            `)}
          </div>
        ` : html`
          <div class="search-section">
            <location-input
              placeholder="Search for any place…"
              @location-selected=${this._onCustomLocation}
            ></location-input>

            ${this._customSpot ? html`
              <div class="custom-selected">
                <div class="custom-icon">📍</div>
                <div>
                  <div class="custom-name">${this._customSpot.shortName}</div>
                  <div class="custom-addr">${this._customSpot.displayName.split(', ').slice(1, 4).join(', ')}</div>
                </div>
                <button type="button" class="custom-clear" @click=${() => { this._customSpot = null; }} aria-label="Clear selected location">✕</button>
              </div>
            ` : ''}
          </div>
        `}

        ${sessionStore.isHost ? html`
            <button class="btn btn-primary" ?disabled=${!this._canProceed} @click=${this._suggest}>
                Suggest This Spot →
            </button>
        ` : html`
            <div style="text-align:center; padding:var(--space-4); color:var(--color-text-muted); font-size:var(--text-sm)">
                Waiting for ${sessionStore.partnerName || 'host'} to pick a spot...
            </div>
        `}

        <button type="button" class="btn btn-ghost" @click=${this._cancel}>
            Cancel Session
          </button>
      </div>
    
      </screen-shell>
    `;
  }

  private async _cancel() {
    const confirmed = await uiStore.confirm({
      title: 'Cancel Session?',
      message: 'This will end the current rendezvous and stop location sharing.',
      confirmLabel: 'Yes, Cancel',
      cancelLabel: 'Keep Session'
    });

    if (confirmed) {
      p2pService.endSessionForAll();
      sessionStore.endSession();
      uiStore.goHome();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'select-rendezvous': SelectRendezvous; }
}