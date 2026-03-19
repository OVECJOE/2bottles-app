import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { sharedStyles } from '../../styles/shared-styles.js';
import '../ui/screen-shell.js';

type LandingCta = 'start' | 'install';

@customElement('landing-page')
export class LandingPage extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host {
      display: block;
      color: var(--color-text-primary);
    }

    .sheet {
      max-height: min(84vh, 760px);
      overflow-y: auto;
      gap: var(--space-5);
    }

    .hero-wrap {
      display: grid;
      align-content: start;
      gap: var(--space-3);
      min-height: 300px;
      border-radius: var(--border-radius-lg);
      border: 1px solid rgba(255, 255, 255, 0.85);
      box-shadow: var(--shadow-md);
      background:
        radial-gradient(circle at 14% 14%, rgba(208, 239, 177, 0.58), rgba(208, 239, 177, 0) 52%),
        radial-gradient(circle at 88% 30%, rgba(77, 114, 152, 0.42), rgba(77, 114, 152, 0) 55%),
        linear-gradient(160deg, #eff7e8 0%, #e2edf8 48%, #f9fbff 100%);
      padding: var(--space-5);
    }

    .tag {
      display: inline-flex;
      width: max-content;
      align-items: center;
      gap: var(--space-2);
      border: 1px solid rgba(77, 114, 152, 0.25);
      background: rgba(255, 255, 255, 0.72);
      border-radius: var(--border-radius-pill);
      color: var(--color-blue-dark);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      padding: 6px 12px;
      letter-spacing: 0.3px;
      margin-bottom: var(--space-1);
    }

    h1 {
      max-width: 24ch;
      font-size: clamp(28px, 5vw, 42px);
      line-height: 1.02;
      letter-spacing: -0.9px;
      margin-bottom: var(--space-1);
    }

    .lede {
      max-width: 60ch;
      color: var(--color-text-secondary);
      font-size: clamp(14px, 2.5vw, 16px);
      margin-bottom: var(--space-2);
    }

    .cta-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .cta-row .btn {
      width: auto;
      padding-left: var(--space-4);
      padding-right: var(--space-4);
    }

    @media (max-width: 560px) {
      .hero-wrap {
        min-height: 0;
        padding: var(--space-4);
      }

      h1 {
        font-size: clamp(24px, 7vw, 34px);
      }

      .cta-row .btn {
        width: 100%;
      }
    }

    .btn-soft {
      background: rgba(255, 255, 255, 0.86);
      color: var(--color-text-primary);
      border: 1px solid rgba(0, 0, 0, 0.08);
    }

    .preview-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-3);
      margin-top: var(--space-2);
      animation: reveal 800ms var(--ease-out) both;
      animation-delay: 230ms;
    }

    .preview-card {
      background: rgba(255, 255, 255, 0.78);
      border-radius: var(--border-radius-lg);
      border: 1px solid rgba(255, 255, 255, 0.9);
      box-shadow: var(--shadow-md);
      padding: var(--space-4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .preview-title {
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      margin-bottom: 6px;
    }

    .preview-copy {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      margin-bottom: var(--space-3);
    }

    .preview-image {
      width: 100%;
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.55);
      object-fit: cover;
      max-height: 220px;
    }

    .metric-row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
      margin-top: var(--space-1);
      animation: reveal 900ms var(--ease-out) both;
      animation-delay: 260ms;
    }

    .metric {
      background: rgba(255, 255, 255, 0.82);
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0, 0, 0, 0.08);
      padding: var(--space-3);
      text-align: center;
    }

    .metric-value {
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      color: var(--color-blue-dark);
      line-height: 1.1;
    }

    .metric-label {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      margin-top: 2px;
    }

    .section {
      display: grid;
      gap: var(--space-3);
    }

    .section-title {
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      color: var(--color-blue-dark);
    }

    .section-subtitle {
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    .list {
      display: grid;
      gap: var(--space-2);
    }

    .list-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      background: rgba(255, 255, 255, 0.78);
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0, 0, 0, 0.06);
      padding: var(--space-3);
      font-size: var(--text-sm);
      color: var(--color-text-primary);
    }

    .li-icon {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: var(--color-blue-light);
      display: grid;
      place-items: center;
      color: var(--color-blue-dark);
      flex-shrink: 0;
    }

    .full-actions {
      display: grid;
      gap: var(--space-2);
    }

    .highlight-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }

    .highlight {
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(77, 114, 152, 0.08);
      padding: var(--space-3);
    }

    .highlight h3 {
      font-size: var(--text-md);
      margin-bottom: 3px;
      color: var(--color-blue-dark);
    }

    .highlight p {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .footnote {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      text-align: center;
      padding-bottom: var(--space-1);
    }

    @media (min-width: 900px) {
      .preview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .highlight-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    @keyframes reveal {
      from { transform: translateY(12px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

  `
  ];

  @property({ type: Boolean }) canInstall = false;

  private _emit(action: LandingCta) {
    this.dispatchEvent(new CustomEvent('landing-action', {
      detail: { action },
      bubbles: true,
      composed: true,
    }));
  }

  override render() {
    return html`
      <screen-shell screen="landing">
        <div class="sheet">
          <section class="hero-wrap">
            <div class="tag">REAL-TIME, FAIR, BEAUTIFUL MEETUPS</div>
            <h1>2bottles turns "where should we meet?" into one tap.</h1>
            <p class="lede">
              Instant midpoint suggestions, live ETA sync, and a polished map flow that feels like a native mobile app.
              Built for date nights, team meetups, and every time halfway matters.
            </p>

            <div class="cta-row">
              <button class="btn btn-primary" @click=${() => this._emit('start')}>Start a Session</button>
              ${this.canInstall ? html`
                <button class="btn btn-soft" @click=${() => this._emit('install')}>Install App</button>
              ` : ''}
            </div>
          </section>

          <div class="metric-row" aria-label="Core stats">
            <div class="metric">
              <div class="metric-value">2 taps</div>
              <div class="metric-label">to invite partner</div>
            </div>
            <div class="metric">
              <div class="metric-value">Live</div>
              <div class="metric-label">location co-tracking</div>
            </div>
            <div class="metric">
              <div class="metric-value">Fair</div>
              <div class="metric-label">midpoint selection</div>
            </div>
          </div>

          <section class="section">
            <div class="section-title">Designed for newcomers</div>
            <div class="section-subtitle">No complex onboarding. Create, share, and agree on a fair meetup point quickly.</div>

            <div class="highlight-grid">
              <article class="highlight">
                <h3>Fairness Engine</h3>
                <p>Venue options are balanced around both people, not just the host.</p>
              </article>
              <article class="highlight">
                <h3>Live Connection</h3>
                <p>See movement updates and timing changes as they happen.</p>
              </article>
              <article class="highlight">
                <h3>Clear Decisions</h3>
                <p>A focused flow from invite to final rendezvous confirmation.</p>
              </article>
            </div>
          </section>

          <div class="preview-grid">
            <article class="preview-card">
              <div class="preview-title">Cinematic route view</div>
              <p class="preview-copy">Designed map overlays and sheets that stay legible while moving.</p>
              <img class="preview-image" src="/illustrations/landing-map-scene.svg" alt="2bottles map and path illustration" loading="lazy" />
            </article>

            <article class="preview-card">
              <div class="preview-title">Partner-first workflow</div>
              <p class="preview-copy">Invite, align on venue, then keep both parties in sync all the way in.</p>
              <img class="preview-image" src="/illustrations/landing-duo-flow.svg" alt="2bottles dual user journey illustration" loading="lazy" />
            </article>
          </div>

          <section class="section">
            <div class="section-title">What you can do immediately</div>
            <div class="list">
              <div class="list-item"><span class="li-icon">⊙</span><span>Find midpoint venues in seconds.</span></div>
              <div class="list-item"><span class="li-icon">⟷</span><span>Track both people with low-latency updates.</span></div>
              <div class="list-item"><span class="li-icon">☕</span><span>Use manual search when you already know a place.</span></div>
              <div class="list-item"><span class="li-icon">⌂</span><span>Install the app for a native-feeling mobile experience.</span></div>
            </div>
          </section>

          <div class="full-actions">
            <button class="btn btn-primary" @click=${() => this._emit('start')}>Get Started Now</button>
            ${this.canInstall ? html`<button class="btn btn-soft" @click=${() => this._emit('install')}>Install on This Device</button>` : ''}
          </div>

          <p class="footnote">2bottles keeps meetup planning simple, fair, and coordinated from first tap to arrival.</p>
        </div>
      </screen-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'landing-page': LandingPage;
  }
}
