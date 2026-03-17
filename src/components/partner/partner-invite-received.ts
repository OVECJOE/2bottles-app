import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import type { BeforeEnterObserver, RouterLocation } from '@vaadin/router';
import '../ui/screen-shell.js';

@customElement('partner-invite-received')
export class PartnerInviteReceived extends LitElement implements BeforeEnterObserver {
  @state() private _connecting = false;
  @state() private _accepting = false;
  @state() private _name = '';

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

    .host-info {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        background: rgba(0,0,0,0.04);
        padding: var(--space-4);
        border-radius: var(--border-radius-md);
        margin-bottom: var(--space-6);
    }
    .avatar {
        width: 44px; height: 44px;
        background: var(--color-partner);
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: var(--weight-bold);
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

    .btn-ghost {
      width: 100%; padding: 12px; margin-top: var(--space-3);
      background: transparent; color: var(--color-text-muted);
      border: none; font-size: var(--text-sm); cursor: pointer;
    }

    .name-input {
        box-sizing: border-box;
        width: 100%; padding: 12px; margin-bottom: var(--space-4);
        border: 1px solid rgba(0,0,0,0.1); border-radius: var(--border-radius-md);
        font-family: var(--font-sans); font-size: var(--text-md);
        background: var(--color-sheet-bg);
    }
  `;

  async onBeforeEnter(location: RouterLocation) {
    const peerId = location.params.peerId as string;
    if (peerId) {
      console.log('[PartnerInviteReceived] Extracted peerId:', peerId);
      await this._handleAutoJoin(peerId);
    }
  }

  private async _handleAutoJoin(peerId: string) {
    // If already in THIS session, don't re-join
    if (sessionStore.session?.id === peerId) return;

    this._connecting = true;
    uiStore.setLoading(true);
    try {
      if (sessionStore.session) {
        console.log('[PartnerInviteReceived] Clearing old session.');
        await sessionStore.endSession();
      }
      await sessionStore.joinSession(peerId);
      await p2pService.connect(peerId);
      console.log('[PartnerInviteReceived] Join successful.');
    } catch (err) {
      console.error('[PartnerInviteReceived] Join failed:', err);
      uiStore.showToast('Could not connect to partner.');
    } finally {
      this._connecting = false;
      uiStore.setLoading(false);
    }
  }

  private async _accept() {
    this._accepting = true;
    try {
      // 1. Share info
      if (this._name) {
        sessionStore.setOwnName(this._name);
        p2pService.broadcastUserInfo(this._name);
      }

      // 2. Peer accepts -> send status to host
      p2pService.send({ type: 'partner:status', status: 'accepted' });

      // 3. Start watching location
      locationStore.startWatching();

      // 4. Update local state
      sessionStore.setPartnerStatus('accepted');

      // Host will receive 'accepted' and navigate to venue selection
      // Joiner stays here until Host picks a venue and sends 'session:venue'
      // UPDATE: To smooth the flow, we now navigate directly to the selection screen
      uiStore.showToast('Joined! Waiting for host to pick a spot.');
      uiStore.goToSelectVenue();
    } finally {
      // Keep it disabled, navigation or state change will handle the rest
      // but in case of some weird async delay, we don't want to re-enable too soon
    }
  }

  private _decline() {
    p2pService.send({ type: 'partner:status', status: 'rejected' });
    p2pService.disconnect();
    sessionStore.endSession();
    uiStore.goHome();
  }

  override render() {
    return html`
      <screen-shell screen='partner-notified'>
        <div class="sheet">
          <div class="handle"></div>
          <div class="title">Join Rendezvous</div>
          <div class="subtitle">A partner has invited you to meet halfway.</div>

          <div class="host-info">
            <div class="avatar">${sessionStore.partnerName ? sessionStore.partnerName[0].toUpperCase() : '?'}</div>
            <div>
                <div style="font-weight:var(--weight-bold)">${sessionStore.partnerName || 'Partner'}</div>
                <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Awaiting your response</div>
            </div>
          </div>

          <input
            type="text"
            class="name-input"
            placeholder="Your Name (Required, 2+ chars)"
            .value=${this._name}
            @input=${(e: any) => this._name = e.target.value}
          />
 
          <button class="btn-primary" @click=${this._accept} ?disabled=${this._connecting || this._accepting || this._name.trim().length < 2}>
            ${this._connecting ? 'Connecting...' : this._accepting ? 'Joining...' : 'Accept Invite'}
          </button>
          <button class="btn-ghost" @click=${this._decline} ?disabled=${this._connecting || this._accepting}>
            Decline
          </button>
        </div>
      </screen-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'partner-invite-received': PartnerInviteReceived; }
}