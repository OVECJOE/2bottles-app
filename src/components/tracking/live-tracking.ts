import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import { haversineMeters } from '../../services/geocoding.service.js';
import type { Coordinates } from '../../types/index.js';
import '../ui/screen-shell.js';

const ARRIVAL_RADIUS_M = 60; // Bug 50: Reduced from 150m for urban precision
const REFRAME_THRESHOLD_M = 15; // Bug 49: Only reframe if moved significantly
const REFRAME_THROTTLE_MS = 10000; // Bug 49: Throttle reframing

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

    /* Design System Compliant Buttons */
    .btn {
      display: block; width: 100%; padding: 13px var(--space-4);
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer;
      text-align: center; line-height: 1;
      transition: all var(--duration-fast) var(--ease-out);
      -webkit-tap-highlight-color: transparent;
      margin-top: var(--space-2);
    }
    .btn:active { transform: scale(0.98); opacity: 0.9; }

    .btn-outline {
      background: transparent; color: var(--color-blue);
      border: 1.5px solid var(--color-blue);
    }
    .btn-outline:hover { background: var(--color-blue-light); }

    .btn-finish {
      background: var(--color-green); color: var(--color-green-text);
    }
    .btn-finish:hover { background: var(--color-green-mid); }

    /* Premium Chat Widget */
    .chat-widget {
      display: flex; flex-direction: column; gap: var(--space-3);
      height: 340px; margin-bottom: var(--space-2);
    }
    .chat-messages {
      flex: 1; overflow-y: auto; overflow-x: hidden; padding: var(--space-2) 4px;
      display: flex; flex-direction: column; gap: var(--space-2);
      scroll-behavior: smooth;
    }
    .msg { display: flex; align-items: flex-end; gap: var(--space-2); }
    .msg.mine { flex-direction: row-reverse; }
    .bubble {
      max-width: 80%; padding: 10px 14px;
      border-radius: 18px; font-size: var(--text-md); line-height: 1.4;
      box-shadow: var(--shadow-sm);
      overflow-wrap: break-word; word-break: break-word;
    }
    .bubble.them { background: #E9EDEF; color: var(--color-text-primary); border-bottom-left-radius: 4px; }
    .bubble.mine { background: var(--color-blue); color: #fff; border-bottom-right-radius: 4px; }

    .chat-input-row {
      display: flex; gap: var(--space-2); align-items: center;
      padding-top: var(--space-3);
      border-top: 1px solid rgba(0,0,0,0.06);
    }
    .chat-input {
      flex: 1; padding: 12px 16px; border-radius: var(--border-radius-pill);
      border: 1px solid rgba(0,0,0,0.1); font-family: inherit; font-size: var(--text-md); outline: none;
      background: rgba(0,0,0,0.03); transition: border-color 0.2s;
    }
    .chat-input:focus { border-color: var(--color-blue); background: #fff; }
    .send-btn {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--color-blue); color: #fff;
      border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s, background 0.2s;
    }
    .send-btn:active { transform: scale(0.9); }
    .send-btn:hover { background: var(--color-blue-mid); }
  `;

    @state() private _ownArrived = false;
    @state() private _partnerArrived = false;
    @state() private _view: 'eta' | 'chat' = 'eta';
    @state() private _draft = '';

    private _unsubLoc?: () => void;
    private _unsubSession?: () => void;
    private _lastReframeTime = 0;
    private _lastReframedPos: Coordinates | null = null;

    override connectedCallback() {
        super.connectedCallback();

        locationStore.startWatching();
        this._unsubLoc = locationStore.subscribe(() => {
            this._onLocationUpdate();
            this.requestUpdate();
        });

        this._unsubSession = sessionStore.subscribe(() => {
            this.requestUpdate();
            this._scrollToBottom();
        });

        // Give the map a tick to settle then frame all three points and draw routes
        // Bug 66: Wait for a moment to ensure stable GPS before first reframe
        setTimeout(() => {
            this._fireMapEvent('map-view:fit-tracking', {});
            this._fireMapEvent('map-view:draw-tracking-routes', {});
        }, 800);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubLoc?.();
        this._unsubSession?.();
    }

    private _fireMapEvent(type: string, detail: unknown) {
        this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
    }

    private _onLocationUpdate() {
        const own = locationStore.own;
        const dest = locationStore.destination;
        if (!own || !dest) return;

        // Perform calculations (Using 10 min/km for city/mixed travel)
        const dist = haversineMeters(own, dest);
        let ownEta: number | null = dist < ARRIVAL_RADIUS_M ? 0 : Math.max(1, Math.round((dist / 1000) * 10));

        // Safety guard: Ensure we don't push NaN to stores
        if (!isFinite(dist) || isNaN(dist)) return;
        if (!isFinite(ownEta) || isNaN(ownEta)) ownEta = null;

        const partner = locationStore.partner;
        let pDist: number | null = null;
        let pEta: number | null = null;

        if (partner && isFinite(partner.lat) && isFinite(partner.lng)) {
            pDist = haversineMeters(partner, dest);
            if (isFinite(pDist)) {
                pEta = pDist < ARRIVAL_RADIUS_M ? 0 : Math.max(1, Math.round((pDist / 1000) * 10));
            }
        }

        // Batch store updates
        locationStore.setDistances(dist, pDist);
        locationStore.setEtas(ownEta, pEta);

        // Arrival logic
        if (dist <= ARRIVAL_RADIUS_M && !this._ownArrived) {
            this._ownArrived = true;
            sessionStore.setPartnerStatus('arrived');
            p2pService.send({ type: 'partner:status', status: 'arrived' });
            this._checkBothArrived();
        }

        if (sessionStore.partner?.status === 'arrived') {
            this._partnerArrived = true;
            this._checkBothArrived();
        }

        // Visual updates
        this._fireMapEvent('map-view:draw-tracking-routes', {});
        
        // Bug 49: Throttled/Thresholded Re-framing
        const now = Date.now();
        const distMoved = this._lastReframedPos ? haversineMeters(own, this._lastReframedPos) : Infinity;
        
        if (now - this._lastReframeTime > REFRAME_THROTTLE_MS || distMoved > REFRAME_THRESHOLD_M) {
            this._fireMapEvent('map-view:fit-tracking', {});
            this._lastReframeTime = now;
            this._lastReframedPos = { ...own };
        }
    }

    private _checkBothArrived() {
        // Bug 51: Removed auto-termination timeout. User will click "Finish"
    }

    private async _manualFinish() {
        const confirmed = await uiStore.confirm({
            title: 'Finish Session?',
            message: 'Are you sure you want to end tracking?',
            confirmLabel: 'Yes, End It',
            cancelLabel: 'Continue'
        });

        if (confirmed) {
            uiStore.goToEndSession();
        }
    }

    private _toggleChat() {
        this._view = this._view === 'chat' ? 'eta' : 'chat';
        if (this._view === 'chat') {
            this._scrollToBottom();
        }
    }

    private _scrollToBottom() {
        requestAnimationFrame(() => {
            const el = this.renderRoot.querySelector('.chat-messages');
            if (el) el.scrollTop = el.scrollHeight;
        });
    }

    private _send() {
        if (!this._draft.trim()) return;
        const timestamp = Date.now();
        sessionStore.addMessage({
            id: crypto.randomUUID(),
            senderId: 'me',
            text: this._draft,
            timestamp
        });
        p2pService.send({ type: 'chat:message', text: this._draft, timestamp });
        this._draft = '';
        (this.renderRoot.querySelector('.chat-input') as HTMLInputElement).value = '';
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

        const isPartnerOffline = !uiStore.isPartnerOnline;

        const statusMsg = this._ownArrived && this._partnerArrived
            ? `Both arrived at ${dest?.name ?? 'destination'}! 🎉`
            : isPartnerOffline
                ? `Connection lost... attempting to reconnect to ${pName}.`
                : this._ownArrived
                    ? `You're there — waiting for ${pName}…`
                    : this._partnerArrived
                        ? `${pName} arrived — you're almost there!`
                        : `Both moving toward ${dest?.name ?? 'destination'}`;
        
        const statusClass = (this._ownArrived && this._partnerArrived) || this._ownArrived || this._partnerArrived ? 'arrived' 
                         : isPartnerOffline ? 'alert' : 'moving';

        return html`
      <screen-shell screen='live-tracking'>

      <div class="top-bar">
        <span class="top-bar-dest">🧭 ${dest?.name ?? 'Destination'}</span>
        <span class="top-bar-eta">${this._ownArrived ? 'Arrived' : `${ownEta ?? '–'} min`}</span>
        <button class="reframe-btn" @click=${this._reframe} title="Re-centre map">⊙</button>
      </div>

        <div class="sheet">
        <div class="handle"></div>

        ${this._view === 'eta' ? html`
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
        ` : html`
            <div class="chat-widget">
                <div class="chat-messages">
                    ${sessionStore.chatMessages.map(m => html`
                        <div class="msg ${m.senderId === 'me' ? 'mine' : ''}">
                            <div class="bubble ${m.senderId === 'me' ? 'mine' : 'them'}">${m.text}</div>
                        </div>
                    `)}
                </div>
                <div class="chat-input-row">
                    <input class="chat-input" type="text" placeholder="Message…" .value=${this._draft} @input=${(e: any) => this._draft = e.target.value} @keydown=${(e: any) => e.key === 'Enter' && this._send()}>
                    <button class="send-btn" @click=${this._send}>↑</button>
                </div>
            </div>
        `}

        <button class="btn btn-outline" @click=${this._toggleChat}>
          ${this._view === 'chat' ? '📊 Show ETA Stats' : `💬 Message ${pName}`}
        </button>

        ${(this._ownArrived || this._partnerArrived) && this._view === 'eta' ? html`
            <button class="btn btn-finish" @click=${this._manualFinish}>
                Finish Session
            </button>
        ` : ''}
      </div>

      </screen-shell>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'live-tracking': LiveTracking; }
}