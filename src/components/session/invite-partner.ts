/**
 * <invite-partner> — host-side invite sharing screen.
 *
 * Responsibilities:
 *   show live session join link
 *   trigger native share or clipboard fallback
 *   allow cancelling the active session
 */
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import { copyText } from '../../services/clipboard.service.js';
import { sharedStyles } from '../../styles/shared-styles.js';
import '../ui/screen-shell.js';

@customElement('invite-partner')
export class InvitePartner extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host { display: block; }

    .sheet {
      background: var(--invite-sheet-bg);
        border-top: 1px solid rgba(0,0,0,0.05);
    }

    .invite-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: var(--space-4) 0;
    }

    .radar-container {
        position: relative;
        width: 120px;
        height: 120px;
        margin-bottom: var(--space-6);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .radar-circle {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: var(--color-blue);
        opacity: 0.15;
        animation: radar-pulse 2.5s infinite var(--ease-out);
    }

    .radar-circle:nth-child(2) { animation-delay: 0.8s; }
    .radar-circle:nth-child(3) { animation-delay: 1.6s; }

    .radar-core {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: var(--color-surface);
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        z-index: 1;
    }

    @keyframes radar-pulse {
        0% { transform: scale(0.5); opacity: 0.8; }
        100% { transform: scale(2); opacity: 0; }
    }

    .link-card {
        width: 100%;
      background: var(--color-sheet-bg);
        border-radius: var(--border-radius-lg);
        padding: var(--space-4);
        border: 1px solid var(--glass-border);
        box-shadow: var(--glass-shadow);
        backdrop-filter: blur(14px) saturate(135%);
        -webkit-backdrop-filter: blur(14px) saturate(135%);
        margin: var(--space-4) 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
    }

    .link-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        color: var(--color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.1em;
    }

    .link-value-container {
      background: var(--color-surface);
        padding: var(--space-3) var(--space-4);
        border-radius: var(--border-radius-md);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(10px) saturate(130%);
      -webkit-backdrop-filter: blur(10px) saturate(130%);
    }

    .link-value {
        font-family: var(--font-mono);
        font-size: var(--text-sm);
        color: var(--color-blue-dark);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
        text-align: left;
    }

    .waiting-indicator {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-top: var(--space-6);
        color: var(--color-text-muted);
        font-size: var(--text-sm);
        font-weight: var(--weight-medium);
    }

    .waiting-dot {
        width: 6px;
        height: 6px;
        background: var(--color-blue);
        border-radius: 50%;
        animation: dot-blink 1.4s infinite;
    }
    .waiting-dot:nth-child(2) { animation-delay: 0.2s; }
    .waiting-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes dot-blink {
        0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
        40% { opacity: 1; transform: scale(1.1); }
    }
  `];

  private async _shareLink() {
    const link = sessionStore.session?.link ?? window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({
          title: '2bottles Rendezvous',
          text: 'Join me for a rendezvous!',
          url: link
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      const ok = await copyText(link);
      uiStore.showToast(ok ? 'Link copied to clipboard' : 'Unable to copy automatically. Please copy the link manually.');
    }
  }

  override render() {
    const link = sessionStore.session?.link ?? 'Initializing...';

    return html`
      <screen-shell screen='invite-partner'>
        <div class="sheet">
          <div class="handle"></div>
          
          <div class="invite-container">
              <div class="radar-container">
                  <div class="radar-circle"></div>
                  <div class="radar-circle"></div>
                  <div class="radar-circle"></div>
                  <div class="radar-core">🤝</div>
              </div>

              <div class="title">Invite your partner</div>
              <div class="subtitle">Share this link with whoever you're meeting up with to start tracking in real-time.</div>

              <div class="link-card">
                  <div class="link-header">
                      <span>🔗 Meeting Link</span>
                  </div>
                  <div class="link-value-container">
                      <span class="link-value">${link}</span>
                  </div>
                  <button class="btn btn-primary" @click=${this._shareLink}>
                      Copy & Share Link
                  </button>
              </div>

              <div class="waiting-indicator">
                  <div class="waiting-dot"></div>
                  <div class="waiting-dot"></div>
                  <div class="waiting-dot"></div>
                  <span>Waiting for partner to join...</span>
              </div>
          </div>

          <button class="btn btn-ghost" @click=${this._cancel}>
            Cancel Session
          </button>
        </div>
      </screen-shell>
    `;
  }

  private async _cancel() {
    const confirmed = await uiStore.confirm({
      title: 'Cancel Session?',
      message: 'This will end the current rendezvous and stop location sharing.',
      confirmLabel: 'Yes, Cancel',
      cancelLabel: 'Keep Session'
    });

    if (confirmed) {
      p2pService.endSessionForAll();
      sessionStore.endSession();
      uiStore.goHome(true);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'invite-partner': InvitePartner; }
}