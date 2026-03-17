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
import { fetchVenues, getDistance } from '../../services/geocoding.service.js';
import './venue-card.js';
import '../ui/location-input.js';
import type { Venue } from '../../types/index.js';
import type { GeocodeSuggestion } from '../../services/geocoding.service.js';
import '../ui/screen-shell.js';


@customElement('select-rendezvous')
export class SelectRendezvous extends LitElement {
    static override styles = css`
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

    .sheet {
      position: absolute; bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-8));
      z-index: var(--z-sheet);
      max-height: 68vh;
      display: flex; flex-direction: column;
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-4); flex-shrink: 0; }

    .sheet-header { flex-shrink: 0; margin-bottom: var(--space-3); }
    .title    { font-size: var(--text-xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); }
    .subtitle { font-size: var(--text-sm); color: var(--color-text-muted); }

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

    .btn-primary {
      width: 100%; padding: 14px; margin-top: var(--space-3);
      background: var(--color-blue); color: #fff;
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer; flex-shrink: 0;
      transition: background var(--duration-fast), transform var(--duration-fast);
    }
    .btn-primary:hover { background: var(--color-blue-mid); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  `;

    @state() private _tab: 'midpoint' | 'custom' = 'midpoint';
    @state() private _selectedId: string | null = null;
    @state() private _venues: Venue[] = [];
    @state() private _customSpot: GeocodeSuggestion | null = null;
    @state() private _isComputing = false;

    private _unsub?: () => void;
    private _unsubSession?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this._computeVenues();
        this._frameMap();

        this._unsub = locationStore.subscribe(() => {
            // Only re-fetch if we have no venues yet and both coords are now available
            if (!this._venues.length && !this._isComputing && locationStore.own && locationStore.partner) {
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
        // Remove venue preview pin — destination pin will be set properly by locationStore
        this.dispatchEvent(new CustomEvent('map-view:remove-pin', {
            bubbles: true, composed: true, detail: { id: 'venue-preview' },
        }));
        this.dispatchEvent(new CustomEvent('map-view:clear-midpoint', { bubbles: true, composed: true }));
    }

    private async _computeVenues() {
        const own = locationStore.own;
        const partner = locationStore.partner;
        if (!own || !partner || this._isComputing) return;

        const mid = sessionStore.midpoint;
        if (!mid) return;

        this._isComputing = true;
        uiStore.setLoading(true);
        const rawVenues = await fetchVenues(mid.lat, mid.lng);
        
        // Calculate distances and rank by fairness
        const venues = rawVenues.map(v => {
            const dYou = getDistance(own.lat, own.lng, v.coordinates.lat, v.coordinates.lng);
            const dPart = getDistance(partner.lat, partner.lng, v.coordinates.lat, v.coordinates.lng);
            return {
                ...v,
                distanceKm: parseFloat(dYou.toFixed(1)),
                etaMinutesFromYou: Math.round(dYou * 15), // Rough estimate: 4km/h walking or traffic
                etaMinutesFromPartner: Math.round(dPart * 15),
            };
        });

        // Fairness: prefer spots where travel difference is < 2x
        venues.sort((a, b) => {
            const getFairness = (v: Venue) => {
                const max = Math.max(v.etaMinutesFromYou, v.etaMinutesFromPartner);
                const min = Math.max(1, Math.min(v.etaMinutesFromYou, v.etaMinutesFromPartner));
                return max / min;
            };
            return getFairness(a) - getFairness(b);
        });

        this._venues = venues.slice(0, 5); // top 5 fair spots
        sessionStore.setVenueSuggestions(this._venues);

        this.dispatchEvent(new CustomEvent('map-view:show-midpoint', {
            bubbles: true, composed: true,
            detail: { coords: mid },
        }));
        
        uiStore.setLoading(false);
        this._isComputing = false;
    }

    private _frameMap() {
        const own = locationStore.own;
        const partner = locationStore.partner;
        if (own && partner) {
            setTimeout(() => {
                (document.querySelector('map-view') as any)?.fitBounds?.(own, partner, 80);
            }, 300);
        }
    }

    private _selectVenue(venue: Venue) {
        this._selectedId = venue.id;

        // Remove any previous venue preview pin
        this.dispatchEvent(new CustomEvent('map-view:remove-pin', {
            bubbles: true, composed: true, detail: { id: 'venue-preview' },
        }));

        // Place a preview pin at the venue coordinate
        this.dispatchEvent(new CustomEvent('map-view:add-pin', {
            bubbles: true, composed: true,
            detail: { id: 'venue-preview', coords: venue.coordinates, color: '#c0392b', label: venue.name },
        }));

        // Fit bounds to show you + partner + the venue
        const own = locationStore.own;
        const partner = locationStore.partner;
        if (own && partner) {
            setTimeout(() => {
                const mapView = document.querySelector('map-view') as any;
                mapView?.fitBounds?.(own, partner, 80, venue.coordinates);
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
          <span class="pill-label">Midpoint calculated</span>
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
            ${this._venues.length === 0 ? html`
              <div style="text-align:center; padding:var(--space-6); color:var(--color-text-muted)">
                <div style="font-size:32px; margin-bottom:var(--space-2)">☕?</div>
                <div>No spots found near the midpoint. Try searching for a specific place.</div>
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
              country="NG"
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
                <button class="custom-clear" @click=${() => { this._customSpot = null; }}>✕</button>
              </div>
            ` : ''}
          </div>
        `}

        ${sessionStore.isHost ? html`
            <button class="btn-primary" ?disabled=${!this._canProceed} @click=${this._suggest}>
                Suggest This Spot →
            </button>
        ` : html`
            <div style="text-align:center; padding:var(--space-4); color:var(--color-text-muted); font-size:var(--text-sm)">
                Waiting for ${sessionStore.partnerName || 'host'} to pick a spot...
            </div>
        `}

        <button class="btn-ghost" @click=${this._cancel} style="width:100%; margin-top:var(--space-3)">
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
            sessionStore.endSession();
            uiStore.goHome();
        }
    }
}

declare global {
    interface HTMLElementTagNameMap { 'select-rendezvous': SelectRendezvous; }
}