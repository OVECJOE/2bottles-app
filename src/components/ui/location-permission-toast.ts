import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('location-permission-toast')
export class LocationPermissionToast extends LitElement {
  static override styles = css`
    :host {
      position: fixed;
      left: var(--space-4);
      bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-4));
      z-index: calc(var(--z-modal) - 1);
      width: min(360px, calc(100vw - (2 * var(--space-4))));
      display: block;
      animation: slide-in 240ms var(--ease-out) both;
    }

    .card {
      border-radius: var(--border-radius-lg);
      border: 1px solid rgba(255, 255, 255, 0.8);
      background:
        linear-gradient(160deg, rgba(231, 246, 214, 0.92), rgba(217, 232, 245, 0.92) 58%, rgba(247, 251, 255, 0.94));
      box-shadow: var(--shadow-xl);
      padding: var(--space-4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: var(--weight-bold);
      letter-spacing: 0.25px;
      color: var(--color-blue-dark);
      border: 1px solid rgba(77, 114, 152, 0.2);
      border-radius: var(--border-radius-pill);
      padding: 4px 10px;
      margin-bottom: var(--space-2);
      background: rgba(255, 255, 255, 0.7);
    }

    .title {
      font-size: var(--text-md);
      line-height: 1.2;
      font-weight: var(--weight-bold);
      color: var(--color-text-primary);
      margin-bottom: 5px;
    }

    .copy {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.35;
      margin-bottom: var(--space-3);
    }

    .error {
      margin-bottom: var(--space-3);
      font-size: var(--text-xs);
      color: var(--color-danger-text);
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(192, 57, 43, 0.22);
      background: rgba(253, 236, 234, 0.8);
      padding: 8px 10px;
    }

    .actions {
      display: grid;
      gap: var(--space-2);
    }

    .row {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }

    .btn {
      border: none;
      border-radius: var(--border-radius-md);
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      cursor: pointer;
      padding: 10px 12px;
      transition: transform var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out);
      -webkit-tap-highlight-color: transparent;
      line-height: 1;
    }

    .btn:active {
      transform: scale(0.98);
      opacity: 0.9;
    }

    .btn-primary {
      background: var(--color-blue);
      color: var(--color-blue-text);
      flex: 1 1 180px;
    }

    .btn-secondary {
      border: 1px solid rgba(0, 0, 0, 0.1);
      background: rgba(255, 255, 255, 0.82);
      color: var(--color-text-primary);
      flex: 1 1 160px;
    }

    .btn-ghost {
      background: transparent;
      color: var(--color-text-secondary);
      padding-left: 0;
      padding-right: 0;
      font-size: var(--text-xs);
      text-align: left;
    }

    @media (max-width: 560px) {
      :host {
        left: var(--space-3);
        bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-3));
        width: calc(100vw - (2 * var(--space-3)));
      }
    }

    @keyframes slide-in {
      from {
        transform: translateY(10px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `;

  @property() permissionState: 'prompt' | 'granted' | 'denied' | 'unknown' = 'prompt';
  @property({ type: Boolean }) canInstall = false;

  private _emit(name: string) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  override render() {
    const denied = this.permissionState === 'denied';

    return html`
      <div class="card" role="status" aria-live="polite">
        <div class="chip">LOCATION ACCESS</div>
        <div class="title">Enable live location for fair meetup timing</div>
        <div class="copy">2bottles uses location only for midpoint recommendations and ETA updates.</div>

        ${denied ? html`
          <div class="error">Location is blocked in browser settings. Enable it, then tap the button below.</div>
        ` : ''}

        <div class="row">
            <button class="btn btn-primary" @click=${() => this._emit('request-location')}>Enable Location</button>
            ${this.canInstall ? html`<button class="btn btn-secondary" @click=${() => this._emit('request-install')}>Install App</button>` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'location-permission-toast': LocationPermissionToast;
  }
}
