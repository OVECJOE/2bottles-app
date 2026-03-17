/**
 * <invite-partner> — contact picker and invite sender.
 * In production, contacts come from the API. Here we use
 * mock data to demonstrate the full interaction model.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore } from '../../store/index.js';
import type { Partner } from '../../types/index.js';

const MOCK_CONTACTS = [
    { id: 'c1', name: 'Tunde Koya', initials: 'TK', avatarBg: '#dbe8f4', avatarColor: '#2e4a63', lastSeen: '5 min ago' },
    { id: 'c2', name: 'Amara Osei', initials: 'AO', avatarBg: '#fdf4e8', avatarColor: '#7a4a10', lastSeen: '1 hr ago' },
    { id: 'c3', name: 'Fatima Ngozi', initials: 'FN', avatarBg: '#D0EFB1', avatarColor: '#2d5a0e', lastSeen: 'Yesterday' },
    { id: 'c4', name: 'Chidi Adeyemi', initials: 'CA', avatarBg: '#f0e8f8', avatarColor: '#5a2e8a', lastSeen: '2 days ago' },
    { id: 'c5', name: 'Ngozi Bello', initials: 'NB', avatarBg: '#fde8e8', avatarColor: '#8a2e2e', lastSeen: '3 days ago' },
];

@customElement('invite-partner')
export class InvitePartner extends LitElement {
    static override styles = css`
    :host { display: block; }

    .status-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: var(--map-status-bar-height);
      display: flex; align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-5);
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      color: rgba(30,30,30,0.7); z-index: var(--z-topbar);
    }

    .back-btn {
      position: absolute;
      top: var(--map-status-bar-height); left: var(--space-4);
      z-index: var(--z-topbar);
      background: rgba(255,255,255,0.95);
      border: none; border-radius: var(--border-radius-pill);
      padding: var(--space-2) var(--space-3);
      font-family: var(--font-sans); font-size: var(--text-sm);
      font-weight: var(--weight-medium); color: var(--color-text-primary);
      cursor: pointer; display: flex; align-items: center; gap: var(--space-1);
      box-shadow: var(--shadow-sm);
    }

    .sheet {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: var(--space-3) var(--space-5) env(safe-area-inset-bottom, var(--space-8));
      z-index: var(--z-sheet);
      max-height: 75vh;
      display: flex; flex-direction: column;
      animation: slide-up var(--duration-sheet) var(--ease-out) both;
    }

    .handle { width: 36px; height: 4px; background: rgba(0,0,0,0.12); border-radius: var(--border-radius-pill); margin: 0 auto var(--space-4); flex-shrink: 0; }

    .title { font-size: var(--text-xl); font-weight: var(--weight-bold); margin-bottom: var(--space-1); flex-shrink: 0; }
    .subtitle { font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-4); flex-shrink: 0; }

    .search-wrap {
      position: relative; margin-bottom: var(--space-3); flex-shrink: 0;
    }
    .search-icon {
      position: absolute; left: var(--space-3); top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-muted); font-size: 14px; pointer-events: none;
    }
    .search-input {
      box-sizing: border-box;
      width: 100%; padding: var(--space-3) var(--space-3) var(--space-3) 36px;
      border: 1px solid rgba(0,0,0,0.1); border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      background: rgba(0,0,0,0.04); color: var(--color-text-primary); outline: none;
      transition: border-color var(--duration-fast);
    }
    .search-input:focus { border-color: var(--color-blue); }
    .search-input::placeholder { color: var(--color-text-muted); }

    .section-label {
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      color: var(--color-text-muted); letter-spacing: 0.8px;
      text-transform: uppercase; margin-bottom: var(--space-2); flex-shrink: 0;
    }

    .contacts { overflow-y: auto; flex: 1; }

    .contact {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3) var(--space-2);
      border-radius: var(--border-radius-md);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .contact:hover { background: rgba(0,0,0,0.04); }
    .contact.selected { background: rgba(77,114,152,0.07); }

    .avatar {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: var(--weight-bold); font-size: var(--text-sm); flex-shrink: 0;
    }

    .contact-info { flex: 1; min-width: 0; }
    .contact-name { font-size: var(--text-md); font-weight: var(--weight-medium); color: var(--color-text-primary); }
    .contact-meta { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px; }

    .invite-chip {
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      background: var(--color-blue); color: #fff;
      padding: 4px 12px; border-radius: var(--border-radius-pill);
    }

    .btn-primary {
      width: 100%; padding: 14px; margin-top: var(--space-3);
      background: var(--color-blue); color: #fff;
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-md);
      font-weight: var(--weight-bold); cursor: pointer; flex-shrink: 0;
      transition: background var(--duration-fast), transform var(--duration-fast);
      display: flex; align-items: center; justify-content: center; gap: var(--space-2);
    }
    .btn-primary:hover { background: var(--color-blue-mid); }
    .btn-primary:active { transform: scale(0.98); }
    .btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-link {
      width: 100%; padding: 12px; margin-top: var(--space-2);
      background: rgba(77,114,152,0.08); color: var(--color-blue);
      border: none; border-radius: var(--border-radius-md);
      font-family: var(--font-sans); font-size: var(--text-sm);
      font-weight: var(--weight-medium); cursor: pointer; flex-shrink: 0;
    }
    .btn-link:hover { background: rgba(77,114,152,0.14); }
  `;

    @state() private _query = '';
    @state() private _selectedId: string | null = null;
    @state() private _loading = false;

    private get _filtered() {
        const q = this._query.toLowerCase();
        return MOCK_CONTACTS.filter(c => c.name.toLowerCase().includes(q));
    }

    private _select(id: string) {
        this._selectedId = this._selectedId === id ? null : id;
    }

    private async _sendInvite() {
        const contact = MOCK_CONTACTS.find(c => c.id === this._selectedId);
        if (!contact) return;

        this._loading = true;
        uiStore.setLoading(true);

        try {
            await new Promise(r => setTimeout(r, 800));

            const partner: Partner = {
                id: contact.id,
                name: contact.name,
                initials: contact.initials,
                avatarBg: contact.avatarBg,
                avatarColor: contact.avatarColor,
                status: 'invited',
                location: null,
                etaMinutes: null,
            };
            sessionStore.setPartner(partner);
            uiStore.goToPartnerNotified();
        } finally {
            this._loading = false;
            uiStore.setLoading(false);
        }
    }

    private async _shareLink() {
        const link = sessionStore.session?.link ?? '2bottles.app/s/…';
        if (navigator.share) {
            await navigator.share({ title: '2bottles', text: 'Meet me halfway?', url: `https://${link}` });
        } else {
            await navigator.clipboard.writeText(`https://${link}`);
            uiStore.showToast('Link copied to clipboard');
        }
    }

    override render() {
        return html`
      <div class="status-bar">
        <span>${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span>●●●</span>
      </div>

      <button class="back-btn" @click=${() => uiStore.goHome()}>← Back</button>

      <div class="sheet">
        <div class="handle"></div>
        <div class="title">Invite a Partner</div>
        <div class="subtitle">They'll receive a push notification to join</div>

        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input
            class="search-input"
            type="text"
            placeholder="Search contacts…"
            .value=${this._query}
            @input=${(e: InputEvent) => { this._query = (e.target as HTMLInputElement).value; }}
          />
        </div>

        <div class="section-label">Recents</div>

        <div class="contacts">
          ${this._filtered.map(c => html`
            <div
              class="contact ${this._selectedId === c.id ? 'selected' : ''}"
              @click=${() => this._select(c.id)}
            >
              <div class="avatar" style="background:${c.avatarBg};color:${c.avatarColor}">${c.initials}</div>
              <div class="contact-info">
                <div class="contact-name">${c.name}</div>
                <div class="contact-meta">${c.lastSeen}</div>
              </div>
              ${this._selectedId === c.id ? html`<span class="invite-chip">Selected</span>` : ''}
            </div>
          `)}
        </div>

        <button class="btn-primary" ?disabled=${!this._selectedId || this._loading} @click=${this._sendInvite}>
          ${this._loading ? 'Sending…' : 'Send Invite →'}
        </button>
        <button class="btn-link" @click=${this._shareLink}>Share session link instead</button>
      </div>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'invite-partner': InvitePartner; }
}