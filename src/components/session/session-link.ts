/**
 * <session-link> — both parties agreed. Display the generated
 * session link, allow sharing, then start live tracking.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { sessionStore, uiStore, locationStore } from '../../store/index.js';
import { copyText } from '../../services/clipboard.service.js';
import { sharedStyles } from '../../styles/shared-styles.js';
import '../ui/screen-shell.js';

@customElement('session-link')
export class SessionLink extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host { display: block; }

    /* Local overrides */
    .sheet { animation: slide-up var(--duration-sheet) var(--ease-out) both; }

    .icon-row {
      display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4);
    }

    .icon-wrap {
      width: 48px; height: 48px; border-radius: var(--border-radius-md);
      background: var(--color-green);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; flex-shrink: 0;
      animation: bounce-in var(--duration-slow) var(--ease-spring) both;
    }


    .link-card {
      background: rgba(77,114,152,0.07);
      border: 1.5px dashed rgba(77,114,152,0.4);
      border-radius: var(--border-radius-md);
      padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-3);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .link-card:hover { background: rgba(77,114,152,0.12); }

    .link-label { font-size: 10px; font-weight: var(--weight-bold); letter-spacing: 0.8px; text-transform: uppercase; color: var(--color-text-muted); margin-bottom: var(--space-1); }
    .link-value { font-family: var(--font-mono); font-size: var(--text-md); font-weight: var(--weight-medium); color: var(--color-blue); }

    .link-hint { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: var(--space-1); }

    .copied-flash {
      font-size: var(--text-xs); font-weight: var(--weight-bold);
      color: var(--color-green-text); text-align: center;
      margin-bottom: var(--space-2);
      animation: fade-in var(--duration-fast) both;
    }

    .partner-row {
      display: flex; align-items: center; gap: var(--space-3);
      padding: var(--space-3);
      background: rgba(0,0,0,0.03); border-radius: var(--border-radius-md);
      margin-bottom: var(--space-3);
    }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: var(--weight-bold); font-size: var(--text-sm); flex-shrink: 0; }
    .agreed-badge { font-size: 10px; font-weight: var(--weight-bold); background: var(--color-green); color: var(--color-green-text); padding: 2px 8px; border-radius: var(--border-radius-pill); margin-left: auto; }

    .btn-primary { margin-top: var(--space-3); }
  `  ];

  @state() private _copied = false;

  private async _copyLink() {
    const link = sessionStore.session?.link ?? '';
    const ok = await copyText(`https://${link}`);
    if (ok) {
      this._copied = true;
      setTimeout(() => { this._copied = false; }, 2000);
      return;
    }
    uiStore.showToast('Unable to copy automatically. Please copy the link manually.');
  }

  private async _shareLink() {
    const link = sessionStore.session?.link ?? '';
    const venue = sessionStore.selectedVenue?.name ?? 'our spot';
    if (navigator.share) {
      await navigator.share({
        title: '2bottles',
        text: `Let's meet at ${venue}! Join my session:`,
        url: `https://${link}`,
      });
    } else {
      this._copyLink();
    }
  }

  private _startTracking() {
    locationStore.startWatching();
    sessionStore.setSessionStatus('live');
    // Clear midpoint marker — we're moving to tracking mode
    this.dispatchEvent(new CustomEvent('map-view:clear-midpoint', { bubbles: true, composed: true }));
    uiStore.goToLiveTracking();
  }

  override render() {
    const p = sessionStore.partner;
    const s = sessionStore.session;
    const v = sessionStore.selectedVenue;

    return html`
      <screen-shell screen='session-link'>
      <div class="sheet">
        <div class="handle"></div>

        <div class="icon-row">
          <div class="icon-wrap">🔗</div>
          <div>
            <div class="title">Session Created</div>
            <div class="subtitle">Both confirmed · ${v?.name ?? 'Meetup spot'}</div>
          </div>
        </div>

        ${this._copied ? html`<div class="copied-flash">✓ Copied to clipboard</div>` : ''}

        <div class="link-card" @click=${this._copyLink} title="Tap to copy">
          <div class="link-label">Your session link</div>
          <div class="link-value">${s?.link ?? '…'}</div>
          <div class="link-hint">Tap to copy · Valid for this session only</div>
        </div>

        ${p ? html`
          <div class="partner-row">
            <div class="avatar" style="background:${p.avatarBg};color:${p.avatarColor}">${p.initials}</div>
            <div>
              <div style="font-size:var(--text-md);font-weight:var(--weight-medium)">${p.name}</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-muted)">Confirmed · heading to ${v?.name}</div>
            </div>
            <span class="agreed-badge">✓ Agreed</span>
          </div>
        ` : ''}

        <button class="btn btn-primary" @click=${this._startTracking}>
          <span>▶ Start Live Tracking</span>
        </button>
        <button class="btn btn-green" @click=${this._shareLink}>📤 Share Link</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'session-link': SessionLink; }
}