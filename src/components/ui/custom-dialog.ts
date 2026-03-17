import { LitElement, html, css } from 'lit';
import { property } from 'lit/decorators.js';
import { sharedStyles } from '../../styles/shared-styles.js';

// @customElement('custom-dialog')
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

    private _handleAction(confirmed: boolean) {
        this.dispatchEvent(new CustomEvent('dialog-result', {
            detail: { confirmed },
            bubbles: true,
            composed: true
        }));
    }

    override render() {
        return html`
            <div class="backdrop" @click=${() => this._handleAction(false)}></div>
            <div class="dialog">
                ${this.title ? html`<div class="title">${this.title}</div>` : ''}
                <div class="message">${this.message}</div>
                <div class="actions">
                    <button class="btn btn-primary" @click=${() => this._handleAction(true)}>
                        ${this.confirmLabel}
                    </button>
                    <button class="btn btn-ghost" @click=${() => this._handleAction(false)}>
                        ${this.cancelLabel}
                    </button>
                </div>
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
