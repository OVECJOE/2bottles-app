/**
 * <partner-agree-refuse> — partner sees the suggested venue
 * and can chat before agreeing or asking for a different spot.
 * Chat is enabled here per the flow diagram.
 * Agreeing → session-link. Refusing → back to select-rendezvous.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import type { ChatMessage } from '../../types/index.js';

const MOCK_PARTNER_REPLIES = [
    'Works for me! 👍',
    'How far is it from the bus stop?',
    'Sounds good, heading there now',
    'Ok let\'s meet there!',
];

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
      padding: var(--space-3) var(--space-5) env(safe-area-inset-bottom, var(--space-6));
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

    .msg-avatar {
      width: 24px; height: 24px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: var(--weight-bold); font-size: 9px; flex-shrink: 0;
    }

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

    @state() private _messages: ChatMessage[] = [];
    @state() private _draft = '';

    @query('.chat-messages') private _chatEl!: HTMLElement;

    override connectedCallback() {
        super.connectedCallback();
        // Seed with a partner message after a short delay
        setTimeout(() => {
            this._addPartnerMessage(MOCK_PARTNER_REPLIES[0]);
        }, 1200);
    }

    private _addPartnerMessage(text: string) {
        const msg: ChatMessage = {
            id: crypto.randomUUID(),
            senderId: sessionStore.partner?.id ?? 'partner',
            text,
            timestamp: Date.now(),
        };
        this._messages = [...this._messages, msg];
        sessionStore.addMessage(msg);
        this._scrollToBottom();
    }

    private _send() {
        const text = this._draft.trim();
        if (!text) return;

        const msg: ChatMessage = {
            id: crypto.randomUUID(),
            senderId: 'me',
            text,
            timestamp: Date.now(),
        };
        this._messages = [...this._messages, msg];
        sessionStore.addMessage(msg);
        this._draft = '';
        this._scrollToBottom();

        // Simulate partner reply
        const reply = MOCK_PARTNER_REPLIES[Math.floor(Math.random() * MOCK_PARTNER_REPLIES.length)];
        setTimeout(() => this._addPartnerMessage(reply), 1500 + Math.random() * 1000);
    }

    private _scrollToBottom() {
        requestAnimationFrame(() => {
            if (this._chatEl) this._chatEl.scrollTop = this._chatEl.scrollHeight;
        });
    }

    private _agree() {
        sessionStore.setPartnerStatus('agreed');
        sessionStore.setSessionStatus('agreed');
        uiStore.goToSessionLink();
    }

    private _refuse() {
        sessionStore.setPartnerStatus('refused');
        sessionStore.clearVenueSelection();
        uiStore.goToSelectVenue();
    }

    override render() {
        const p = sessionStore.partner;
        const v = sessionStore.selectedVenue;

        return html`
      ${v ? html`
        <div class="venue-pill">
          <span>${v.emoji}</span>
          <div>
            <div class="venue-pill-text">${v.name}</div>
            <div class="venue-pill-sub">${v.etaMinutesFromYou} min each</div>
          </div>
        </div>
      ` : ''}

      <div class="sheet">
        <div class="handle"></div>

        <div class="partner-header">
          <div class="avatar" style="background:${p?.avatarBg};color:${p?.avatarColor}">${p?.initials}</div>
          <span class="partner-name">${p?.name ?? 'Partner'}</span>
          <span class="online-badge">● Online</span>
        </div>

        <div class="chat-messages">
          ${this._messages.map(m => {
            const isMe = m.senderId === 'me';
            return html`
              <div class="msg ${isMe ? 'mine' : ''}">
                ${!isMe ? html`
                  <div class="msg-avatar" style="background:${p?.avatarBg};color:${p?.avatarColor}">${p?.initials}</div>
                ` : ''}
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
          <button class="btn-agree"  @click=${this._agree}>✓ Agree</button>
          <button class="btn-refuse" @click=${this._refuse}>↩ Different spot</button>
        </div>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'partner-agree-refuse': PartnerAgreeRefuse; }
}