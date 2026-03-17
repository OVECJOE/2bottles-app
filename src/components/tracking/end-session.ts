/**
 * <end-session> — both users arrived. Shows summary stats,
 * allows saving the venue, and cleans up all session state.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';

@customElement('end-session')
export class EndSession extends LitElement {
    static override styles = css`
    :host { display: block; }

    .arrived-badge {
      position: absolute;
      top: calc(var(--map-status-bar-height) + var(--space-2));
      left: 50%; transform: translateX(-50%);
      z-index: var(--z-topbar);
      background: var(--color-green);
      border-radius: var(--border-radius-pill);
      padding: var(--space-2) var(--space-5);
      white-space: nowrap;
      box-shadow: var(--shadow-md);
      animation: bounce-in var(--duration-slow) var(--ease-spring) both;
    }
    .arrived-text { font-size: var(--text-sm); font-weight: var(--weight-bold); color: var(--color-green-text); }

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

    .hero {
      text-align: center; padding: var(--space-3) 0 var(--space-5);
    }
    .hero-emoji { font-size: 40px; display: block; margin-bottom: var(--space-3); animation: bounce-in 400ms var(--ease-spring) both; }
    .hero-title { font-size: var(--text-2xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); }
    .hero-sub   { font-size: var(--text-sm); color: var(--color-text-muted); }

    .stats-row { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); }

    .stat-card {
      flex: 1; background: rgba(0,0,0,0.04);
      border-radius: var(--border-radius-md); padding: var(--space-3);
      text-align: center;
    }
    .stat-card.highlight {
      background: var(--color-green);
    }

    .stat-val  { font-size: 20px; font-weight: var(--weight-bold); color: var(--color-text-primary); }
    .stat-label { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px; }

    .stat-card.highlight .stat-val   { color: var(--color-green-text); }
    .stat-card.highlight .stat-label { color: var(--color-green-text); opacity: 0.7; }

    .venue-row {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3); background: rgba(0,0,0,0.03);
      border-radius: var(--border-radius-md); margin-bottom: var(--space-4);
    }
    .venue-icon { font-size: 22px; }
    .venue-name { font-size: var(--text-md); font-weight: var(--weight-medium); }
    .venue-addr { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px; }

    .btn-primary {
      display: block; width: 100%; padding: 13px var(--space-4);
      background: var(--color-blue); color: #fff;
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer;
      transition: background var(--duration-fast), transform var(--duration-fast);
      line-height: 1;
    }
    .btn-primary:hover { background: var(--color-blue-mid); }
    .btn-primary:active { transform: scale(0.98); }

    .btn-save {
      display: block; width: 100%; padding: 13px var(--space-4); margin-top: var(--space-2);
      background: var(--color-green); color: var(--color-green-text);
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-sm);
      font-weight: var(--weight-bold); cursor: pointer;
      line-height: 1;
      transition: transform var(--duration-fast);
    }
    .btn-save:hover { background: var(--color-green-mid); }
    .btn-save:active { transform: scale(0.98); }
  `;

    @state() private _saved = false;

    private _avgEta(): number {
        const v = sessionStore.selectedVenue;
        if (!v) return 0;
        return Math.round((v.etaMinutesFromYou + v.etaMinutesFromPartner) / 2);
    }

    private _messageCount(): number {
        return sessionStore.chatMessages.length;
    }

    private _save() {
        this._saved = true;
        uiStore.showToast(`📌 ${sessionStore.selectedVenue?.name ?? 'Spot'} saved`);
    }

    private _end() {
        sessionStore.endSession();
        locationStore.reset();
        this.dispatchEvent(new CustomEvent('map-view:clear-midpoint', { bubbles: true, composed: true }));
        this.dispatchEvent(new CustomEvent('map-view:clear-route', { bubbles: true, composed: true }));
        uiStore.goHome();
    }

    override render() {
        const v = sessionStore.selectedVenue;
        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return html`
      <div class="arrived-badge">
        <span class="arrived-text">✓ Both arrived at ${v?.name ?? 'destination'}!</span>
      </div>

      <div class="sheet">
        <div class="handle"></div>

        <div class="hero">
          <span class="hero-emoji">🤝</span>
          <div class="hero-title">Rendezvous Complete</div>
          <div class="hero-sub">${v?.name ?? 'Meetup spot'} · ${now}</div>
        </div>

        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-val">${this._avgEta()}<span style="font-size:12px;font-weight:400"> min</span></div>
            <div class="stat-label">avg travel</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">${this._messageCount()}</div>
            <div class="stat-label">messages</div>
          </div>
          <div class="stat-card highlight">
            <div class="stat-val">✓</div>
            <div class="stat-label">on time</div>
          </div>
        </div>

        ${v ? html`
          <div class="venue-row">
            <span class="venue-icon">${v.emoji}</span>
            <div>
              <div class="venue-name">${v.name}</div>
              <div class="venue-addr">${v.address}</div>
            </div>
          </div>
        ` : ''}

        <button class="btn-primary" @click=${this._end}>End Session</button>
        <button
          class="btn-save"
          ?disabled=${this._saved}
          @click=${this._save}
        >
          ${this._saved ? '✓ Saved to favourites' : '📌 Save this spot'}
        </button>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'end-session': EndSession; }
}