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
      max-height: min(86vh, 820px);
      overflow-y: auto;
      gap: var(--space-5);
      padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-8));
      background: linear-gradient(180deg, rgba(250, 252, 248, 0.97), rgba(246, 250, 255, 0.96));
    }

    .hero {
      border-radius: var(--border-radius-lg);
      border: 1px solid rgba(255, 255, 255, 0.9);
      box-shadow: var(--shadow-md);
      padding: var(--space-5);
      background:
        linear-gradient(140deg, rgba(208, 239, 177, 0.8), rgba(219, 232, 244, 0.82) 42%, rgba(236, 245, 255, 0.9) 100%),
        repeating-linear-gradient(-24deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.22) 10px, rgba(255, 255, 255, 0) 10px, rgba(255, 255, 255, 0) 20px);
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-4);
      align-items: start;
    }

    .hero-main {
      display: grid;
      gap: var(--space-3);
      min-width: 0;
    }

    .hero-kicker {
      display: inline-flex;
      align-items: center;
      width: max-content;
      gap: var(--space-2);
      border-radius: var(--border-radius-pill);
      border: 1px solid rgba(46, 74, 99, 0.26);
      background: rgba(255, 255, 255, 0.72);
      color: var(--color-blue-dark);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      letter-spacing: 0.35px;
      padding: 6px 12px;
    }

    .hero-title {
      font-size: clamp(28px, 5vw, 44px);
      line-height: 1.05;
      letter-spacing: -0.8px;
      max-width: 20ch;
      text-wrap: balance;
    }

    .hero-copy {
      font-size: var(--text-md);
      color: rgba(17, 17, 17, 0.82);
      max-width: 58ch;
      line-height: 1.45;
      text-wrap: pretty;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-1);
    }

    .hero-actions .btn {
      width: auto;
      min-width: 148px;
      padding-left: var(--space-4);
      padding-right: var(--space-4);
    }

    .btn-soft {
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: rgba(255, 255, 255, 0.82);
      color: var(--color-text-primary);
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
    }

    .metric {
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.82);
      padding: var(--space-3);
      text-align: center;
    }

    .metric-value {
      color: var(--color-blue-dark);
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      line-height: 1.05;
    }

    .metric-label {
      margin-top: 2px;
      color: var(--color-text-muted);
      font-size: var(--text-xs);
    }

    .signal-strip {
      border-radius: var(--border-radius-md);
      padding: var(--space-3);
      border: 1px solid rgba(46, 74, 99, 0.18);
      background: linear-gradient(95deg, rgba(26, 37, 48, 0.9), rgba(77, 114, 152, 0.88));
      color: rgba(255, 255, 255, 0.94);
      display: grid;
      gap: 7px;
    }

    .signal-title {
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      letter-spacing: 0.35px;
      text-transform: uppercase;
      opacity: 0.9;
    }

    .signal-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .pill {
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: var(--border-radius-pill);
      padding: 5px 10px;
      font-size: var(--text-xs);
      background: rgba(255, 255, 255, 0.09);
    }

    .section {
      display: grid;
      gap: var(--space-3);
    }

    .section-head {
      display: grid;
      gap: 4px;
    }

    .section-title {
      color: var(--color-blue-dark);
      font-size: var(--text-xl);
      font-weight: var(--weight-bold);
      letter-spacing: -0.2px;
    }

    .section-sub {
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
      line-height: 1.45;
    }

    .route-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }

    .route-card {
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: rgba(255, 255, 255, 0.78);
      padding: var(--space-3);
      display: grid;
      gap: 6px;
    }

    .route-head {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      color: var(--color-text-primary);
    }

    .route-step {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: var(--weight-bold);
      color: #fff;
      background: var(--color-blue-dark);
      flex-shrink: 0;
    }

    .route-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--color-blue);
      box-shadow: 0 0 0 5px rgba(77, 114, 152, 0.15);
      flex-shrink: 0;
    }

    .route-copy {
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    .showcase {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-3);
    }

    .showcase-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-3);
    }

    .hero-preview {
      border-radius: var(--border-radius-lg);
      border: 1px solid rgba(0, 0, 0, 0.08);
      background: linear-gradient(155deg, rgba(255, 255, 255, 0.88), rgba(234, 243, 252, 0.86));
      box-shadow: var(--shadow-sm);
      padding: var(--space-3);
      display: grid;
      gap: var(--space-2);
    }

    .hero-preview-title {
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      color: var(--color-blue-dark);
      letter-spacing: 0.2px;
      text-transform: uppercase;
    }

    .hero-preview-main {
      border-radius: var(--border-radius-md);
      overflow: hidden;
      border: 1px solid rgba(0, 0, 0, 0.06);
      background: rgba(255, 255, 255, 0.65);
      position: relative;
    }

    .preview-status {
      position: absolute;
      top: var(--space-2);
      left: var(--space-2);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: var(--border-radius-pill);
      border: 1px solid rgba(255, 255, 255, 0.5);
      background: rgba(26, 37, 48, 0.8);
      color: rgba(255, 255, 255, 0.95);
      font-size: 11px;
      padding: 4px 9px;
      z-index: 1;
      font-weight: var(--weight-medium);
    }

    .preview-status::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-online);
    }

    .micro-cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-2);
    }

    .micro-card {
      border-radius: var(--border-radius-md);
      border: 1px solid rgba(0, 0, 0, 0.07);
      background: rgba(255, 255, 255, 0.84);
      padding: var(--space-3);
      display: grid;
      gap: 4px;
    }

    .micro-card-title {
      font-size: var(--text-sm);
      font-weight: var(--weight-bold);
      color: var(--color-text-primary);
    }

    .micro-card-copy {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: 1.45;
    }

    .flow-note {
      border-radius: var(--border-radius-md);
      border: 1px dashed rgba(46, 74, 99, 0.28);
      background: rgba(219, 232, 244, 0.42);
      padding: var(--space-3);
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: 1.45;
    }

    .showcase-card {
      border-radius: var(--border-radius-lg);
      border: 1px solid rgba(0, 0, 0, 0.07);
      background: rgba(255, 255, 255, 0.86);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    .showcase-copy {
      padding: var(--space-4);
      display: grid;
      gap: 6px;
    }

    .showcase-title {
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      color: var(--color-text-primary);
    }

    .showcase-text {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .showcase-image {
      width: 100%;
      display: block;
      object-fit: cover;
      max-height: 220px;
      background: rgba(255, 255, 255, 0.45);
      border-top: 1px solid rgba(0, 0, 0, 0.06);
    }

    .footnote {
      color: var(--color-text-muted);
      text-align: center;
      font-size: var(--text-xs);
      padding-bottom: var(--space-1);
    }

    @media (min-width: 760px) {
      .hero {
        grid-template-columns: minmax(0, 1fr);
      }

      .route-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .showcase {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .showcase-layout {
        grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      }

      .micro-cards {
        grid-template-columns: 1fr;
      }

    }

    @media (max-width: 580px) {
      .hero {
        padding: var(--space-4);
        gap: var(--space-3);
      }

      .hero-title {
        font-size: clamp(24px, 8vw, 34px);
        max-width: 100%;
      }

      .hero-actions .btn {
        width: 100%;
        min-width: 0;
      }

      .metrics {
        grid-template-columns: 1fr;
      }
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
          <section class="hero">
            <div class="hero-main">
              <div class="hero-kicker">REAL-TIME, FAIR, BEAUTIFUL MEETUPS</div>
              <div class="hero-title">Meet halfway without the back-and-forth chaos.</div>
              <p class="hero-copy">
                2bottles turns one awkward decision into a smooth flow: invite your partner, get balanced midpoint options,
                agree fast, and track both arrivals live.
              </p>

              <div class="hero-actions">
                <button class="btn btn-primary" @click=${() => this._emit('start')}>Start a Session</button>
                ${this.canInstall ? html`<button class="btn btn-soft" @click=${() => this._emit('install')}>Install App</button>` : ''}
              </div>
            </div>
          </section>

          <div class="metrics" aria-label="Why people love it">
            <div class="metric">
              <div class="metric-value">2 taps</div>
              <div class="metric-label">to invite partner</div>
            </div>
            <div class="metric">
              <div class="metric-value">Live</div>
              <div class="metric-label">co-tracking updates</div>
            </div>
            <div class="metric">
              <div class="metric-value">Balanced</div>
              <div class="metric-label">midpoint-first decisions</div>
            </div>
          </div>

          <section class="signal-strip" aria-label="Core product signals">
            <div class="signal-title">Built for movement</div>
            <div class="signal-row">
              <span class="pill">Midpoint venue engine</span>
              <span class="pill">ETA sync for both people</span>
              <span class="pill">Manual place override</span>
              <span class="pill">Installable app shell</span>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">What happens after "Built for movement"</div>
              <div class="section-sub">This is the exact order users experience inside the app.</div>
            </div>
            <div class="route-grid">
              <article class="route-card">
                <div class="route-head"><span class="route-step">1</span><span>Create + Invite</span></div>
                <div class="route-copy">Start a session and send the link instantly to your partner.</div>
              </article>
              <article class="route-card">
                <div class="route-head"><span class="route-step">2</span><span>Pick Fair Spot</span></div>
                <div class="route-copy">Review midpoint options scored around both travel times.</div>
              </article>
              <article class="route-card">
                <div class="route-head"><span class="route-step">3</span><span>Track + Arrive</span></div>
                <div class="route-copy">Watch live movement and ETA updates until both of you arrive.</div>
              </article>
            </div>
            <div class="flow-note">
              After these three steps, users land in live tracking and chat while the route remains visible in a sheet-first layout.
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">What the interface looks like during use</div>
              <div class="section-sub">These previews map directly to the interaction flow above.</div>
            </div>

            <div class="showcase-layout">
              <article class="hero-preview">
                <div class="hero-preview-title">Live usage view</div>
                <div class="hero-preview-main">
                  <div class="preview-status">Session synced</div>
                  <img class="showcase-image" src="/illustrations/landing-map-scene.svg" alt="2bottles route and midpoint scene" loading="lazy" />
                </div>
              </article>

              <div class="micro-cards">
                <article class="micro-card">
                  <div class="micro-card-title">Map-first decisions</div>
                  <div class="micro-card-copy">Venue and route context stay visible while users make selections in the sheet.</div>
                </article>
                <article class="micro-card">
                  <div class="micro-card-title">Partner feedback loop</div>
                  <div class="micro-card-copy">Suggestions, agreements, and movement updates stay synchronized in real time.</div>
                </article>
                <article class="micro-card">
                  <div class="micro-card-title">Low-friction interaction</div>
                  <div class="micro-card-copy">Each state uses focused controls so newcomers understand what to do next instantly.</div>
                </article>
              </div>
            </div>

            <div class="showcase">
              <article class="showcase-card">
                <div class="showcase-copy">
                  <div class="showcase-title">Partner-centered flow</div>
                  <div class="showcase-text">Both people stay aligned from invite to venue agreement with low-friction decisions.</div>
                </div>
                <img class="showcase-image" src="/illustrations/landing-duo-flow.svg" alt="2bottles partner journey" loading="lazy" />
              </article>
            </div>
          </section>

          <p class="footnote">2bottles keeps meetup planning fair, calm, and beautifully clear.</p>
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
