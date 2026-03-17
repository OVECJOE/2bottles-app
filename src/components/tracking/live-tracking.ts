/**
 * <live-tracking> — both users are en route.
 * Watches own GPS, receives partner location over WS (simulated),
 * updates ETAs, and auto-transitions when both arrive (geofence).
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import type { Coordinates } from '../../types/index.js';

const ARRIVAL_RADIUS_M = 150;

function distanceMeters(a: Coordinates, b: Coordinates): number {
    const R = 6_371_000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

@customElement('live-tracking')
export class LiveTracking extends LitElement {
    static override styles = css`
    :host { display: block; }

    .top-bar {
      position: absolute;
      top: var(--map-status-bar-height); left: var(--space-4); right: var(--space-4);
      z-index: var(--z-topbar);
      background: rgba(26,37,48,0.9);
      border-radius: var(--border-radius-md);
      padding: var(--space-2) var(--space-4);
      display: flex; align-items: center;
      box-shadow: var(--shadow-md); backdrop-filter: blur(6px);
    }
    .top-bar-dest { font-size: var(--text-sm); font-weight: var(--weight-medium); color: #fff; flex: 1; }
    .top-bar-eta  { font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--color-green); }

    .sheet {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) env(safe-area-inset-bottom, var(--space-8));
      z-index: var(--z-sheet);
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-4); }

    .eta-row {
      display: flex; gap: var(--space-3); margin-bottom: var(--space-3);
    }

    .eta-card {
      flex: 1; background: rgba(0,0,0,0.04);
      border-radius: var(--border-radius-md); padding: var(--space-3);
      text-align: center;
    }
    .eta-card.you { border-top: 3px solid var(--color-blue); }
    .eta-card.partner { border-top: 3px solid var(--color-partner); }

    .eta-num   { font-size: 26px; font-weight: var(--weight-bold); line-height: 1; }
    .eta-unit  { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
    .eta-name  { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-1); }

    .eta-card.you     .eta-num { color: var(--color-blue-dark); }
    .eta-card.partner .eta-num { color: var(--color-partner); }

    .status-strip {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: rgba(208,239,177,0.35);
      border-radius: var(--border-radius-md);
      margin-bottom: var(--space-3);
    }
    .status-strip.alert {
      background: rgba(232,160,32,0.15);
    }
    .status-text { font-size: var(--text-xs); font-weight: var(--weight-medium); color: var(--color-green-text); }
    .status-strip.alert .status-text { color: var(--color-partner); }

    .btn-outline {
      width: 100%; padding: 12px;
      background: transparent; color: var(--color-blue);
      border: 1.5px solid var(--color-blue); border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-sm);
      font-weight: var(--weight-medium); cursor: pointer;
      transition: background var(--duration-fast);
    }
    .btn-outline:hover { background: var(--color-blue-light); }
  `;

    @state() private _ownEta: number | null = null;
    @state() private _partnerEta: number | null = null;
    @state() private _bothMoving = true;

    private _unsubLoc?: () => void;
    private _simInterval?: ReturnType<typeof setInterval>;

    override connectedCallback() {
        super.connectedCallback();
        locationStore.startWatching();
        this._unsubLoc = locationStore.subscribe(() => this._onLocationUpdate());

        this._ownEta = sessionStore.selectedVenue?.etaMinutesFromYou ?? 12;
        this._partnerEta = sessionStore.selectedVenue?.etaMinutesFromPartner ?? 9;
        locationStore.setEtas(this._ownEta, this._partnerEta);

        this._updateMap();
        this._startSimulation();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubLoc?.();
        clearInterval(this._simInterval);
    }

    private _updateMap() {
        const dest = locationStore.destination;
        if (!dest) return;

        const own = locationStore.own;
        const partner = locationStore.partner;

        if (own && partner) {
            const mapView = document.querySelector('map-view') as any;
            mapView?.fitBounds?.(own, dest, 80);
        }
    }

    private _onLocationUpdate() {
        const own = locationStore.own;
        const dest = locationStore.destination;
        if (!own || !dest) return;

        const dist = distanceMeters(own, dest);
        if (dist <= ARRIVAL_RADIUS_M) {
            this._ownEta = 0;
            if (this._partnerEta === 0) {
                clearInterval(this._simInterval);
                uiStore.goToEndSession();
            }
        }
    }

    /** Simulate partner moving closer every 5 seconds */
    private _startSimulation() {
        this._simInterval = setInterval(() => {
            if (this._ownEta !== null && this._ownEta > 0) {
                this._ownEta = Math.max(0, this._ownEta - 1);
            }
            if (this._partnerEta !== null && this._partnerEta > 0) {
                this._partnerEta = Math.max(0, this._partnerEta - 1);
                const dest = locationStore.destination;
                const partnerCurrent = locationStore.partner;
                if (dest && partnerCurrent) {
                    const moved = {
                        lat: partnerCurrent.lat + (dest.lat - partnerCurrent.lat) * 0.25,
                        lng: partnerCurrent.lng + (dest.lng - partnerCurrent.lng) * 0.25,
                    };
                    locationStore.setPartnerLocation(moved);
                }
            }
            locationStore.setEtas(this._ownEta, this._partnerEta);

            if (this._ownEta === 0 && this._partnerEta === 0) {
                clearInterval(this._simInterval);
                uiStore.goToEndSession();
            }
        }, 5000);
    }

    override render() {
        const dest = sessionStore.selectedVenue;
        const partner = sessionStore.partner;

        return html`
      <div class="top-bar">
        <span class="top-bar-dest">🧭 En route · ${dest?.name ?? 'Destination'}</span>
        <span class="top-bar-eta">${this._ownEta ?? '–'} min</span>
      </div>

      <div class="sheet">
        <div class="handle"></div>

        <div class="eta-row">
          <div class="eta-card you">
            <div class="eta-num">${this._ownEta ?? '–'}</div>
            <div class="eta-unit">min</div>
            <div class="eta-name">Your ETA</div>
          </div>
          <div class="eta-card partner">
            <div class="eta-num">${this._partnerEta ?? '–'}</div>
            <div class="eta-unit">min</div>
            <div class="eta-name">${partner?.name?.split(' ')[0] ?? 'Partner'}'s ETA</div>
          </div>
        </div>

        <div class="status-strip ${!this._bothMoving ? 'alert' : ''}">
          <span>${this._bothMoving ? '🟢' : '⚠️'}</span>
          <span class="status-text">
            ${this._bothMoving
                ? `Both moving toward ${dest?.name ?? 'destination'}`
                : `${partner?.name?.split(' ')[0]} may have stopped`}
          </span>
        </div>

        <button class="btn-outline" @click=${() => uiStore.navigate('partner-agree-refuse')}>
          💬 Message ${partner?.name?.split(' ')[0] ?? 'Partner'}
        </button>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'live-tracking': LiveTracking; }
}