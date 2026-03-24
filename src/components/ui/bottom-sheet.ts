/**
 * <bottom-sheet> — animated bottom sheet container.
 *
 * Usage:
 *   <bottom-sheet ?open=${true}>
 *     <slot></slot>
 *   </bottom-sheet>
 *
 * Dispatches:
 *   sheet-dismiss — when the backdrop or handle is dragged down
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('bottom-sheet')
export class BottomSheet extends LitElement {
    static override styles = css`
    :host {
      display: block;
      position: absolute;
      bottom: 0; left: 0; right: 0;
      z-index: var(--z-sheet);
      pointer-events: none;
    }

    .sheet {
      background: var(--color-sheet-bg);
      border-radius: var(--border-radius-xl) var(--border-radius-xl) 0 0;
      padding: 0 var(--space-5) env(safe-area-inset-bottom, var(--space-6));
      pointer-events: all;
      transform: translateY(100%);
      transition: transform var(--duration-sheet) var(--ease-out);
      will-change: transform;
    }

    :host([open]) .sheet {
      transform: translateY(var(--drag-offset, 0px));
    }

    .handle-wrap {
      display: flex;
      justify-content: center;
      padding: var(--space-3) 0 var(--space-2);
      cursor: grab;
      touch-action: none;
    }

    .handle {
      width: 36px; height: 4px;
      background: rgba(0, 0, 0, 0.12);
      border-radius: var(--border-radius-pill);
      transition: background var(--duration-fast);
    }

    .handle-wrap:active .handle { background: rgba(0,0,0,0.22); }

    @media (min-width: 1024px) {
      :host {
        top: auto;
        right: var(--space-3);
        bottom: var(--space-3);
        left: auto;
        width: min(var(--desktop-sheet-width, clamp(360px, 40vw, 520px)), calc(100vw - var(--space-6)));
        max-height: calc(100dvh - var(--map-status-bar-height) - (2 * var(--space-3)));
      }

      .sheet {
        max-height: inherit;
        border-radius: var(--border-radius-xl);
        transform: translateX(110%);
        padding-bottom: var(--space-4);
        overflow-y: auto;
      }

      :host([open]) .sheet {
        transform: translateX(var(--drag-offset, 0px));
      }

      .handle {
        width: 4px;
        height: 36px;
      }
    }
  `;

    @property({ type: Boolean, reflect: true }) open = false;

    private _startPoint = 0;
    private _dragging = false;

    private _isDesktop(): boolean {
      return window.matchMedia('(min-width: 1024px)').matches;
    }

    private _setOffset(y: number) {
        this.style.setProperty('--drag-offset', `${Math.max(0, y)}px`);
    }

    override render() {
        return html`
      <div class="sheet" part="sheet">
        <div
          class="handle-wrap"
          part="handle-wrap"
          @pointerdown=${this._onDragStart}
          @pointermove=${this._onDragMove}
          @pointerup=${this._onDragEnd}
          @pointercancel=${this._onDragEnd}
        >
          <div class="handle" part="handle"></div>
        </div>
        <slot></slot>
      </div>
    `;
    }

    private _onDragStart(e: PointerEvent) {
      this._startPoint = this._isDesktop() ? e.clientX : e.clientY;
        this._dragging = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    private _onDragMove(e: PointerEvent) {
        if (!this._dragging) return;
      const current = this._isDesktop() ? e.clientX : e.clientY;
      const delta = current - this._startPoint;
        this._setOffset(delta);
    }

    private _onDragEnd(e: PointerEvent) {
        if (!this._dragging) return;
        this._dragging = false;
      const current = this._isDesktop() ? e.clientX : e.clientY;
      const delta = current - this._startPoint;
        if (delta > 120) {
            this.dispatchEvent(new CustomEvent('sheet-dismiss', { bubbles: true, composed: true }));
        }
        this._setOffset(0);
    }
}

declare global {
    interface HTMLElementTagNameMap { 'bottom-sheet': BottomSheet; }
}