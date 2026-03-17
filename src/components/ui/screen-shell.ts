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
 *   darkBar   — true for dark-mode status bar text (over dark overlays)
 */
import { LitElement, html, css } from 'lit';
import { property, state } from 'lit/decorators.js';
import './app-menu.js';
import type { AppScreen } from '../../types/index.js';

// @customElement('screen-shell')
export class ScreenShell extends LitElement {
  static override styles = css`
    :host { display: block; }

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

    :host([dark-bar]) .menu-btn {
      background: rgba(26,37,48,0.7);
      color: rgba(255,255,255,0.9);
      box-shadow: none;
    }
    :host([dark-bar]) .time { color: rgba(255,255,255,0.85); }
    :host(:not([dark-bar])) .time { color: rgba(30,30,30,0.72); }
  `;

  @property() screen: AppScreen = 'create-session';
  @property({ type: Boolean, reflect: true, attribute: 'dark-bar' }) darkBar = false;

  @state() private _menuOpen = false;
  @state() private _time = '';

  private _clockInterval?: ReturnType<typeof setInterval>;

  override connectedCallback() {
    super.connectedCallback();
    this._updateClock();
    this._clockInterval = setInterval(() => this._updateClock(), 10_000);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._clockInterval);
  }

  private _updateClock() {
    this._time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private _toggleMenu() {
    this._menuOpen = !this._menuOpen;
  }

  override render() {
    return html`
      <div class="status-bar">
        <span class="time">${this._time}</span>
        <button
          class="menu-btn"
          @click=${this._toggleMenu}
          aria-label="Menu"
          aria-expanded=${this._menuOpen}
        >●●●</button>
      </div>

      ${this._menuOpen ? html`
        <app-menu
          .screen=${this.screen}
          @menu-closed=${() => { this._menuOpen = false; }}
        ></app-menu>
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