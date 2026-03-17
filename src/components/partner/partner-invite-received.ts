/**
 * <partner-invite-received> — shown while waiting for partner to
 * accept or reject. Polls (or in production, listens over WebSocket)
 * for a status change and auto-navigates when it arrives.
 *
 * For the prototype we simulate a 4-second auto-accept.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';

@customElement('partner-invite-received')
export class PartnerInviteReceived extends LitElement {
    static override styles = css`
    :host { display: block; }

    .notif-banner {
      position: absolute;
      top: calc(var(--map-status-bar-height) + var(--space-2));
      left: var(--space-4); right: var(--space-4);
      background: rgba(26,37,48,0.94);
      border-radius: var(--border-radius-lg);
      padding: var(--space-3) var(--space-3);
      display: flex; align-items: center; gap: var(--space-3);
      z-index: var(--z-notification);
      box-shadow: var(--shadow-lg);
      backdrop-filter: blur(8px);
      animation: slide-down var(--duration-slow) var(--ease-spring) both;
    }

    .notif-icon {
      width: 38px; height: 38px;
      border-radius: var(--border-radius-sm);
      background: var(--color-blue); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }

    .notif-text { flex: 1; }
    .notif-title { font-size: var(--text-sm); font-weight: var(--weight-bold); color: #fff; }
    .notif-body { font-size: var(--text-xs); color: var(--color-text-on-dark-muted); margin-top: 1px; }

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

    .partner-row {
      display: flex; align-items: center; gap: var(--space-3);
      margin-bottom: var(--space-4);
    }

    .avatar {
      width: 48px; height: 48px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: var(--weight-bold); font-size: 15px; flex-shrink: 0;
    }

    .title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); }
    .subtitle { font-size: var(--text-sm); color: var(--color-text-muted); }

    .status-card {
      display: flex; align-items: center; gap: var(--space-3);
      background: rgba(0,0,0,0.04); border-radius: var(--border-radius-md);
      padding: var(--space-3); margin-bottom: var(--space-3);
    }

    .status-dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      animation: pulse-ring 1.8s ease-in-out infinite;
    }
    .status-dot.waiting { background: var(--color-partner); box-shadow: 0 0 0 0 rgba(232,160,32,0.4); }

    .status-text { font-size: var(--text-sm); font-weight: var(--weight-medium); }
    .status-sub  { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px; }

    .progress-bar-wrap {
      height: 3px; background: rgba(0,0,0,0.07);
      border-radius: var(--border-radius-pill); overflow: hidden;
      margin-bottom: var(--space-4);
    }
    .progress-bar {
      height: 100%; background: var(--color-blue);
      border-radius: var(--border-radius-pill);
      animation: progress-fill 4s linear forwards;
    }
    @keyframes progress-fill { from { width: 0; } to { width: 100%; } }

    .btn-ghost {
      width: 100%; padding: 13px;
      background: rgba(0,0,0,0.05); color: var(--color-text-secondary);
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-sm);
      font-weight: var(--weight-medium); cursor: pointer;
    }
    .btn-ghost:hover { background: rgba(0,0,0,0.09); }
  `;

    @state() private _elapsed = 0;
    private _interval?: ReturnType<typeof setInterval>;

    override connectedCallback() {
        super.connectedCallback();
        // Simulate partner accepting after 4 seconds (replace with WS in prod)
        this._interval = setInterval(() => {
            this._elapsed += 1;
            if (this._elapsed >= 4) {
                clearInterval(this._interval);
                sessionStore.setPartnerStatus('accepted');

                // Simulate partner having a location
                const own = locationStore.own;
                if (own) {
                    const partnerCoords = { lat: own.lat + 0.02, lng: own.lng + 0.025 };
                    locationStore.setPartnerLocation(partnerCoords);
                    sessionStore.setPartner({ ...sessionStore.partner!, location: partnerCoords });
                }

                uiStore.goToSelectVenue();
            }
        }, 1000);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this._interval);
    }

    private _cancel() {
        clearInterval(this._interval);
        sessionStore.endSession();
        locationStore.reset();
        uiStore.goHome();
    }

    override render() {
        const p = sessionStore.partner;
        if (!p) return html``;

        return html`
      <div class="notif-banner">
        <div class="notif-icon">📍</div>
        <div class="notif-text">
          <div class="notif-title">2bottles · Invite Sent</div>
          <div class="notif-body">Waiting for ${p.name} to respond…</div>
        </div>
      </div>

      <div class="sheet">
        <div class="handle"></div>

        <div class="partner-row">
          <div class="avatar" style="background:${p.avatarBg};color:${p.avatarColor}">${p.initials}</div>
          <div>
            <div class="title">${p.name}</div>
            <div class="subtitle">Invite sent — awaiting response</div>
          </div>
        </div>

        <div class="status-card">
          <div class="status-dot waiting"></div>
          <div>
            <div class="status-text">Notification delivered</div>
            <div class="status-sub">They'll see it any moment now</div>
          </div>
        </div>

        <div class="progress-bar-wrap">
          <div class="progress-bar"></div>
        </div>

        <button class="btn-ghost" @click=${this._cancel}>Cancel invite</button>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'partner-invite-received': PartnerInviteReceived; }
}