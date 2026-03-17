/**
 * <avatar-chip> — circular initials avatar with optional
 * online/offline/pending status dot.
 *
 * Properties:
 *   initials  — 1–2 characters shown inside
 *   bg        — background color
 *   color     — text color
 *   size      — 'sm'(28) | 'md'(36) | 'lg'(48)
 *   status    — 'online' | 'offline' | 'pending' | '' (none)
 *   name      — if set, renders a name label to the right (chip mode)
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('avatar-chip')
export class AvatarChip extends LitElement {
    static override styles = css`
    :host { display: inline-flex; align-items: center; gap: var(--space-2); }

    .avatar-wrap { position: relative; flex-shrink: 0; }

    .avatar {
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-family: var(--font-sans);
      font-weight: var(--weight-bold);
      line-height: 1;
      background: var(--av-bg, var(--color-blue-light));
      color: var(--av-color, var(--color-blue-dark));
    }

    :host([size='sm']) .avatar { width: 28px; height: 28px; font-size: 10px; }
    :host([size='md']) .avatar,
    :host(:not([size])) .avatar { width: 36px; height: 36px; font-size: 12px; }
    :host([size='lg']) .avatar { width: 48px; height: 48px; font-size: 15px; }

    .status-dot {
      position: absolute; bottom: 0; right: 0;
      width: 9px; height: 9px;
      border-radius: 50%;
      border: 2px solid var(--color-sheet-bg-solid);
    }
    :host([size='lg']) .status-dot { width: 12px; height: 12px; }

    .status-dot.online  { background: #22c55e; }
    .status-dot.offline { background: #94a3b8; }
    .status-dot.pending {
      background: var(--color-partner);
      animation: pulse-ring 1.8s ease-in-out infinite;
    }

    .name {
      font-family: var(--font-sans);
      font-size: var(--text-md);
      font-weight: var(--weight-medium);
      color: var(--color-text-primary);
      white-space: nowrap;
    }
  `;

    @property() initials = '?';
    @property() bg = '';
    @property() color = '';
    @property({ reflect: true }) size: 'sm' | 'md' | 'lg' = 'md';
    @property() status: 'online' | 'offline' | 'pending' | '' = '';
    @property() name = '';

    override render() {
        const style = [
            this.bg ? `--av-bg: ${this.bg};` : '',
            this.color ? `--av-color: ${this.color};` : '',
        ].join('');

        return html`
      <div class="avatar-wrap">
        <div class="avatar" style=${style}>${this.initials}</div>
        ${this.status ? html`<div class="status-dot ${this.status}"></div>` : ''}
      </div>
      ${this.name ? html`<span class="name">${this.name}</span>` : ''}
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'avatar-chip': AvatarChip; }
}