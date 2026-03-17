/**
 * <partner-ended> — shown when partner rejects the invite.
 * Session ends immediately; user can start over or close.
 */
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';

@customElement('partner-ended')
export class PartnerEnded extends LitElement {
    static override styles = css`
    :host { display: block; }

    .sheet {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) env(safe-area-inset-bottom, var(--space-8));
      z-index: var(--z-sheet);
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-5); }

    .icon-wrap {
      width: 56px; height: 56px;
      border-radius: 50%;
      background: var(--color-danger-bg);
      display: flex; align-items: center; justify-content: center;
      font-size: 24px;
      margin: 0 auto var(--space-4);
    }

    .title { font-size: var(--text-xl); font-weight: var(--weight-bold); text-align: center; margin-bottom: var(--space-2); }
    .body  { font-size: var(--text-sm); color: var(--color-text-muted); text-align: center; margin-bottom: var(--space-5); line-height: var(--line-height-loose); }

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

    .btn-ghost {
      display: block; width: 100%; padding: 13px; margin-top: var(--space-2);
      background: rgba(0,0,0,0.05); color: var(--color-text-secondary);
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-sm); cursor: pointer;
      transition: transform var(--duration-fast);
    }
    .btn-ghost:active { transform: scale(0.98); }
  `;

    private _restart() {
        sessionStore.endSession();
        locationStore.reset();
        uiStore.goHome();
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
        <button class="btn-primary" @click=${this._restart}>Invite Someone Else</button>
        <button class="btn-ghost" @click=${this._restart}>Close</button>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'partner-ended': PartnerEnded; }
}