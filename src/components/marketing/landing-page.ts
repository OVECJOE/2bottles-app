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

      .surface {
        position: absolute;
        inset: 0;
        overflow-y: auto;
        padding: calc(var(--map-status-bar-height) + var(--space-4)) var(--space-5)
          calc(env(safe-area-inset-bottom, 0px) + var(--space-10));
        display: grid;
        gap: clamp(30px, 4.1vw, 53px);
        background:
          radial-gradient(circle at 84% -14%, rgba(53, 92, 126, 0.2), transparent 40%),
          radial-gradient(circle at -10% 8%, rgba(178, 226, 134, 0.25), transparent 34%),
          linear-gradient(180deg, #f7faf6, #edf4fb);
      }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }

      .brand-logo {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        background: rgba(255, 255, 255, 0.92);
        object-fit: contain;
        padding: 4px;
      }

      .brand-copy {
        display: grid;
        gap: 2px;
      }

      .brand-title {
        font-size: var(--text-lg);
        font-weight: var(--weight-bold);
        color: var(--color-blue-dark);
        letter-spacing: -0.2px;
      }

      .nav {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      .nav-chip {
        border: 1px solid rgba(0, 0, 0, 0.09);
        border-radius: var(--border-radius-pill);
        padding: 7px 12px;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        background: rgba(255, 255, 255, 0.78);
        text-decoration: none;
      }

      .hero {
        border-radius: var(--border-radius-xl);
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: linear-gradient(145deg, #102234, #2e4a63 46%, #4d7298 100%);
        color: #f4f9fd;
        padding: var(--space-6);
        display: grid;
        grid-template-columns: 1.05fr 1fr;
        gap: var(--space-5);
        align-items: center;
      }

      .hero-copy {
        display: grid;
        gap: var(--space-4);
      }

      .hero-eyebrow {
        display: inline-flex;
        width: max-content;
        border-radius: var(--border-radius-pill);
        border: 1px solid rgba(255, 255, 255, 0.28);
        padding: 6px 11px;
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        letter-spacing: 0.35px;
        background: rgba(255, 255, 255, 0.12);
      }

      .hero-title {
        font-size: clamp(30px, 5vw, 52px);
        line-height: 1.08;
        letter-spacing: -0.9px;
        max-width: 18ch;
      }

      .hero-sub {
        font-size: var(--text-md);
        line-height: 1.5;
        max-width: 52ch;
        color: rgba(245, 248, 252, 0.9);
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .hero-actions .btn {
        width: auto;
        min-width: 156px;
      }

      .hero-secondary {
        border: 1px solid rgba(255, 255, 255, 0.28);
        color: #f2f7fb;
        background: rgba(255, 255, 255, 0.1);
      }

      .hero-preview {
        border-radius: var(--border-radius-lg);
        border: 1px solid rgba(255, 255, 255, 0.24);
        background: rgba(255, 255, 255, 0.12);
        overflow: hidden;
      }

      .hero-image {
        display: block;
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
      }

      .hero-meta {
        border-top: 1px solid rgba(255, 255, 255, 0.18);
        padding: var(--space-3);
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-2);
      }

      .hero-metric {
        display: grid;
        gap: 2px;
      }

      .hero-metric strong {
        font-size: var(--text-sm);
      }

      .hero-metric span {
        font-size: 11px;
        color: rgba(245, 248, 252, 0.75);
      }

      .section {
        display: grid;
        gap: 14px;
      }

      .strip {
        border-radius: var(--border-radius-lg);
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: rgba(255, 255, 255, 0.88);
        padding: var(--space-4);
      }

      .trust-list {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-3);
      }

      .trust-item {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        text-align: center;
      }

      .section-head {
        display: grid;
        gap: 3px;
      }

      .section-title {
        font-size: var(--text-xl);
        line-height: 1.2;
        color: var(--color-blue-dark);
        letter-spacing: -0.2px;
      }

      .section-sub {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .cards {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-3);
      }

      .cards.two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .cards.four {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .card {
        border: 1px solid rgba(0, 0, 0, 0.09);
        border-radius: var(--border-radius-lg);
        background: rgba(255, 255, 255, 0.84);
        padding: var(--space-3);
        display: grid;
        gap: 4px;
      }

      .card h4 {
        font-size: var(--text-md);
        color: var(--color-text-primary);
        margin: 0;
      }

      .card p {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: 1.45;
        margin: 0;
      }

      .timeline {
        display: grid;
        gap: var(--space-2);
      }

      .timeline-row {
        display: grid;
        grid-template-columns: 40px 1fr;
        gap: var(--space-3);
        align-items: start;
      }

      .step-dot {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        font-size: var(--text-sm);
        font-weight: var(--weight-bold);
        color: #0d2d45;
        background: rgba(178, 226, 134, 0.5);
        border: 1px solid rgba(13, 45, 69, 0.16);
      }

      .step-copy {
        border: 1px solid rgba(0, 0, 0, 0.09);
        border-radius: var(--border-radius-lg);
        background: rgba(255, 255, 255, 0.85);
        padding: var(--space-3);
      }

      .step-copy strong {
        display: block;
        font-size: var(--text-md);
      }

      .step-copy span {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .pair {
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        gap: var(--space-3);
        align-items: start;
      }

      .stack-cards {
        grid-template-columns: 1fr;
        gap: var(--space-2);
        align-content: start;
      }

      .stack-cards .card {
        min-height: 0;
      }

      .visual-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
      }

      .visual {
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: var(--border-radius-lg);
        overflow: hidden;
        background: rgba(255, 255, 255, 0.9);
      }

      .visual img {
        width: 100%;
        display: block;
        aspect-ratio: 16 / 10;
        object-fit: cover;
      }

      .visual-copy {
        padding: var(--space-2) var(--space-3) var(--space-3);
        display: grid;
        gap: 3px;
      }

      .visual-copy strong {
        font-size: var(--text-md);
      }

      .visual-copy span {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: var(--space-3);
      }

      .kpi {
        border: 1px solid rgba(0, 0, 0, 0.09);
        border-radius: var(--border-radius-lg);
        background: rgba(255, 255, 255, 0.86);
        padding: var(--space-3);
        display: grid;
        gap: 2px;
      }

      .kpi strong {
        font-size: clamp(22px, 2.8vw, 30px);
        line-height: 1.1;
        color: var(--color-blue-dark);
      }

      .kpi span {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .quote {
        border: 1px solid rgba(0, 0, 0, 0.09);
        border-radius: var(--border-radius-lg);
        background: rgba(255, 255, 255, 0.9);
        padding: var(--space-4);
      }

      .quote p {
        font-size: var(--text-md);
        line-height: 1.45;
        color: var(--color-text-primary);
        margin: 0;
      }

      .quote span {
        display: block;
        margin-top: var(--space-2);
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .faq {
        border: 1px solid rgba(0, 0, 0, 0.09);
        border-radius: var(--border-radius-lg);
        background: rgba(255, 255, 255, 0.86);
        padding: var(--space-3);
        display: grid;
        gap: 4px;
      }

      .faq strong {
        font-size: var(--text-sm);
      }

      .faq span {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .cta-banner {
        border-radius: var(--border-radius-xl);
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: linear-gradient(120deg, #0f2f47, #375873);
        color: #f4f8fc;
        padding: var(--space-5);
        display: grid;
        gap: var(--space-2);
      }

      .cta-banner h3,
      .cta-banner p {
        margin: 0;
      }

      .cta-banner p {
        font-size: var(--text-md);
        color: rgba(244, 248, 252, 0.9);
      }

      .cta-banner .btn-row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .btn-ghost-light {
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.08);
        color: #f4f8fc;
      }

      @media (max-width: 980px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .pair {
          grid-template-columns: 1fr;
        }

        .cards {
          grid-template-columns: 1fr;
        }

        .cards.two,
        .cards.four {
          grid-template-columns: 1fr;
        }

        .trust-list {
          grid-template-columns: 1fr 1fr;
        }

        .kpi-grid {
          grid-template-columns: 1fr 1fr;
        }

        .visual-row {
          grid-template-columns: 1fr;
        }

      }

      @media (max-width: 640px) {
        .surface {
          padding-left: var(--space-4);
          padding-right: var(--space-4);
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + var(--space-8));
          gap: clamp(21px, 5.6vw, 32px);
        }

        .topbar {
          align-items: flex-start;
          gap: var(--space-3);
          flex-direction: column;
        }

        .nav {
          width: 100%;
          flex-wrap: wrap;
        }

        .hero {
          padding: var(--space-5);
        }

        .hero-actions .btn {
          width: 100%;
          min-width: 0;
        }

        .hero-meta {
          grid-template-columns: 1fr;
        }

        .trust-list {
          grid-template-columns: 1fr;
        }

        .kpi-grid {
          grid-template-columns: 1fr;
        }

      }
    `,
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
      <screen-shell screen="landing" .showSheetControls=${false}>
        <div class="surface">
          <header class="topbar">
            <div class="brand">
              <img class="brand-logo" src="/favicon.svg" alt="2bottles logo" />
              <div class="brand-copy"><div class="brand-title">2bottles</div></div>
            </div>

            <nav class="nav" aria-label="Landing sections">
              <a href="#flow" class="nav-chip">Flow</a>
              <a href="#fairness" class="nav-chip">Fairness</a>
              <a href="#faq" class="nav-chip">FAQ</a>
            </nav>
          </header>

          <section class="hero" id="top">
            <div class="hero-copy">
              <div class="hero-eyebrow">REALTIME RENDEZVOUS</div>
              <div class="hero-title">Get to "where should we meet?" in one clean flow.</div>
              <p class="hero-sub">
                Send one link, choose a balanced location, and watch both routes update in real time.
                2bottles removes negotiation friction without removing human context.
              </p>

              <div class="hero-actions">
                <button class="btn btn-primary" @click=${() => this._emit('start')}>Start Session</button>
                ${this.canInstall
                  ? html`<button class="btn hero-secondary" @click=${() => this._emit('install')}>Install App</button>`
                  : ''}
              </div>
            </div>

            <div class="hero-preview">
              <img class="hero-image" src="/illustrations/landing-route-radar.svg" alt="Route radar with midpoint convergence" loading="eager" />
              <div class="hero-meta">
                <div class="hero-metric">
                  <strong>2 taps</strong>
                  <span>to invite partner</span>
                </div>
                <div class="hero-metric">
                  <strong>Live ETA</strong>
                  <span>for both people</span>
                </div>
                <div class="hero-metric">
                  <strong>Balanced</strong>
                  <span>midpoint recommendations</span>
                </div>
              </div>
            </div>
          </section>

          <section class="section strip">
            <div class="trust-list">
              <div class="trust-item">Balanced midpoint logic</div>
              <div class="trust-item">Live route + ETA context</div>
              <div class="trust-item">Invite with one link</div>
              <div class="trust-item">Works as installable PWA</div>
            </div>
          </section>

          <section class="section" id="flow">
            <div class="section-head">
              <div class="section-title">How it feels in practice</div>
              <div class="section-sub">Fast, fair, and visually clear from invite to arrival.</div>
            </div>

            <div class="cards">
              <article class="card">
                <h4>Create + Invite</h4>
                <p>Start your session and share one link. No setup fatigue or repeated context sharing.</p>
              </article>
              <article class="card">
                <h4>Agree Faster</h4>
                <p>Fair venue options reduce back-and-forth by balancing travel burden across both people.</p>
              </article>
              <article class="card">
                <h4>Track Together</h4>
                <p>Live movement and status updates keep both participants aligned until arrival.</p>
              </article>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">Product surfaces</div>
              <div class="section-sub">Custom visual system for planning, ranking, and live sync.</div>
            </div>

            <div class="visual-row">
              <article class="visual">
                <img src="/illustrations/landing-fairness-board.svg" alt="Fairness board with route delta and venue score" loading="lazy" />
                <div class="visual-copy">
                  <strong>Fairness board</strong>
                  <span>Route delta, venue quality, and confidence are visible at a glance.</span>
                </div>
              </article>

              <article class="visual">
                <img src="/illustrations/landing-live-sync-grid.svg" alt="Live session grid with synchronized ETA signals" loading="lazy" />
                <div class="visual-copy">
                  <strong>Live sync grid</strong>
                  <span>Status stream and ETA telemetry stay aligned for both participants.</span>
                </div>
              </article>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">Why normal meetup planning fails</div>
              <div class="section-sub">Most plans break on fairness, context switching, and stale updates.</div>
            </div>

            <div class="cards two">
              <article class="card">
                <h4>One person does all the travel</h4>
                <p>Without a midpoint model, travel burden is silently uneven and causes friction.</p>
              </article>
              <article class="card">
                <h4>Coordination happens in scattered chat threads</h4>
                <p>Links, ETAs, and choices get buried across apps, so people lose shared context.</p>
              </article>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">Session flow, step by step</div>
              <div class="section-sub">One sequence from invite to arrival, no side quests.</div>
            </div>

            <div class="timeline">
              <div class="timeline-row">
                <div class="step-dot">1</div>
                <div class="step-copy">
                  <strong>Create and share</strong>
                  <span>Host creates a session and sends one link to a partner.</span>
                </div>
              </div>
              <div class="timeline-row">
                <div class="step-dot">2</div>
                <div class="step-copy">
                  <strong>Pick the meeting point</strong>
                  <span>Venue suggestions are computed from both positions and shown with clear tradeoffs.</span>
                </div>
              </div>
              <div class="timeline-row">
                <div class="step-dot">3</div>
                <div class="step-copy">
                  <strong>Track progress together</strong>
                  <span>Both participants see updates, statuses, and route changes in real time.</span>
                </div>
              </div>
            </div>
          </section>

          <section class="section" id="fairness">
            <div class="section-head">
              <div class="section-title">Fairness engine, not guesswork</div>
              <div class="section-sub">Venue ranking focuses on shared travel effort, not random proximity.</div>
            </div>

            <div class="pair">
              <article class="visual">
                <img src="/illustrations/landing-map-scene.svg" alt="Map scene showing balanced midpoint exploration" loading="lazy" />
                <div class="visual-copy">
                  <strong>Midpoint map context</strong>
                  <span>Both routes are evaluated together before a venue is recommended.</span>
                </div>
              </article>

              <div class="cards stack-cards">
                <article class="card">
                  <h4>Distance balancing</h4>
                  <p>Recommendations prefer options that reduce one-sided detours.</p>
                </article>
                <article class="card">
                  <h4>Venue quality filters</h4>
                  <p>Suggestions include practical places people can actually meet.</p>
                </article>
                <article class="card">
                  <h4>Fast recompute loop</h4>
                  <p>If either person moves, the suggestion context can refresh quickly.</p>
                </article>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">Live intelligence while traveling</div>
              <div class="section-sub">The app stays useful after a venue is chosen.</div>
            </div>

            <div class="cards four">
              <article class="card">
                <h4>Live ETA</h4>
                <p>Each user can see timing context without manual check-ins.</p>
              </article>
              <article class="card">
                <h4>Status sync</h4>
                <p>Joined, en route, and arrived states remain aligned across devices.</p>
              </article>
              <article class="card">
                <h4>Route context</h4>
                <p>Map updates make route changes visible when conditions shift.</p>
              </article>
              <article class="card">
                <h4>Resilient messaging</h4>
                <p>Realtime transport keeps session events flowing under unstable connectivity.</p>
              </article>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">Visual proof of the flow</div>
              <div class="section-sub">Dedicated session-state canvas for invite-to-arrival visibility.</div>
            </div>

            <article class="visual">
              <img src="/illustrations/landing-duo-flow.svg" alt="Synchronized session stream showing shared movement state" loading="lazy" />
              <div class="visual-copy">
                <strong>Dual-participant coordination</strong>
                <span>Both sides stay in lockstep through invite, choice, and movement.</span>
              </div>
            </article>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">Performance snapshot</div>
              <div class="section-sub">Built for fast practical decisions, not long planning threads.</div>
            </div>

            <div class="kpi-grid">
              <div class="kpi">
                <strong>2 taps</strong>
                <span>invite partner into session</span>
              </div>
              <div class="kpi">
                <strong>1 link</strong>
                <span>for a complete shared context</span>
              </div>
              <div class="kpi">
                <strong>Live</strong>
                <span>state updates during travel</span>
              </div>
              <div class="kpi">
                <strong>Fair</strong>
                <span>venue recommendations by design</span>
              </div>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">People-first use cases</div>
              <div class="section-sub">Designed for routine coordination, not one-off novelty.</div>
            </div>

            <div class="cards">
              <article class="card">
                <h4>Friends meeting after work</h4>
                <p>Find a balanced cafe between neighborhoods without a long negotiation loop.</p>
              </article>
              <article class="card">
                <h4>Study partners syncing quickly</h4>
                <p>Pick neutral venues and avoid wasting time deciding where to meet.</p>
              </article>
              <article class="card">
                <h4>Date-night planning</h4>
                <p>Keep the decision fair and transparent before either person starts moving.</p>
              </article>
            </div>
          </section>

          <section class="section">
            <div class="section-head">
              <div class="section-title">What users care about</div>
              <div class="section-sub">Feedback themes we optimize around.</div>
            </div>

            <div class="cards two">
              <article class="quote">
                <p>"The midpoint options stop the subtle argument about whose side of town wins."</p>
                <span>Early tester, weekly meetup planner</span>
              </article>
              <article class="quote">
                <p>"Seeing both ETAs in one view removed most of our back-and-forth texting."</p>
                <span>Early tester, campus commuter</span>
              </article>
            </div>
          </section>

          <section class="section" id="faq">
            <div class="section-head">
              <div class="section-title">FAQ</div>
              <div class="section-sub">Straight answers for common concerns.</div>
            </div>

            <div class="cards two">
              <article class="faq">
                <strong>Does everyone need to install the app?</strong>
                <span>No. A partner can join via shared link. Install is optional for faster repeat use.</span>
              </article>
              <article class="faq">
                <strong>Is location sharing always on?</strong>
                <span>Location is session-driven. Participants control access through permission prompts.</span>
              </article>
              <article class="faq">
                <strong>Can I use it for quick ad-hoc plans?</strong>
                <span>Yes. It is optimized for short planning loops and immediate decisions.</span>
              </article>
              <article class="faq">
                <strong>What if someone loses connectivity?</strong>
                <span>Realtime updates are designed with resilient transport behavior and session recovery.</span>
              </article>
            </div>
          </section>

          <section class="cta-banner">
            <h3>Stop negotiating the map. Start moving.</h3>
            <p>Launch a session in seconds and let 2bottles handle fair venue context + live coordination.</p>
            <div class="btn-row">
              <button class="btn btn-primary" @click=${() => this._emit('start')}>Start Session</button>
              ${this.canInstall
                ? html`<button class="btn btn-ghost-light" @click=${() => this._emit('install')}>Install App</button>`
                : ''}
            </div>
          </section>

        </div>
      </screen-shell>
    `;
  }
}
