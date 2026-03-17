import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import type { ChatMessage } from '../../types/index.js';
import '../ui/screen-shell.js';

@customElement('partner-agree-refuse')
export class PartnerAgreeRefuse extends LitElement {
    static override styles = css`
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
      flex: 1; overflow-y: auto;
      display: flex; flex-direction: column; gap: var(--space-2);
      padding-bottom: var(--space-2);
    }

    .msg { display: flex; align-items: flex-end; gap: var(--space-2); }
    .msg.mine { flex-direction: row-reverse; }

    .bubble {
      max-width: 72%; padding: var(--space-2) var(--space-3);
      border-radius: 16px; font-size: var(--text-sm); line-height: var(--line-height-base);
    }
    .bubble.them { background: rgba(0,0,0,0.07); color: var(--color-text-primary); border-bottom-left-radius: 4px; }
    .bubble.mine { background: var(--color-blue); color: #fff; border-bottom-right-radius: 4px; }

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

    .action-row { display: flex; gap: var(--space-2); margin-top: var(--space-2); flex-shrink: 0; }

    .btn-agree {
      flex: 1; padding: 13px;
      background: var(--color-green); color: var(--color-green-text);
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer;
      transition: background var(--duration-fast), transform var(--duration-fast);
    }
    .btn-agree:hover { background: var(--color-green-mid); }
    .btn-agree:active { transform: scale(0.98); }

    .btn-refuse {
      flex: 1; padding: 13px;
      background: transparent; color: var(--color-blue);
      border: 1.5px solid var(--color-blue); border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-sm);
      font-weight: var(--weight-medium); cursor: pointer;
      transition: background var(--duration-fast);
    }
    .btn-refuse:hover { background: var(--color-blue-light); }
  `;

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

    private _refuse() {
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
            <span class="online-badge">● Online</span>
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
            <button class="btn-agree" ?disabled=${sessionStore.ownAgreed} @click=${this._agree}>
                ${sessionStore.ownAgreed ? '✓ Waiting for partner' : '✓ Agree'}
            </button>
            <button class="btn-refuse" @click=${this._refuse}>↩ Different spot</button>
            </div>
        </div>
      </screen-shell>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'partner-agree-refuse': PartnerAgreeRefuse; }
}