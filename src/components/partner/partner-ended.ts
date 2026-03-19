/**
 * <partner-ended> — shown when partner rejects the invite.
 * Session ends immediately; user can start over or close.
 */
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import { sharedStyles } from '../../styles/shared-styles.js';

@customElement('partner-ended')
export class PartnerEnded extends LitElement {
    static override styles = [
        sharedStyles,
        css`
    :host { display: block; }

    /* Local overrides */
    .sheet { text-align: center; }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-5); }

    .icon-wrap {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--color-danger-bg);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      margin: 0 auto var(--space-4);
    }

    .title { margin-bottom: var(--space-2); }
    .body  { color: var(--color-text-muted); margin-bottom: var(--space-5); line-height: var(--line-height-loose); }
  `    ];

    private _restart() {
      p2pService.disconnect();
        sessionStore.endSession();
        locationStore.reset();
        uiStore.goHome(true);
    }

    override render() {
        const name = sessionStore.partner?.name ?? 'Your partner';

        return html`
      <div class="sheet">
        <div class="handle"></div>
        <div class="icon-wrap">✕</div>
        <div class="title">Invite Declined</div>
        <div class="body">
          ${name} declined the invite.<br>
          You can invite someone else or try again later.
        </div>
        <button class="btn btn-primary" @click=${this._restart}>Invite Someone Else</button>
        <button class="btn btn-ghost" @click=${this._restart}>Close</button>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'partner-ended': PartnerEnded; }
}