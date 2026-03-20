/**
 * <location-permission-dialog> — full modal explaining why location is needed.
 *
 * Properties:
 *   permissionState — 'prompt' | 'granted' | 'denied' | 'unknown'
 *   canInstall      — whether install CTA should be shown
 *
 * Dispatches:
 *   request-location, request-install, continue-manual
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('location-permission-dialog')
export class LocationPermissionDialog extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      max-height: min(780px, calc(100dvh - (2 * var(--space-4))));
      overflow: auto;
      background: var(--location-permission-surface-bg);
      color: var(--color-text-primary);
      border-radius: var(--border-radius-xl);
      position: relative;
    }

    .nebula {
      position: absolute;
      inset: -20% -15% auto auto;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, rgba(77, 114, 152, 0.45), rgba(77, 114, 152, 0));
      filter: blur(2px);
      animation: drift 11s ease-in-out infinite alternate;
      pointer-events: none;
    }

    .glow {
      position: absolute;
      left: -70px;
      bottom: 140px;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(208, 239, 177, 0.66), rgba(208, 239, 177, 0));
      animation: pulse 7s ease-in-out infinite;
      pointer-events: none;
    }

    .content {
      position: relative;
      padding: var(--space-8) var(--space-5) calc(var(--space-8) + env(safe-area-inset-bottom, 0px));
      z-index: 1;
    }

    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      color: var(--color-blue-dark);
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(77, 114, 152, 0.24);
      border-radius: var(--border-radius-pill);
      padding: 6px 12px;
      margin-bottom: var(--space-4);
      letter-spacing: 0.2px;
    }

    h2 {
      font-size: var(--text-3xl);
      line-height: 1.05;
      letter-spacing: -0.2px;
      margin-bottom: var(--space-3);
    }

    p {
      color: var(--color-text-secondary);
      font-size: var(--text-md);
      line-height: var(--line-height-base);
      margin-bottom: var(--space-4);
    }

    .reasons {
      display: grid;
      gap: var(--space-2);
      margin-bottom: var(--space-6);
    }

    .reason {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      border-radius: var(--border-radius-md);
      background: rgba(255, 255, 255, 0.76);
      border: 1px solid rgba(255, 255, 255, 0.9);
      padding: var(--space-3);
      box-shadow: var(--shadow-sm);
      animation: rise 500ms var(--ease-out) both;
    }

    .reason:nth-child(2) { animation-delay: 70ms; }
    .reason:nth-child(3) { animation-delay: 120ms; }

    .reason-icon {
      width: 30px;
      height: 30px;
      border-radius: var(--border-radius-sm);
      background: var(--color-blue-light);
      color: var(--color-blue-dark);
      display: grid;
      place-items: center;
      font-size: 14px;
      flex-shrink: 0;
    }

    .reason-text {
      font-size: var(--text-sm);
      color: var(--color-text-primary);
      font-weight: var(--weight-medium);
    }

    .actions {
      display: grid;
      gap: var(--space-2);
    }

    .btn {
      border: none;
      border-radius: var(--border-radius-md);
      font-family: var(--font-sans);
      font-weight: var(--weight-bold);
      font-size: var(--text-md);
      padding: 13px var(--space-4);
      cursor: pointer;
      transition: transform var(--duration-fast) var(--ease-out), opacity var(--duration-fast) var(--ease-out);
      -webkit-tap-highlight-color: transparent;
    }

    .btn:active {
      transform: scale(0.98);
      opacity: 0.92;
    }

    .btn-primary {
      background: var(--color-blue);
      color: var(--color-blue-text);
    }

    .btn-primary:hover {
      background: var(--color-blue-mid);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.8);
      color: var(--color-text-primary);
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    .btn-quiet {
      background: transparent;
      color: var(--color-text-secondary);
    }

    .hint {
      margin-top: var(--space-3);
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: center;
    }

    .denied {
      background: rgba(253, 236, 234, 0.75);
      color: var(--color-danger-text);
      border: 1px solid rgba(192, 57, 43, 0.2);
      border-radius: var(--border-radius-md);
      font-size: var(--text-sm);
      padding: var(--space-3);
      margin-bottom: var(--space-4);
    }

    @media (max-width: 640px) {
      .content {
        padding: var(--space-6) var(--space-4) calc(var(--space-8) + env(safe-area-inset-bottom, 0px));
      }

      h2 {
        font-size: 24px;
      }
    }

    @keyframes rise {
      from { transform: translateY(8px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @keyframes drift {
      from { transform: translate(-10px, -6px) scale(1); }
      to { transform: translate(16px, 12px) scale(1.08); }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(0.95); opacity: 0.7; }
      50% { transform: scale(1.08); opacity: 1; }
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
      <div class="nebula" aria-hidden="true"></div>
      <div class="glow" aria-hidden="true"></div>

      <div class="content">
        <div class="chip">MOBILE-FIRST EXPERIENCE</div>
        <h2>Let 2bottles unlock your live meetup map</h2>
        <p>
          Your location is only used to calculate fair meeting points and live ETA between you and your partner.
          You can stop sharing any time.
        </p>

        ${denied ? html`
          <div class="denied">
            Location permission is currently blocked. Turn it on in browser site settings, then return to continue.
          </div>
        ` : ''}

        <div class="reasons">
          <div class="reason">
            <div class="reason-icon">⊙</div>
            <div class="reason-text">Find balanced midpoint venues in seconds</div>
          </div>
          <div class="reason">
            <div class="reason-icon">↔</div>
            <div class="reason-text">Live route updates for both people</div>
          </div>
          <div class="reason">
            <div class="reason-icon">🔒</div>
            <div class="reason-text">Secure peer-to-peer session flow</div>
          </div>
        </div>

        <div class="actions">
          <button class="btn btn-primary" @click=${() => this._emit('request-location')}>Enable Live Location</button>
          ${this.canInstall ? html`
            <button class="btn btn-secondary" @click=${() => this._emit('request-install')}>Install 2bottles App</button>
          ` : ''}
          <button class="btn btn-quiet" @click=${() => this._emit('continue-manual')}>Continue with manual address search</button>
        </div>

        <div class="hint">Tip: install to your home screen for an app-like GPS experience.</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'location-permission-dialog': LocationPermissionDialog;
  }
}
