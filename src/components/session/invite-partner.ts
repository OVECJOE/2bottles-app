import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import { sharedStyles } from '../../styles/shared-styles.js';
import '../ui/screen-shell.js';

@customElement('invite-partner')
export class InvitePartner extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host { display: block; }

    /* Local overrides */
    .btn-primary { margin-top: var(--space-6); }
    .waiting {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-text-muted);
        margin-top: var(--space-4);
    }
    .dot {
        width: 8px; height: 8px;
        background: var(--color-blue);
        border-radius: 50%;
        animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
        0% { transform: scale(0.8); opacity: 0.5; }
        50% { transform: scale(1.2); opacity: 1; }
        100% { transform: scale(0.8); opacity: 0.5; }
    }

    .link-box {
        background: rgba(0,0,0,0.04);
        padding: var(--space-4);
        border-radius: var(--border-radius-md);
        margin-bottom: var(--space-4);
    }
    .link-text {
        display: block;
        font-family: monospace;
        font-size: var(--text-xs);
        color: var(--color-text-muted);
        margin-bottom: var(--space-3);
        word-break: break-all;
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
      await navigator.clipboard.writeText(link);
      uiStore.showToast('Link copied to clipboard');
    }
  }

  override render() {
    const link = sessionStore.session?.link ?? 'Initializing...';

    return html`
      <screen-shell screen='invite-partner'>
        <div class="sheet">
          <div class="handle"></div>
          <div class="title">Invite your partner</div>
          <div class="subtitle">Share this link with whoever you're meeting up with.</div>

          <div class="link-box">
            <span class="link-text">${link}</span>
            <button class="btn btn-primary" @click=${this._shareLink}>
              <span>Copy & Share Link</span>
            </button>
          </div>

          <div class="waiting">
            <div class="dot"></div>
            <span>Waiting for partner to join...</span>
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
      sessionStore.endSession();
      uiStore.goHome();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap { 'invite-partner': InvitePartner; }
}