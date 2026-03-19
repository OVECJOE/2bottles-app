/**
 * <app-menu> — contextual overflow menu anchored to the
 * status bar's three-dot button.
 *
 * Items are derived from the current AppScreen so the menu
 * always shows what's relevant at that moment in the flow.
 *
 * Dispatches:
 *   menu-closed — when dismissed
 */
import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import { copyText } from '../../services/clipboard.service.js';
import type { AppScreen } from '../../types/index.js';

interface MenuItem {
  icon: string;
  label: string;
  action: () => void | Promise<void>;
  danger?: boolean;
}

// @customElement('app-menu') -- Replaced with safe manual registration below
export class AppMenu extends LitElement {
  static override styles = css`
    :host { display: block; }

    .backdrop {
      position: fixed; inset: 0;
      z-index: calc(var(--z-modal) - 1);
    }

    .menu {
      position: absolute;
      top: calc(var(--map-status-bar-height) + var(--space-1));
      right: var(--space-4);
      min-width: 210px;
      background: rgba(255,255,255,0.98);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-xl), 0 0 0 1px rgba(0,0,0,0.06);
      z-index: var(--z-modal);
      overflow: hidden;
      animation: scale-in var(--duration-base) var(--ease-spring) both;
      transform-origin: top right;
    }

    @keyframes scale-in {
      from { transform: scale(0.85); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }

    .section {
      padding: var(--space-1) 0;
    }

    .section + .section {
      border-top: var(--border-width) solid var(--border-color);
    }

    .item {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      transition: background var(--duration-fast);
      font-family: var(--font-sans);
      font-size: var(--text-md);
      color: var(--color-text-primary);
      border: none; background: none; width: 100%; text-align: left;
      -webkit-tap-highlight-color: transparent;
    }
    .item:hover  { background: rgba(0,0,0,0.04); }
    .item:active { background: rgba(0,0,0,0.08); transform: scale(0.98); }

    .item.danger { color: var(--color-danger-text); }
    .item.danger:hover { background: var(--color-danger-bg); }

    .item-icon {
      width: 28px; height: 28px; border-radius: var(--border-radius-sm);
      background: rgba(0,0,0,0.05);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    }
    .item.danger .item-icon { background: var(--color-danger-bg); }

    .session-info {
      padding: var(--space-3) var(--space-4);
      display: flex; align-items: center; gap: var(--space-2);
    }
    .session-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--color-green); flex-shrink: 0;
    }
    .session-label {
      font-size: var(--text-xs); font-weight: var(--weight-medium);
      color: var(--color-text-muted);
    }
    .session-id {
      font-family: var(--font-mono); font-size: var(--text-xs);
      color: var(--color-blue); margin-left: auto;
    }
  `;

  @property() screen: AppScreen = 'create-session';

  private _dismiss() {
    this.dispatchEvent(new CustomEvent('menu-closed', { bubbles: true, composed: true }));
  }

  private _items(): { primary: MenuItem[]; danger: MenuItem[] } {
    const s = sessionStore.session;
    const p = sessionStore.partner;

    const copyLink: MenuItem = {
      icon: '🔗',
      label: 'Copy session link',
      action: async () => {
        const link = s?.link || window.location.origin;
        const ok = await copyText(link);
        uiStore.showToast(ok ? 'Link copied' : 'Unable to copy automatically. Please copy manually.');
        this._dismiss();
      },
    };

    const shareLink: MenuItem = {
      icon: '📤',
      label: 'Share session',
      action: async () => {
        const link = s?.link || window.location.origin;
        try {
          if (navigator.share) {
            await navigator.share({ title: '2bottles', url: link });
          } else {
            const ok = await copyText(link);
            uiStore.showToast(ok ? 'Link copied' : 'Unable to copy automatically. Please copy manually.');
          }
        } catch {
        }
        this._dismiss();
      },
    };

    const messagePartner: MenuItem = {
      icon: '💬',
      label: `Message ${p?.name?.split(' ')[0] ?? 'partner'}`,
      action: () => { 
        if (this.screen === 'live-tracking') {
          uiStore.navigate('live-chat');
        } else {
          uiStore.navigate('partner-agree-refuse');
        }
        this._dismiss();
      },
    };

    const endSession: MenuItem = {
      icon: '✕',
      label: 'End session',
      danger: true,
      action: async () => {
        const confirmed = await uiStore.confirm({
          title: 'End Session?',
          message: 'Are you sure you want to end this session for everyone?',
          confirmLabel: 'End Session',
          cancelLabel: 'Keep Going',
        });
        if (!confirmed) {
          this._dismiss();
          return;
        }
        p2pService.endSessionForAll();
        sessionStore.endSession();
        locationStore.reset();
        uiStore.goHome();
        this._dismiss();
      },
    };

    const startRendezvous: MenuItem = {
      icon: '→',
      label: 'Start rendezvous',
      action: () => {
        uiStore.navigate('create-session');
        this._dismiss();
      },
    };

    const backToSplash: MenuItem = {
      icon: '⌂',
      label: 'Back to splash',
      action: () => {
        void uiStore.goHome();
        this._dismiss();
      },
    };

    const cancelInvite: MenuItem = {
      icon: '✕',
      label: 'Cancel invite',
      danger: true,
      action: async () => {
        const confirmed = await uiStore.confirm({
          title: 'Cancel Invite?',
          message: 'This will end the current rendezvous and stop location sharing.',
          confirmLabel: 'Yes, Cancel',
          cancelLabel: 'Keep Session',
        });
        if (!confirmed) {
          this._dismiss();
          return;
        }
        p2pService.endSessionForAll();
        sessionStore.endSession();
        locationStore.reset();
        uiStore.goHome();
        this._dismiss();
      },
    };

    switch (this.screen) {
      case 'landing':
        return { primary: [startRendezvous], danger: [] };

      case 'create-session':
        return { primary: [backToSplash], danger: [] };

      case 'invite-partner':
        return { primary: [copyLink, shareLink], danger: [endSession] };

      case 'partner-notified':
        return { primary: [copyLink], danger: [cancelInvite] };

      case 'select-rendezvous':
        return { primary: [copyLink, shareLink], danger: [endSession] };

      case 'partner-agree-refuse':
        return { primary: [copyLink, shareLink], danger: [endSession] };

      case 'session-link':
        return { primary: [copyLink, shareLink], danger: [endSession] };

      case 'live-tracking':
        return { primary: [messagePartner, copyLink, shareLink], danger: [endSession] };

      case 'end-session':
        return { primary: [copyLink], danger: [] };

      default:
        return { primary: [], danger: [] };
    }
  }

  override render() {
    const { primary, danger } = this._items();
    const s = sessionStore.session;

    if (primary.length === 0 && danger.length === 0) return html``;

    return html`
      <div class="backdrop" @click=${this._dismiss}></div>
      <div class="menu">
        ${s ? html`
          <div class="section">
            <div class="session-info">
              <div class="session-dot"></div>
              <span class="session-label">Active session</span>
              <span class="session-id">${s.id}</span>
            </div>
          </div>
        ` : ''}

        ${primary.length > 0 ? html`
          <div class="section">
            ${primary.map(item => html`
              <button class="item" @click=${item.action}>
                <div class="item-icon">${item.icon}</div>
                ${item.label}
              </button>
            `)}
          </div>
        ` : ''}

        ${danger.length > 0 ? html`
          <div class="section">
            ${danger.map(item => html`
              <button class="item danger" @click=${item.action}>
                <div class="item-icon">${item.icon}</div>
                ${item.label}
              </button>
            `)}
          </div>
        ` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'app-menu': AppMenu; }
}

if (!customElements.get('app-menu')) {
  customElements.define('app-menu', AppMenu);
}