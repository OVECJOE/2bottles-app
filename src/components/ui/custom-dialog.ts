/**
 * <custom-dialog> — reusable modal shell with optional custom slotted content.
 *
 * Properties:
 *   open, title, message, confirmLabel, cancelLabel
 *   hideDefaultActions, allowBackdropDismiss, fullscreen
 *
 * Dispatches:
 *   dialog-result { confirmed: boolean }
 */
import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles.js';
export class CustomDialog extends LitElement {
    static override styles = [
        sharedStyles,
        css`
        :host {
            display: block;
            position: fixed;
            inset: 0;
            z-index: var(--z-modal);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: var(--space-6);
            pointer-events: none;
            opacity: 0;
            transition: opacity var(--duration-base) var(--ease-out);
        }

        :host([open]) {
            pointer-events: auto;
            opacity: 1;
        }

        .backdrop {
            position: absolute;
            inset: 0;
            background: rgba(15, 26, 34, 0.4);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
        }

        .dialog {
            position: relative;
            width: 100%;
            max-width: 320px;
            background: var(--color-sheet-bg);
            border-radius: var(--border-radius-xl);
            padding: var(--space-6);
            box-shadow: var(--shadow-xl);
            transform: scale(0.9) translateY(10px);
            transition: transform var(--duration-base) var(--ease-spring);
            max-height: calc(100dvh - (2 * var(--space-6)));
            overflow: auto;
        }

        .dialog.fullscreen {
            max-width: min(560px, calc(100vw - (2 * var(--space-4))));
            max-height: min(780px, calc(100dvh - (2 * var(--space-4))));
            border-radius: var(--border-radius-xl);
            padding: 0;
            overflow: hidden;
            background: transparent;
            box-shadow: var(--shadow-xl);
        }

        :host([open]) .dialog {
            transform: scale(1) translateY(0);
        }

        .title {
            font-size: var(--text-xl);
            font-weight: var(--weight-bold);
            margin-bottom: var(--space-2);
            color: var(--color-text-primary);
            text-align: center;
        }

        .message {
            font-size: var(--text-md);
            color: var(--color-text-secondary);
            margin-bottom: var(--space-6);
            text-align: center;
            line-height: var(--line-height-base);
        }

    .actions {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
        }
    `    ];

    @property({ type: Boolean, reflect: true }) open = false;
    @property() title = '';
    @property() message = '';
    @property() confirmLabel = 'Confirm';
    @property() cancelLabel = 'Cancel';
    @property({ type: Boolean, attribute: 'hide-default-actions' }) hideDefaultActions = false;
    @property({ type: Boolean, attribute: 'allow-backdrop-dismiss' }) allowBackdropDismiss = true;
    @property({ type: Boolean }) fullscreen = false;

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keydown', this._onKeyDown);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this._onKeyDown);
    }

    override updated(changed: Map<string, unknown>) {
        if (!changed.has('open') || !this.open) return;
        queueMicrotask(() => {
            const primary = this.renderRoot.querySelector<HTMLButtonElement>('.btn.btn-primary');
            primary?.focus();
        });
    }

    private _onKeyDown = (e: KeyboardEvent) => {
        if (!this.open) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            this._handleAction(false);
        }
    };

    private _handleAction(confirmed: boolean) {
        this.dispatchEvent(new CustomEvent('dialog-result', {
            detail: { confirmed },
            bubbles: true,
            composed: true
        }));
    }

    override render() {
        const hasCustomContent = this.childElementCount > 0;
        return html`
            <div class="backdrop" part="backdrop" @click=${() => { if (this.allowBackdropDismiss) this._handleAction(false); }}></div>
            <div class="dialog ${this.fullscreen ? 'fullscreen' : ''}" part="dialog" role="dialog" aria-modal="true" aria-label=${this.title || 'Confirmation dialog'}>
                <slot></slot>
                ${hasCustomContent ? '' : html`
                    ${this.title ? html`<div class="title" part="title">${this.title}</div>` : ''}
                    <div class="message" part="message">${this.message}</div>
                    ${this.hideDefaultActions ? '' : html`
                        <div class="actions" part="actions">
                            <button class="btn btn-primary" part="confirm" @click=${() => this._handleAction(true)}>
                                ${this.confirmLabel}
                            </button>
                            <button class="btn btn-ghost" part="cancel" @click=${() => this._handleAction(false)}>
                                ${this.cancelLabel}
                            </button>
                        </div>
                    `}
                `}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'custom-dialog': CustomDialog; }
}

if (!customElements.get('custom-dialog')) {
    customElements.define('custom-dialog', CustomDialog);
}
