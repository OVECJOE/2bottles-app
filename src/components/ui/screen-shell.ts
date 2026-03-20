/**
 * <screen-shell> — thin wrapper every screen uses.
 * Provides the status bar (clock + three-dot menu button)
 * so individual screens don't replicate that logic.
 *
 * Usage:
 *   <screen-shell .screen=${'live-tracking'}>
 *     <!-- your bottom sheet and overlays -->
 *   </screen-shell>
 *
 * Properties:
 *   screen    — current AppScreen, passed to <app-menu>
 */
import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import './app-menu.js';
import { uiStore } from '../../store/index.js';
import type { AppScreen } from '../../types/index.js';
export class ScreenShell extends LitElement {
  static override styles = css`
    :host { display: block; }

    ::slotted(.sheet) {
      transition: transform var(--duration-base) var(--ease-out), opacity var(--duration-fast) var(--ease-out);
      will-change: transform, opacity;
    }

    :host([sheet-collapsed]) ::slotted(.sheet) {
      transform: translateY(110%);
      opacity: 0;
      pointer-events: none;
    }

    .status-bar {
      position: absolute; top: 0; left: 0; right: 0;
      height: var(--map-status-bar-height);
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 var(--space-5);
      z-index: var(--z-topbar);
      pointer-events: none;
    }

    .time {
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      letter-spacing: 0.2px;
    }

    .menu-btn {
      pointer-events: all;
      background: rgba(255,255,255,0.85);
      border: none; border-radius: var(--border-radius-pill);
      padding: 4px 10px;
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      letter-spacing: 2px;
      cursor: pointer;
      display: flex; align-items: center; gap: 2px;
      box-shadow: var(--shadow-sm);
      transition: background var(--duration-fast), transform var(--duration-fast);
      color: var(--color-text-primary);
      -webkit-tap-highlight-color: transparent;
      line-height: 1;
    }
    .menu-btn:hover  { background: rgba(255,255,255,0.96); }
    .menu-btn:active { transform: scale(0.94); }

    .time { color: rgba(30,30,30,0.72); }

    .sheet-toggle-btn {
      pointer-events: all;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(255,255,255,0.88);
      color: var(--color-text-primary);
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-sm);
      transition: transform var(--duration-fast), background var(--duration-fast);
      -webkit-tap-highlight-color: transparent;
      line-height: 1;
      padding: 0;
    }

    .sheet-toggle-btn:hover { background: rgba(255,255,255,0.98); }
    .sheet-toggle-btn:active { transform: scale(0.94); }

    .status-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      pointer-events: all;
    }

    .sheet-fab {
      position: absolute;
      right: var(--space-4);
      bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-4));
      z-index: var(--z-fabs);
      width: 46px;
      height: 46px;
      border-radius: 50%;
      border: none;
      background: var(--color-blue);
      color: var(--color-blue-text);
      font-size: 18px;
      font-weight: var(--weight-bold);
      cursor: pointer;
      box-shadow: var(--shadow-lg);
      transition: transform var(--duration-fast), opacity var(--duration-fast);
      -webkit-tap-highlight-color: transparent;
    }

    .sheet-fab:active { transform: scale(0.94); }
  `;

  @property() screen: AppScreen = 'create-session';
  @property({ type: Boolean, reflect: true, attribute: 'sheet-collapsed' }) sheetCollapsed = false;

  @state() private _menuOpen = false;
  @state() private _time = '';

  private _clockInterval?: ReturnType<typeof setInterval>;
  private _unsubUI?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this._updateClock();
    this._clockInterval = setInterval(() => this._updateClock(), 10_000);
    this.sheetCollapsed = !uiStore.sheetOpen;
    this._unsubUI = uiStore.subscribe(() => {
      this.sheetCollapsed = !uiStore.sheetOpen;
      this.requestUpdate();
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clockInterval);
    this._unsubUI?.();
  }

  private _updateClock() {
    this._time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private _toggleMenu() {
    this._menuOpen = !this._menuOpen;
  }

  private _toggleSheet() {
    uiStore.toggleSheet();
  }

  override render() {
    return html`
      <div class="status-bar">
        <span class="time">${this._time}</span>
        <div class="status-actions">
          <button
            class="sheet-toggle-btn"
            @click=${this._toggleSheet}
            aria-label=${this.sheetCollapsed ? 'Show panel' : 'Hide panel'}
            title=${this.sheetCollapsed ? 'Show panel' : 'Hide panel'}
          >${this.sheetCollapsed ? '↑' : '↓'}</button>
          <button
            class="menu-btn"
            @click=${this._toggleMenu}
            aria-label="Menu"
            aria-expanded=${this._menuOpen}
          >●●●</button>
        </div>
      </div>

      ${this._menuOpen ? html`
        <app-menu
          .screen=${this.screen}
          @menu-closed=${() => { this._menuOpen = false; }}
        ></app-menu>
      ` : ''}

      ${this.sheetCollapsed ? html`
        <button
          class="sheet-fab"
          @click=${this._toggleSheet}
          aria-label="Show panel"
          title="Show panel"
        >⌃</button>
      ` : ''}

      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'screen-shell': ScreenShell; }
}

if (!customElements.get('screen-shell')) {
  customElements.define('screen-shell', ScreenShell);
}