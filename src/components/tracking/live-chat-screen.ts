import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import { p2pService } from '../../services/p2p.service.js';
import '../ui/screen-shell.js';

@customElement('live-chat')
export class LiveChatScreen extends LitElement {
    static override styles = css`
    :host { display: flex; flex-direction: column; height: 100vh; background: #ffffff; overflow: hidden; }
    screen-shell { display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0; }

    .chat-container {
        display: flex; flex-direction: column; flex: 1; height: 100%; min-height: 0;
        background: var(--color-sheet-bg);
    }

    .header {
        padding: var(--space-4) var(--space-5);
        display: flex; align-items: center; gap: var(--space-3);
        border-bottom: 1px solid rgba(0,0,0,0.05);
        background: #fff;
    }
    .back-btn {
        background: none; border: none; font-size: 20px; cursor: pointer; padding: 0;
    }
    .avatar {
        width: 38px; height: 38px; border-radius: 50%;
        background: var(--color-partner); color: #fff;
        display: flex; align-items: center; justify-content: center;
        font-weight: var(--weight-bold);
    }
    .info { flex: 1; }
    .name { font-weight: var(--weight-bold); font-size: var(--text-md); }
    .status { font-size: var(--text-xs); color: var(--color-green-text); }
 
    .messages {
        flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-5);
        display: flex; flex-direction: column; gap: var(--space-3);
        background: var(--color-sheet-bg);
        scroll-behavior: smooth;
    }

    .msg { display: flex; align-items: flex-end; gap: var(--space-2); }
    .msg.mine { flex-direction: row-reverse; }

    .bubble {
        max-width: 80%; padding: var(--space-3) var(--space-4);
        border-radius: 18px; font-size: var(--text-md); line-height: 1.4;
        overflow-wrap: break-word; word-break: break-word;
    }
    .bubble.them { background: #E9EDEF; color: var(--color-text-primary); border-bottom-left-radius: 4px; }
    .bubble.mine { background: var(--color-blue); color: #fff; border-bottom-right-radius: 4px; box-shadow: 0 2px 4px rgba(77,114,152,0.2); }

    .input-area {
        padding: var(--space-4) var(--space-5) calc(env(safe-area-inset-bottom, 0px) + var(--space-4));
        background: #fff; border-top: 1px solid rgba(0,0,0,0.05);
        display: flex; gap: var(--space-3); align-items: center;
    }
    .input {
        flex: 1; padding: 12px 16px; border-radius: 24px;
        border: 1px solid #ddd; font-family: inherit; font-size: var(--text-md); outline: none;
    }
    .input:focus { border-color: var(--color-blue); }
    .send {
        width: 44px; height: 44px; border-radius: 50%;
        background: var(--color-blue); color: #fff;
        border: none; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: transform 0.2s;
    }
    .send:active { transform: scale(0.9); }
    `;

    @state() private _draft = '';
    @query('.messages') private _messagesEl!: HTMLElement;

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

    private _scrollToBottom() {
        requestAnimationFrame(() => {
            if (this._messagesEl) this._messagesEl.scrollTop = this._messagesEl.scrollHeight;
        });
    }

    private _send() {
        const text = this._draft.trim();
        if (!text) return;

        const timestamp = Date.now();
        sessionStore.addMessage({
            id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
            senderId: 'me',
            text,
            timestamp
        });

        p2pService.send({ type: 'chat:message', text, timestamp });
        this._draft = '';
    }

    override render() {
        const messages = sessionStore.chatMessages;
        const pName = sessionStore.partnerName || 'Partner';

        return html`
        <screen-shell screen='live-chat'>
        <div class="chat-container">
            <header class="header">
                <button class="back-btn" @click=${() => uiStore.goToLiveTracking()}>←</button>
                <div class="avatar">${pName[0].toUpperCase()}</div>
                <div class="info">
                    <div class="name">${pName}</div>
                    <div class="status">En route to meetup</div>
                </div>
            </header>

            <div class="messages">
                ${messages.map(m => {
                    const isMe = m.senderId === 'me';
                    return html`
                    <div class="msg ${isMe ? 'mine' : ''}">
                        <div class="bubble ${isMe ? 'mine' : 'them'}">${m.text}</div>
                    </div>
                    `;
                })}
            </div>

            <div class="input-area">
                <input class="input" 
                    type="text" 
                    placeholder="Type a message..." 
                    .value=${this._draft}
                    @input=${(e: any) => this._draft = e.target.value}
                    @keydown=${(e: any) => { if (e.key === 'Enter') this._send(); }}
                />
                <button class="send" @click=${this._send} aria-label="Send message">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </div>
        </div>
        </screen-shell>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'live-chat': LiveChatScreen; }
}
