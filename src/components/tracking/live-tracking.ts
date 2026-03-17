import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import '../ui/screen-shell.js';
import type { Coordinates } from '../../types/index.js';

const ARRIVAL_RADIUS_M = 150;

function haversineMeters(a: Coordinates, b: Coordinates): number {
    const R = 6_371_000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 +
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
      top: calc(var(--map-status-bar-height) + var(--space-2));
      left: var(--space-4); right: var(--space-4);
      z-index: var(--z-topbar);
      background: rgba(26,37,48,0.92);
      border-radius: var(--border-radius-md);
      padding: var(--space-2) var(--space-4);
      display: flex; align-items: center; gap: var(--space-3);
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      animation: slide-down var(--duration-base) var(--ease-out) both;
    }

    .top-bar-dest {
      font-size: var(--text-sm); font-weight: var(--weight-medium); color: #fff; flex: 1;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .top-bar-eta {
      font-size: var(--text-sm); font-weight: var(--weight-bold);
      color: var(--color-green); flex-shrink: 0;
    }

    .reframe-btn {
      background: rgba(255,255,255,0.12); border: none;
      border-radius: var(--border-radius-sm);
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0; font-size: 14px;
      transition: background var(--duration-fast);
    }
    .reframe-btn:hover { background: rgba(255,255,255,0.22); }

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

    .eta-row { display: flex; gap: var(--space-3); margin-bottom: var(--space-3); }

    .eta-card {
      flex: 1; background: rgba(0,0,0,0.04);
      border-radius: var(--border-radius-md); padding: var(--space-3);
      text-align: center; position: relative; overflow: hidden;
    }
    .eta-card.you     { border-top: 3px solid var(--color-blue); }
    .eta-card.partner { border-top: 3px solid var(--color-partner); }

    .eta-num  { font-size: 28px; font-weight: var(--weight-bold); line-height: 1; }
    .eta-unit { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }
    .eta-name { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-1); }

    .eta-card.you     .eta-num { color: var(--color-blue-dark); }
    .eta-card.partner .eta-num { color: var(--color-partner); }

    .eta-arrived {
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      color: var(--color-green-text); background: var(--color-green);
      padding: 2px 8px; border-radius: var(--border-radius-pill);
      margin-top: var(--space-1); display: inline-block;
    }

    .status-strip {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: rgba(208,239,177,0.35);
      border-radius: var(--border-radius-md);
      margin-bottom: var(--space-3);
      transition: background var(--duration-base);
    }
    .status-strip.alert { background: rgba(232,160,32,0.15); }
    .status-strip.arrived { background: rgba(208,239,177,0.6); }

    .status-text {
      font-size: var(--text-xs); font-weight: var(--weight-medium);
      color: var(--color-green-text);
    }
    .status-strip.alert .status-text   { color: var(--color-partner); }
    .status-strip.arrived .status-text { color: var(--color-green-text); }

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

    @state() private _ownArrived = false;
    @state() private _partnerArrived = false;

    private _unsubLoc?: () => void;

    override connectedCallback() {
        super.connectedCallback();

        locationStore.startWatching();
        this._unsubLoc = locationStore.subscribe(() => {
            this._onLocationUpdate();
            this.requestUpdate();
        });

        // Give the map a tick to settle then frame all three points and draw routes
        requestAnimationFrame(() => {
            this._fireMapEvent('map-view:fit-tracking', {});
            this._fireMapEvent('map-view:draw-tracking-routes', {});
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubLoc?.();
    }

    private _fireMapEvent(type: string, detail: unknown) {
        this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
    }

    private _onLocationUpdate() {
        const own = locationStore.own;
        const dest = locationStore.destination;
        if (!own || !dest) return;

        // Update route lines as own GPS position changes
        this._fireMapEvent('map-view:draw-tracking-routes', {});

        const dist = haversineMeters(own, dest);
        if (dist <= ARRIVAL_RADIUS_M && !this._ownArrived) {
            this._ownArrived = true;
            sessionStore.setPartnerStatus('arrived');
            p2pService.send({ type: 'partner:status', status: 'arrived' });
            this._checkBothArrived();
        }

        // Check if partner arrived (could be sent via P2P status update)
        if (sessionStore.partner?.status === 'arrived') {
            this._partnerArrived = true;
            this._checkBothArrived();
        }
    }

    private _checkBothArrived() {
        if (this._ownArrived && this._partnerArrived) {
            setTimeout(() => uiStore.goToEndSession(), 1200);
        }
    }

    private _reframe() {
        this._fireMapEvent('map-view:fit-tracking', {});
    }

    override render() {
        const dest = sessionStore.selectedVenue;
        const partner = sessionStore.partner;
        const pName = partner?.name?.split(' ')[0] ?? 'Partner';
        const ownEta = locationStore.ownEtaMinutes;
        const partnerEta = locationStore.partnerEtaMinutes;

        const statusClass = this._ownArrived && this._partnerArrived ? 'arrived'
            : this._ownArrived || this._partnerArrived ? 'arrived'
                : 'moving';

        const statusMsg = this._ownArrived && this._partnerArrived
            ? `Both arrived at ${dest?.name ?? 'destination'}! 🎉`
            : this._ownArrived
                ? `You're there — waiting for ${pName}…`
                : this._partnerArrived
                    ? `${pName} arrived — you're almost there!`
                    : `Both moving toward ${dest?.name ?? 'destination'}`;

        return html`
      <screen-shell screen='live-tracking'>

      <div class="top-bar">
        <span class="top-bar-dest">🧭 ${dest?.name ?? 'Destination'}</span>
        <span class="top-bar-eta">${this._ownArrived ? 'Arrived' : `${ownEta ?? '–'} min`}</span>
        <button class="reframe-btn" @click=${this._reframe} title="Re-centre map">⊙</button>
      </div>

      <div class="sheet">
        <div class="handle"></div>

        <div class="eta-row">
          <div class="eta-card you">
            <div class="eta-num">${this._ownArrived ? '0' : (ownEta ?? '–')}</div>
            <div class="eta-unit">min</div>
            <div class="eta-name">Your ETA</div>
            ${this._ownArrived ? html`<div class="eta-arrived">Arrived ✓</div>` : ''}
          </div>
          <div class="eta-card partner">
            <div class="eta-num">${this._partnerArrived ? '0' : (partnerEta ?? '–')}</div>
            <div class="eta-unit">min</div>
            <div class="eta-name">${pName}'s ETA</div>
            ${this._partnerArrived ? html`<div class="eta-arrived">Arrived ✓</div>` : ''}
          </div>
        </div>

        <div class="status-strip ${statusClass === 'arrived' ? 'arrived' : ''}">
          <span>${statusClass === 'arrived' ? '✓' : '🟢'}</span>
          <span class="status-text">${statusMsg}</span>
        </div>

        <button class="btn-outline" @click=${() => uiStore.goToLiveChat()}>
          💬 Message ${pName}
        </button>
      </div>

      </screen-shell>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'live-tracking': LiveTracking; }
}