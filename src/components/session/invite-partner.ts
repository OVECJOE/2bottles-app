import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import '../ui/screen-shell.js';

@customElement('invite-partner')
export class InvitePartner extends LitElement {
    static override styles = css`
    :host { display: block; }

    .sheet {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) calc(env(safe-area-inset-bottom, var(--space-8)));
      z-index: var(--z-sheet);
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-4); }

    .title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); }
    .subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-6); }

    .link-box {
      background: rgba(0,0,0,0.04);
      border: 1px dashed rgba(0,0,0,0.15);
      border-radius: var(--border-radius-md);
      padding: var(--space-4);
      margin-bottom: var(--space-6);
      text-align: center;
    }

    .link-text {
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      color: var(--color-blue);
      word-break: break-all;
      display: block;
      margin-bottom: var(--space-3);
    }

    .btn-primary {
      width: 100%; padding: 14px;
      background: var(--color-blue); color: #fff;
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer;
      transition: background var(--duration-fast), transform var(--duration-fast);
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
    }
    .btn-primary:hover { background: var(--color-blue-mid); }
    .btn-primary:active { transform: scale(0.98); }

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

    .btn-ghost {
        display: block; width: 100%; padding: 12px; margin-top: var(--space-4);
        background: transparent; color: var(--color-text-muted);
        border: none; font-size: var(--text-sm); cursor: pointer;
        text-align: center;
    }
    .btn-ghost:hover { color: var(--color-text-primary); }
  `;

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
            <button class="btn-primary" @click=${this._shareLink}>
              <span>Copy & Share Link</span>
            </button>
          </div>

          <div class="waiting">
            <div class="dot"></div>
            <span>Waiting for partner to join...</span>
          </div>

          <button class="btn-ghost" @click=${this._cancel}>
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