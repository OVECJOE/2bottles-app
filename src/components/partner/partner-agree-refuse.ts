import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import { sharedStyles } from '../../styles/shared-styles.js';
import type { ChatMessage } from '../../types/index.js';
import '../ui/screen-shell.js';

@customElement('partner-agree-refuse')
export class PartnerAgreeRefuse extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host { display: block; }

    .venue-pill {
      position: absolute;
      top: calc(var(--map-status-bar-height) + var(--space-2));
      left: 50%; transform: translateX(-50%);
      z-index: var(--z-topbar);
      background: rgba(26,37,48,0.88);
      border-radius: var(--border-radius-pill);
      padding: var(--space-2) var(--space-4);
      display: flex; align-items: center; gap: var(--space-2);
      white-space: nowrap;
      box-shadow: var(--shadow-md);
      animation: slide-down var(--duration-base) var(--ease-out) both;
    }
    .venue-pill-text { font-size: var(--text-sm); font-weight: var(--weight-medium); color: #fff; }
    .venue-pill-sub  { font-size: var(--text-xs); color: var(--color-text-on-dark-muted); }

    .sheet {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) calc(env(safe-area-inset-bottom, var(--space-6)));
      z-index: var(--z-sheet);
      max-height: 68vh;
      display: flex; flex-direction: column;
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-3); flex-shrink: 0; }

    .partner-header {
      display: flex; align-items: center; gap: var(--space-3);
      margin-bottom: var(--space-3); flex-shrink: 0;
    }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--color-partner); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: var(--weight-bold); font-size: var(--text-xs); flex-shrink: 0;
    }
    .partner-name { font-size: var(--text-md); font-weight: var(--weight-medium); flex: 1; }
    .online-badge {
      font-size: 10px; font-weight: var(--weight-bold);
      background: var(--color-green); color: var(--color-green-text);
      padding: 2px 8px; border-radius: var(--border-radius-pill);
    }

    .chat-messages {
      flex: 1; overflow-y: auto; overflow-x: hidden;
      display: flex; flex-direction: column; gap: var(--space-2);
      padding-bottom: var(--space-2);
    }

    .msg { display: flex; align-items: flex-end; gap: var(--space-2); }
    .msg.mine { flex-direction: row-reverse; }

    .bubble {
      max-width: 72%; padding: var(--space-2) var(--space-3);
      border-radius: 16px; font-size: var(--text-sm); line-height: var(--line-height-base);
      overflow-wrap: break-word; word-break: break-word;
    }
    .bubble.them { background: #E9EDEF; color: var(--color-text-primary); border-bottom-left-radius: 4px; }
    .bubble.mine { background: var(--color-blue); color: #fff; border-bottom-right-radius: 4px; box-shadow: 0 2px 4px rgba(77,114,152,0.2); }

    .chat-input-row {
      display: flex; gap: var(--space-2); align-items: center;
      padding: var(--space-3) 0 var(--space-2);
      border-top: var(--border-width) solid var(--border-color);
      flex-shrink: 0;
    }
    .chat-input {
      flex: 1; padding: var(--space-2) var(--space-3);
      border: 1px solid rgba(0,0,0,0.1); border-radius: var(--border-radius-pill);
      font-family: var(--font-sans); font-size: var(--text-sm);
      background: rgba(0,0,0,0.04); color: var(--color-text-primary); outline: none;
    }
    .chat-input:focus { border-color: var(--color-blue); }
    .send-btn {
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--color-blue); color: #fff;
      border: none; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .send-btn:hover { background: var(--color-blue-mid); }

    .action-row { margin-top: var(--space-4); }
  `];

  @state() private _draft = '';
  @query('.chat-messages') private _chatEl!: HTMLElement;

  private _unsub?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this._unsub = sessionStore.subscribe(() => {
      this.requestUpdate();
      this._scrollToBottom();
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
  }

  private _send() {
    const text = this._draft.trim();
    if (!text) return;

    const timestamp = Date.now();
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      senderId: 'me',
      text,
      timestamp,
    };

    sessionStore.addMessage(msg);
    this._draft = '';
    (this.renderRoot.querySelector('.chat-input') as HTMLInputElement).value = ''; // Bug 43: Clear physical input

    // Broadcast via P2P
    p2pService.send({ type: 'chat:message', text, timestamp });

    this._scrollToBottom();
  }

  private _scrollToBottom() {
    requestAnimationFrame(() => {
      if (this._chatEl) this._chatEl.scrollTop = this._chatEl.scrollHeight;
    });
  }

  private _agree() {
    if (sessionStore.ownAgreed) return; // Bug 44: Guard against double-tap
    sessionStore.setOwnAgreed(true);
    p2pService.broadcastAgreement();

    if (sessionStore.isVenueConfirmed) {
      uiStore.showToast("Both agreed! Starting live tracking.");
      uiStore.goToLiveTracking();
      p2pService.broadcastSessionStatus('live');
    } else {
      uiStore.showToast(`Waiting for ${sessionStore.partnerName || 'partner'} to agree...`);
    }
  }

  private async _refuse() {
    const confirmed = await uiStore.confirm({
      title: 'Change Meetup Spot?',
      message: 'This will reset the agreement for both you and your partner.',
      confirmLabel: 'Yes, Change',
      cancelLabel: 'Stay Here'
    });

    if (!confirmed) return; // Bug 48: Confirmation

    sessionStore.setOwnAgreed(false);
    sessionStore.setPartnerAgreed(false);
    p2pService.broadcastReset();
    sessionStore.clearVenueSelection();
    uiStore.goToSelectVenue();
  }

  override render() {
    const v = sessionStore.selectedVenue;
    const messages = sessionStore.chatMessages;

    return html`
      <screen-shell screen='partner-notified'>
        ${v ? html`
            <div class="venue-pill">
            <span>${v.emoji}</span>
            <div>
                <div class="venue-pill-text">${v.name}</div>
                <div class="venue-pill-sub">${v.address}</div>
            </div>
            </div>
        ` : ''}

        <div class="sheet">
            <div class="handle"></div>

            <div class="partner-header">
            <div class="avatar">${sessionStore.partnerName ? sessionStore.partnerName[0].toUpperCase() : '?'}</div>
            <span class="partner-name">${sessionStore.partnerName || 'Partner'}</span>
            <span class="online-badge" style="background: ${uiStore.isPartnerOnline ? 'var(--color-green)' : '#ccc'}; color: ${uiStore.isPartnerOnline ? 'var(--color-green-text)' : '#666'}">
                ● ${uiStore.isPartnerOnline ? 'Online' : 'Offline'}
            </span>
            </div>

            <div class="chat-messages">
            ${messages.map((m: ChatMessage) => {
      const isMe = m.senderId === 'me';
      return html`
                <div class="msg ${isMe ? 'mine' : ''}">
                    <div class="bubble ${isMe ? 'mine' : 'them'}">${m.text}</div>
                </div>
                `;
    })}
            </div>

            <div class="chat-input-row">
            <input
                class="chat-input"
                type="text"
                placeholder="Message…"
                .value=${this._draft}
                @input=${(e: InputEvent) => { this._draft = (e.target as HTMLInputElement).value; }}
                @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter') this._send(); }}
            />
            <button class="send-btn" @click=${this._send}>↑</button>
            </div>

            <div class="action-row">
              <button class="btn btn-primary btn-agree" ?disabled=${sessionStore.ownAgreed} @click=${this._agree}>
                ${sessionStore.ownAgreed ? 'Waiting for partner…' : 'Agree & Meet Here'}
              </button>
              <button class="btn btn-ghost btn-refuse" @click=${this._refuse}>
                No, change spot
              </button>
            </div>
        </div>
      </screen-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'partner-agree-refuse': PartnerAgreeRefuse; }
}