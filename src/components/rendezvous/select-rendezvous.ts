/**
 * <select-rendezvous> — shows midpoint venue suggestions.
 * Fires map-view:show-midpoint and map-view:fitBounds to frame
 * both users + the midpoint in the map camera.
 *
 * In production, venues come from a PostGIS midpoint query.
 * Here we derive mock suggestions from the two coordinates.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import type { Venue } from '../../types/index.js';

const CATEGORY_EMOJI: Record<string, string> = {
    cafe: '☕', restaurant: '🍽', bar: '🍻', cinema: '🎬',
    park: '🌳', mall: '🛍', gym: '💪',
};

function mockVenues(midLat: number, midLng: number): Venue[] {
    return [
        { id: 'v1', name: 'Nook Café', category: 'cafe', emoji: '☕', address: 'Admiralty Way, Lekki', coordinates: { lat: midLat, lng: midLng }, distanceKm: 1.2, etaMinutesFromYou: 8, etaMinutesFromPartner: 9 },
        { id: 'v2', name: 'Craft Kitchen', category: 'restaurant', emoji: '🍽', address: 'Ozumba Mbadiwe, VI', coordinates: { lat: midLat + 0.004, lng: midLng + 0.003 }, distanceKm: 1.5, etaMinutesFromYou: 9, etaMinutesFromPartner: 10 },
        { id: 'v3', name: 'Silverbird Cinema', category: 'cinema', emoji: '🎬', address: 'Ahmadu Bello Way, VI', coordinates: { lat: midLat - 0.004, lng: midLng - 0.003 }, distanceKm: 2.1, etaMinutesFromYou: 11, etaMinutesFromPartner: 12 },
    ];
}

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
      background: rgba(255,255,255,0.96);
      border-radius: var(--border-radius-md);
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
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) env(safe-area-inset-bottom, var(--space-8));
      z-index: var(--z-sheet);
      max-height: 60vh;
      display: flex; flex-direction: column;
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-4); flex-shrink: 0; }

    .header { margin-bottom: var(--space-3); flex-shrink: 0; }
    .title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); }
    .subtitle { font-size: var(--text-sm); color: var(--color-text-muted); }

    .venues { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: var(--space-2); }

    .venue {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3); border-radius: var(--border-radius-md);
      border: 1.5px solid transparent;
      cursor: pointer;
      transition: background var(--duration-fast), border-color var(--duration-fast);
      background: rgba(0,0,0,0.035);
    }
    .venue:hover { background: rgba(0,0,0,0.06); }
    .venue.selected {
      background: var(--color-blue-light);
      border-color: var(--color-blue);
    }

    .venue-icon {
      width: 42px; height: 42px; border-radius: var(--border-radius-sm);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
      background: rgba(255,255,255,0.8);
    }
    .venue.selected .venue-icon { background: rgba(77,114,152,0.1); }

    .venue-info { flex: 1; min-width: 0; }
    .venue-name { font-size: var(--text-md); font-weight: var(--weight-medium); color: var(--color-text-primary); }
    .venue-meta { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }

    .venue-eta {
      text-align: right; flex-shrink: 0;
    }
    .eta-val { font-size: var(--text-md); font-weight: var(--weight-bold); color: var(--color-text-primary); }
    .eta-label { font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }

    .venue.selected .eta-val { color: var(--color-blue-dark); }

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

    @state() private _selectedId: string | null = null;
    @state() private _venues: Venue[] = [];

    override connectedCallback() {
        super.connectedCallback();
        this._computeVenues();
        this._frameMap();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.dispatchEvent(new CustomEvent('map-view:clear-midpoint', { bubbles: true, composed: true }));
    }

    private _computeVenues() {
        const own = locationStore.own;
        const partner = locationStore.partner;

        if (own && partner) {
            const midLat = (own.lat + partner.lat) / 2;
            const midLng = (own.lng + partner.lng) / 2;
            const venues = mockVenues(midLat, midLng);
            this._venues = venues;
            sessionStore.setVenueSuggestions(venues);

            this.dispatchEvent(new CustomEvent('map-view:show-midpoint', {
                bubbles: true, composed: true,
                detail: { coords: { lat: midLat, lng: midLng } },
            }));
        } else {
            this._venues = mockVenues(6.435, 3.435);
            sessionStore.setVenueSuggestions(this._venues);
        }
    }

    private _frameMap() {
        const own = locationStore.own;
        const partner = locationStore.partner;
        if (own && partner) {
            // Slight delay so the map is fully loaded
            setTimeout(() => {
                const mapView = document.querySelector('map-view') as any;
                mapView?.fitBounds?.(own, partner, 80);
            }, 300);
        }
    }

    private _select(venue: Venue) {
        this._selectedId = venue.id;
        this.dispatchEvent(new CustomEvent('map-view:move-to', {
            bubbles: true, composed: true,
            detail: { coords: venue.coordinates, zoom: 15 },
        }));
    }

    private _suggest() {
        const venue = this._venues.find(v => v.id === this._selectedId);
        if (!venue) return;
        sessionStore.selectVenue(venue);
        locationStore.setDestination(venue.coordinates);
        uiStore.goToAgreeRefuse();
    }

    override render() {
        return html`
      <div class="top-pill">
        <div class="pill-inner">
          <span>⊙</span>
          <span class="pill-label">Midpoint calculated</span>
          <span class="pill-badge">${this._venues.length} spots</span>
        </div>
      </div>

      <div class="sheet">
        <div class="handle"></div>
        <div class="header">
          <div class="title">Pick a Midpoint</div>
          <div class="subtitle">Sorted by equal travel time for both of you</div>
        </div>

        <div class="venues">
          ${this._venues.map(v => html`
            <div
              class="venue ${this._selectedId === v.id ? 'selected' : ''}"
              @click=${() => this._select(v)}
            >
              <div class="venue-icon">${v.emoji}</div>
              <div class="venue-info">
                <div class="venue-name">${v.name}</div>
                <div class="venue-meta">${v.address} · ${v.distanceKm.toFixed(1)} km</div>
              </div>
              <div class="venue-eta">
                <div class="eta-val">${v.etaMinutesFromYou} min</div>
                <div class="eta-label">each</div>
              </div>
            </div>
          `)}
        </div>

        <button class="btn-primary" ?disabled=${!this._selectedId} @click=${this._suggest}>
          Suggest This Spot →
        </button>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'select-rendezvous': SelectRendezvous; }
}