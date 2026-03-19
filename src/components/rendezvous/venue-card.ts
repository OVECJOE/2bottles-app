import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('venue-card')
export class VenueCard extends LitElement {
    static override styles = css`
    :host { display: block; }

    .card {
      display: flex; align-items: center; gap: var(--space-3);
      width: 100%;
      padding: var(--space-3); border-radius: var(--border-radius-md);
      border: 1.5px solid transparent;
      cursor: pointer;
      background: rgba(0,0,0,0.035);
      text-align: left;
      font-family: inherit;
      transition:
        background var(--duration-fast),
        border-color var(--duration-fast),
        transform var(--duration-fast);
      -webkit-tap-highlight-color: transparent;
    }

    button.card {
      appearance: none;
      border: 1.5px solid transparent;
    }

    .card:hover  { background: rgba(0,0,0,0.06); }
    .card:active { transform: scale(0.99); }
    .card:focus-visible {
      outline: 2px solid var(--color-blue);
      outline-offset: 2px;
    }

    :host([selected]) .card {
      background: var(--color-blue-light);
      border-color: var(--color-blue);
    }

    .icon {
      width: 44px; height: 44px;
      border-radius: var(--border-radius-sm);
      background: rgba(255,255,255,0.8);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0;
      transition: background var(--duration-fast);
    }
    :host([selected]) .icon { background: rgba(77,114,152,0.12); }

    .info { flex: 1; min-width: 0; }

    .name {
      font-size: var(--text-md); font-weight: var(--weight-medium);
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .meta {
      font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .eta { text-align: right; flex-shrink: 0; }

    .eta-val {
      font-size: var(--text-md); font-weight: var(--weight-bold);
      color: var(--color-text-primary);
    }
    :host([selected]) .eta-val { color: var(--color-blue-dark); }

    .eta-label { font-size: 10px; color: var(--color-text-muted); margin-top: 1px; }

    .selected-mark {
      flex-shrink: 0;
      width: 18px; height: 18px; border-radius: 50%;
      background: var(--color-blue);
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; color: #fff;
    }
  `;

    @property() emoji = '📍';
    @property() name = '';
    @property() address = '';
    @property({ type: Number }) distanceKm = 0;
    @property({ type: Number }) etaMinutes = 0;
    @property({ type: Boolean, reflect: true }) selected = false;

    private _click() {
        this.dispatchEvent(new CustomEvent('venue-select', { bubbles: true, composed: true }));
    }

    override render() {
        return html`
      <button
        class="card"
        type="button"
        @click=${this._click}
        aria-pressed=${this.selected ? 'true' : 'false'}
        aria-label=${`${this.name}, ${this.address || 'address unavailable'}${this.etaMinutes ? `, ${this.etaMinutes} minutes` : ''}`}
      >
        <div class="icon">${this.emoji}</div>

        <div class="info">
          <div class="name">${this.name}</div>
          <div class="meta">${this.address}${this.distanceKm ? ` · ${this.distanceKm.toFixed(1)} km` : ''}</div>
        </div>

        ${this.etaMinutes ? html`
          <div class="eta">
            <div class="eta-val">${this.etaMinutes} min</div>
            <div class="eta-label">each</div>
          </div>
        ` : ''}

        ${this.selected ? html`<div class="selected-mark">✓</div>` : ''}
      </button>
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'venue-card': VenueCard; }
}