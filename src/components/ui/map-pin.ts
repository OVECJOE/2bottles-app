/**
 * <map-pin> — visual pin component for overlaying on the map
 * or in list items. Not the maplibre marker — that's built
 * imperatively in map-view. This is for UI contexts like
 * venue cards, contact rows, and summary screens.
 *
 * Attributes:
 *   color    — dot fill color (defaults to --color-blue)
 *   label    — text shown in the chip below the dot
 *   pulse    — show animated pulse rings (boolean)
 *   size     — 'sm' | 'md' (default 'md')
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('map-pin')
export class MapPin extends LitElement {
    static override styles = css`
    :host { display: inline-flex; flex-direction: column; align-items: center; }

    .pin-wrap {
      position: relative;
      display: flex; align-items: center; justify-content: center;
    }

    .ring {
      position: absolute;
      border-radius: 50%;
      border: 2px solid var(--pin-color, var(--color-action));
      opacity: 0;
      animation: pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      pointer-events: none;
    }
    .ring:nth-child(2) { animation-delay: 0.8s; }

    :host([size='sm']) .ring { width: 22px; height: 22px; margin: -11px; }
    :host([size='md']) .ring,
    :host(:not([size])) .ring { width: 30px; height: 30px; margin: -15px; }

    .dot {
      border-radius: 50%;
      background: var(--pin-color, var(--color-action));
      border: 2.5px solid rgba(255,255,255,0.95);
      box-shadow: 0 2px 8px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06);
      position: relative; z-index: 1;
      transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    :host([size='sm']) .dot { width: 10px; height: 10px; }
    :host([size='md']) .dot,
    :host(:not([size])) .dot { width: 14px; height: 14px; }

    :host(:hover) .dot { transform: scale(1.15); }

    .label {
      margin-top: 5px;
      background: rgba(255,255,255,0.96);
      color: var(--color-text-primary);
      font-family: var(--font-sans);
      font-size: 10px; font-weight: var(--weight-bold);
      padding: 2px 8px;
      border-radius: var(--border-radius-pill);
      white-space: nowrap;
      box-shadow: var(--shadow-sm);
      letter-spacing: 0.2px;
    }
  `;

    @property({ reflect: true }) color = '';
    @property() label = '';
    @property({ type: Boolean, reflect: true }) pulse = false;
    @property({ reflect: true }) size: 'sm' | 'md' = 'md';

    override render() {
        const style = this.color ? `--pin-color: ${this.color};` : '';

        return html`
      <div class="pin-wrap" part="pin-wrap" style=${style}>
        ${this.pulse ? html`<div class="ring" part="ring"></div><div class="ring" part="ring"></div>` : ''}
        <div class="dot" part="dot"></div>
      </div>
      ${this.label ? html`<div class="label" part="label">${this.label}</div>` : ''}
    `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'map-pin': MapPin; }
}