/**
 * <landing-page> — marketing entry experience.
 *
 * Responsibilities:
 *   present product value and flow highlights
 *   expose explicit start/install actions
 *   hand off users into the routed app when a CTA is clicked
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { sharedStyles } from '../../styles/shared-styles.js';

type LandingCta = 'start' | 'install' | 'skip';

@customElement('landing-page')
export class LandingPage extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host {
        display: block;
        position: absolute;
        inset: 0;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        font-family: 'Sora', 'Space Grotesk', var(--font-sans);
        color: var(--color-text-primary);

        --ink: #0c1a27;
        --ink-soft: #253545;
        --ink-muted: #3d5568;
        --ink-faint: #6b8699;
        --blue: #2f6fa6;
        --blue-mid: #4a8bc4;
        --blue-dark: #0e3d66;
        --blue-light: #dfedfb;
        --green: #7ab84a;
        --green-mid: #5da030;
        --green-dark: #294f10;
        --green-light: #e4f3d0;
        --surface: #f5f9fd;
        --white: #ffffff;
        --border: rgba(12, 26, 39, 0.11);
        --border-strong: rgba(12, 26, 39, 0.2);
        --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
        --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
      }

      /* ── RESET ── */
      * { box-sizing: border-box; margin: 0; padding: 0; }

      /* ── NAV ── */
      .nav {
        position: sticky;
        top: 0;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 15px 48px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(14px);
        border-bottom: 1px solid var(--border);
      }

      .nav-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 17px;
        font-weight: 700;
        color: var(--ink);
        text-decoration: none;
      }

      .logo-mark {
        width: 30px;
        height: 30px;
        border-radius: 9px;
        background: linear-gradient(135deg, var(--blue), var(--green));
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .nav-links {
        display: flex;
        align-items: center;
        gap: 30px;
      }

      .nav-links a {
        font-size: 13px;
        font-weight: 500;
        color: var(--ink-muted);
        text-decoration: none;
        transition: color 0.2s;
      }

      .nav-links a:hover { color: var(--ink); }

      .nav-cta {
        background: var(--ink);
        color: #ffffff;
        border: none;
        border-radius: 10px;
        padding: 10px 20px;
        font-size: 13px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: transform 0.2s var(--ease-spring), background 0.2s;
      }

      .nav-cta:hover {
        transform: translateY(-1px);
        background: var(--blue-dark);
      }

      /* ── HERO ── */
      .hero {
        display: grid;
        grid-template-columns: 1.1fr 1fr;
        align-items: center;
        min-height: calc(100dvh - 61px);
        padding: 72px 48px 64px;
        gap: 64px;
        position: relative;
        overflow: hidden;
      }

      .hero-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
        background:
          radial-gradient(900px 600px at -8% 110%, rgba(122, 184, 74, 0.08) 0%, transparent 60%),
          radial-gradient(800px 500px at 110% -5%, rgba(47, 111, 166, 0.09) 0%, transparent 60%);
      }

      .hero-grid {
        position: absolute;
        inset: 0;
        z-index: 0;
        background-image:
          linear-gradient(rgba(12, 26, 39, 0.05) 1px, #ffffff 1px),
          linear-gradient(90deg, rgba(12, 26, 39, 0.05) 1px, #ffffff 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(ellipse at 50% 40%, black 20%, #ffffff 76%);
      }

      .hero-left {
        position: relative;
        z-index: 1;
      }

      /* Status chip — earned, not generic */
      .hero-status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 26px;
        padding: 7px 14px;
        border: 1px solid var(--border-strong);
        border-radius: 99px;
        background: var(--white);
        font-size: 12px;
        font-weight: 600;
        color: var(--ink-soft);
      }

      .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--green);
        animation: pulse 2s ease-in-out infinite;
      }

      .status-count {
        font-variant-numeric: tabular-nums;
        color: var(--blue);
      }

      .hero-title {
        font-size: clamp(40px, 5.2vw, 66px);
        font-weight: 800;
        line-height: 0.96;
        letter-spacing: -2.5px;
        color: var(--ink);
        margin-bottom: 22px;
      }

      .hero-title em {
        font-style: normal;
        background: linear-gradient(120deg, var(--blue-dark) 0%, var(--blue) 50%, var(--green-mid) 100%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .hero-sub {
        font-size: 16px;
        color: var(--ink-muted);
        line-height: 1.7;
        max-width: 44ch;
        margin-bottom: 34px;
      }

      .hero-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 28px;
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: var(--ink);
        color: #ffffff;
        border: none;
        border-radius: 12px;
        padding: 14px 22px;
        font-size: 14px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: transform 0.25s var(--ease-spring), box-shadow 0.25s;
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 14px 34px rgba(12, 26, 39, 0.22);
      }

      .btn-ghost {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: transparent;
        color: var(--ink-soft);
        border: 1px solid var(--border-strong);
        border-radius: 12px;
        padding: 14px 22px;
        font-size: 14px;
        font-weight: 500;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
      }

      .btn-ghost:hover {
        background: var(--surface);
        border-color: var(--blue);
        color: var(--ink);
      }

      .social-proof {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 13px;
        color: var(--ink-muted);
      }

      .avatar-stack { display: flex; }

      .avatar {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid #fff;
        margin-left: -7px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      }

      .avatar:first-child { margin-left: 0; }

      .hero-right {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: center;
      }

      .hero-card {
        width: 100%;
        max-width: 420px;
        filter: drop-shadow(0 24px 52px rgba(12, 26, 39, 0.13));
        animation: float 5s ease-in-out infinite;
      }

      /* ── SECTION BASE ── */
      .section { padding: 96px 48px; }
      .section-inner { max-width: 1120px; margin: 0 auto; }

      .section-kicker {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.6px;
        text-transform: uppercase;
        margin-bottom: 14px;
      }

      .section-title {
        font-size: clamp(28px, 3.2vw, 44px);
        font-weight: 800;
        letter-spacing: -1.5px;
        line-height: 1.04;
        margin-bottom: 18px;
      }

      .section-body {
        font-size: 16px;
        line-height: 1.72;
        max-width: 50ch;
      }

      /* ── PROBLEM ── */
      .problem-section {
        background: var(--ink);
        color: #fff;
        overflow: hidden;
        position: relative;
      }

      .problem-section .section-inner {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 80px;
        align-items: center;
      }

      .problem-section .section-kicker { color: rgba(255, 255, 255, 0.45); }
      .problem-section .section-title { color: #fff; }
      .problem-section .section-body { color: rgba(255, 255, 255, 0.72); }
      .problem-accent { color: var(--green); }

      /* ── HOW IT WORKS ── */
      .how-section { background: var(--surface); }

      .how-section .section-inner { text-align: center; }

      .how-section .section-kicker { color: var(--blue); }

      .how-section .section-title { color: var(--ink); }

      .steps-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 24px;
        margin-bottom: 52px;
        text-align: left;
      }

      .step-card {
        border: 1px solid var(--border);
        border-radius: 20px;
        background: var(--white);
        padding: 28px;
        position: relative;
        overflow: hidden;
        transition: transform 0.3s var(--ease-spring), box-shadow 0.3s;
      }

      .step-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 48px rgba(12, 26, 39, 0.09);
      }

      .step-num {
        font-family: 'DM Mono', var(--font-mono), monospace;
        font-size: 10px;
        font-weight: 500;
        color: var(--blue);
        border: 1px solid rgba(47, 111, 166, 0.25);
        border-radius: 6px;
        padding: 3px 8px;
        display: inline-block;
        margin-bottom: 16px;
        background: var(--blue-light);
      }

      .step-card h3 {
        font-size: 17px;
        font-weight: 700;
        color: var(--ink);
        margin-bottom: 10px;
        letter-spacing: -0.3px;
      }

      .step-card p {
        font-size: 14px;
        color: var(--ink-muted);
        line-height: 1.65;
      }

      .step-icon { margin-bottom: 18px; }

      /* ── FAIRNESS ── */
      .fairness-section { background: var(--white); }

      .fairness-section .section-inner {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 80px;
        align-items: center;
      }

      .fairness-section .section-kicker { color: var(--blue); }
      .fairness-section .section-title { color: var(--ink); }
      .fairness-section .section-body { color: var(--ink-muted); }

      .fairness-points {
        display: grid;
        gap: 22px;
        margin-top: 28px;
      }

      .fairness-point {
        display: flex;
        gap: 14px;
        align-items: flex-start;
      }

      .fp-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .fp-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--ink);
        margin-bottom: 4px;
      }

      .fp-desc {
        font-size: 13px;
        color: var(--ink-muted);
        line-height: 1.6;
      }

      /* ── TESTIMONIALS ── */
      .testimonials-section { background: var(--surface); }
      .testimonials-section .section-inner { text-align: center; }
      .testimonials-section .section-kicker { color: var(--blue); }
      .testimonials-section .section-title { color: var(--ink); }

      .tgrid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-top: 44px;
        text-align: left;
      }

      .tcard {
        border: 1px solid var(--border);
        border-radius: 18px;
        background: var(--white);
        padding: 24px;
      }

      .tcard-quote {
        font-size: 14px;
        line-height: 1.72;
        color: var(--ink-soft);
        margin-bottom: 20px;
      }

      .tcard-author {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .tcard-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      }

      .tcard-name {
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
      }

      .tcard-role {
        font-size: 12px;
        color: var(--ink-faint);
        margin-top: 2px;
      }

      /* ── STATS ── */
      .stats-section {
        background: var(--ink);
        color: #fff;
        padding: 72px 48px;
      }

      .stats-section .section-inner {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 32px;
        text-align: center;
      }

      .stat-num {
        font-size: clamp(34px, 4vw, 52px);
        font-weight: 800;
        letter-spacing: -2px;
      }

      .stat-label {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.5);
        margin-top: 4px;
      }

      /* ── CTA ── */
      .cta-section {
        padding: 112px 48px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      .cta-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
        background: radial-gradient(900px 500px at 50% 100%, rgba(47, 111, 166, 0.07), transparent 70%);
      }

      .cta-section .section-inner { position: relative; z-index: 1; }

      .cta-section .section-title { margin-bottom: 18px; }

      .cta-sub {
        font-size: 16px;
        color: var(--ink-muted);
        max-width: 50ch;
        margin: 0 auto 36px;
        line-height: 1.68;
      }

      .cta-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
        margin-bottom: 18px;
      }

      .cta-fine {
        font-size: 12px;
        color: var(--ink-faint);
      }

      /* ── FOOTER ── */
      .footer {
        border-top: 1px solid var(--border);
        padding: 28px 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        color: var(--ink-faint);
      }

      .footer-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: var(--ink);
      }

      .footer-links {
        display: flex;
        gap: 22px;
      }

      .footer-links a {
        color: var(--ink-faint);
        text-decoration: none;
        transition: color 0.2s;
      }

      .footer-links a:hover { color: var(--ink); }

      /* ── ANIMATIONS ── */
      @keyframes pulse {
        0%, 100% { transform: scale(0.85); opacity: 0.65; }
        50%       { transform: scale(1.3);  opacity: 1; }
      }

      @keyframes float {
        0%, 100% { transform: translateY(0);    }
        50%       { transform: translateY(-9px); }
      }

      /* ── SCROLL REVEAL ── */
      .reveal {
        opacity: 0;
        transform: translateY(22px);
        transition: opacity 0.72s var(--ease-out), transform 0.72s var(--ease-out);
      }

      .reveal.visible {
        opacity: 1;
        transform: translateY(0);
      }

      /* ── RESPONSIVE ── */
      @media (max-width: 900px) {
        .nav { padding: 14px 22px; }
        .nav-links { display: none; }
        .hero { grid-template-columns: 1fr; padding: 60px 22px 52px; min-height: auto; gap: 44px; }
        .hero-right { display: none; }
        .section { padding: 64px 22px; }
        .problem-section .section-inner,
        .fairness-section .section-inner { grid-template-columns: 1fr; gap: 44px; }
        .steps-grid { grid-template-columns: 1fr; gap: 16px; }
        .tgrid { grid-template-columns: 1fr; gap: 14px; }
        .stats-section .section-inner { grid-template-columns: repeat(2, 1fr); }
        .footer { flex-direction: column; gap: 14px; text-align: center; }
      }
    `,
  ];

  @property({ type: Boolean }) canInstall = false;

  private _emit(action: LandingCta, sourceEvent?: Event) {
    this.dispatchEvent(new CustomEvent('landing-action', {
      detail: {
        action,
        byUserClick: Boolean(sourceEvent?.isTrusted),
      },
      bubbles: true,
      composed: true,
    }));
  }

  override firstUpdated() {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 },
    );
    this.renderRoot.querySelectorAll('.reveal').forEach((el) => obs.observe(el));
  }

  /* ── SVG ILLUSTRATIONS ── */

  private _heroCardSvg() {
    return html`
      <svg class="hero-card" viewBox="0 0 420 490" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Card shell -->
        <rect x="8" y="8" width="404" height="474" rx="22" fill="white" stroke="rgba(12,26,39,0.09)" stroke-width="1"/>

        <!-- Map background -->
        <rect x="24" y="56" width="372" height="272" rx="12" fill="#eef5fb"/>

        <!-- Street grid (subtle) -->
        <line x1="24"  y1="180" x2="396" y2="180" stroke="rgba(47,111,166,0.07)" stroke-width="5"/>
        <line x1="24"  y1="228" x2="396" y2="228" stroke="rgba(47,111,166,0.06)" stroke-width="4"/>
        <line x1="168" y1="56"  x2="168" y2="328" stroke="rgba(47,111,166,0.07)" stroke-width="4"/>
        <line x1="264" y1="56"  x2="264" y2="328" stroke="rgba(47,111,166,0.06)" stroke-width="4"/>
        <line x1="80"  y1="56"  x2="80"  y2="328" stroke="rgba(47,111,166,0.05)" stroke-width="3"/>
        <line x1="350" y1="56"  x2="350" y2="328" stroke="rgba(47,111,166,0.05)" stroke-width="3"/>

        <!-- Lagoon blob -->
        <ellipse cx="88" cy="306" rx="60" ry="26" fill="rgba(47,111,166,0.10)" stroke="rgba(47,111,166,0.15)" stroke-width="1"/>

        <!-- Route A — dashed blue -->
        <path d="M82 278 Q112 260 148 244 Q178 230 206 215" stroke="#2f6fa6" stroke-width="2.5" fill="none" stroke-dasharray="7 5" stroke-linecap="round" opacity=".75"/>

        <!-- Route B — dashed green -->
        <path d="M320 108 Q302 136 284 162 Q264 188 244 206" stroke="#5da030" stroke-width="2.5" fill="none" stroke-dasharray="7 5" stroke-linecap="round" opacity=".75"/>

        <!-- Midpoint glow rings -->
        <circle cx="222" cy="213" r="38" fill="rgba(47,111,166,0.07)"/>
        <circle cx="222" cy="213" r="24" fill="rgba(47,111,166,0.11)"/>

        <!-- Midpoint pin -->
        <circle cx="222" cy="213" r="13" fill="#2f6fa6"/>
        <circle cx="222" cy="213" r="8"  fill="white"/>
        <circle cx="222" cy="213" r="4"  fill="#2f6fa6"/>

        <!-- Pin A -->
        <ellipse cx="82" cy="290" rx="9" ry="4" fill="rgba(47,111,166,0.18)"/>
        <path d="M82 278 C82 278 71 265 71 258 C71 251.4 76 246 82 246 C88 246 93 251.4 93 258 C93 265 82 278 82 278Z" fill="#2f6fa6"/>
        <circle cx="82" cy="257" r="5" fill="white"/>
        <text x="82" y="260" text-anchor="middle" font-size="6.5" font-weight="700" fill="#2f6fa6" font-family="Sora,sans-serif">A</text>

        <!-- ETA A -->
        <rect x="98" y="248" width="40" height="18" rx="9" fill="white" stroke="rgba(47,111,166,0.28)" stroke-width="1"/>
        <text x="118" y="260" text-anchor="middle" font-size="8.5" font-weight="600" fill="#0e3d66" font-family="Sora,sans-serif">12 min</text>

        <!-- Pin B -->
        <ellipse cx="320" cy="122" rx="9" ry="4" fill="rgba(93,160,48,0.18)"/>
        <path d="M320 110 C320 110 309 97 309 90 C309 83.4 314 78 320 78 C326 78 331 83.4 331 90 C331 97 320 110 320 110Z" fill="#5da030"/>
        <circle cx="320" cy="89" r="5" fill="white"/>
        <text x="320" y="92" text-anchor="middle" font-size="6.5" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">B</text>

        <!-- ETA B -->
        <rect x="278" y="97" width="40" height="18" rx="9" fill="white" stroke="rgba(93,160,48,0.3)" stroke-width="1"/>
        <text x="298" y="109" text-anchor="middle" font-size="8.5" font-weight="600" fill="#294f10" font-family="Sora,sans-serif">14 min</text>

        <!-- Venue popup -->
        <rect x="234" y="164" width="148" height="60" rx="12" fill="white" stroke="rgba(12,26,39,0.10)" stroke-width="1"/>
        <rect x="234" y="164" width="4"   height="60" rx="2" fill="#2f6fa6"/>
        <text x="249" y="182" font-size="10.5" font-weight="700" fill="#0c1a27" font-family="Sora,sans-serif">Muri Square Café</text>
        <text x="249" y="197" font-size="9"    fill="#3d5568"  font-family="Sora,sans-serif">Fair for both · 0.4 km</text>
        <rect x="249" y="206" width="52" height="10" rx="5" fill="#e4f3d0"/>
        <text x="275" y="214" text-anchor="middle" font-size="7.5" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">✓ Best match</text>

        <!-- Map header bar -->
        <rect x="24" y="56" width="372" height="32" rx="12" fill="white"/>
        <rect x="24" y="76"  width="372" height="12" fill="white"/>
        <text x="40" y="77"  font-size="10.5" font-weight="600" fill="#0c1a27" font-family="Sora,sans-serif">Live Rendezvous</text>
        <circle cx="380" cy="72" r="5" fill="#7ab84a"/>
        <text x="368" y="76" font-size="7.5" font-weight="600" fill="#294f10" font-family="Sora,sans-serif">LIVE</text>

        <!-- Bottom panel -->
        <rect x="24" y="338" width="372" height="126" rx="12" fill="white"/>

        <text x="40" y="360" font-size="12" font-weight="700" fill="#0c1a27" font-family="Sora,sans-serif">Fairest meeting point found</text>

        <!-- Person A bar -->
        <text x="40" y="381" font-size="9.5" fill="#3d5568" font-family="Sora,sans-serif">Person A</text>
        <rect x="100" y="371" width="192" height="8" rx="4" fill="#eef5fb"/>
        <rect x="100" y="371" width="115" height="8" rx="4" fill="#2f6fa6"/>
        <text x="300" y="380" font-size="9.5" font-weight="600" fill="#0e3d66" font-family="Sora,sans-serif">12 min</text>

        <!-- Person B bar -->
        <text x="40" y="400" font-size="9.5" fill="#3d5568" font-family="Sora,sans-serif">Person B</text>
        <rect x="100" y="390" width="192" height="8" rx="4" fill="#eef5fb"/>
        <rect x="100" y="390" width="135" height="8" rx="4" fill="#5da030"/>
        <text x="300" y="399" font-size="9.5" font-weight="600" fill="#294f10" font-family="Sora,sans-serif">14 min</text>

        <!-- Fairness chip + CTA -->
        <rect x="40"  y="415" width="90"  height="26" rx="13" fill="#e4f3d0"/>
        <text x="85"  y="432" text-anchor="middle" font-size="9.5" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">⚖ 96% fair</text>

        <rect x="140" y="415" width="118" height="26" rx="13" fill="#0c1a27"/>
        <text x="199" y="432" text-anchor="middle" font-size="9.5" font-weight="600" fill="#ffffff" font-family="Sora,sans-serif">Confirm venue →</text>
      </svg>
    `;
  }

  private _problemSvg() {
    return html`
      <svg width="100%" viewBox="0 0 380 290" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Without label -->
        <text x="190" y="22" text-anchor="middle" font-size="10.5" font-weight="600" fill="rgba(255,255,255,0.38)" font-family="Sora,sans-serif">Without 2bottles</text>

        <!-- Road -->
        <line x1="64"  y1="90" x2="316" y2="90" stroke="rgba(255,255,255,0.09)" stroke-width="10" stroke-linecap="round"/>

        <!-- Person A -->
        <circle cx="46"  cy="90" r="19" fill="rgba(47,111,166,0.22)" stroke="#4a8bc4" stroke-width="1.5"/>
        <text   x="46"  y="95" text-anchor="middle" font-size="11"  font-weight="700" fill="#85b7eb" font-family="Sora,sans-serif">A</text>

        <!-- Person B -->
        <circle cx="334" cy="90" r="19" fill="rgba(93,160,48,0.22)"  stroke="#7ab84a" stroke-width="1.5"/>
        <text   x="334" y="95" text-anchor="middle" font-size="11"  font-weight="700" fill="#c0dd97" font-family="Sora,sans-serif">B</text>

        <!-- Unfair pin — skewed left -->
        <line x1="128" y1="68" x2="128" y2="112" stroke="rgba(232,89,60,0.75)" stroke-width="2"/>
        <circle cx="128" cy="64" r="10" fill="#E8593C"/>
        <text   x="128" y="68" text-anchor="middle" font-size="9"  font-weight="700" fill="white" font-family="Sora,sans-serif">✕</text>

        <!-- Distance labels -->
        <text x="87"  y="82" text-anchor="middle" font-size="9" font-weight="600" fill="#E8593C"             font-family="Sora,sans-serif">20 min</text>
        <text x="232" y="82" text-anchor="middle" font-size="9" font-weight="500" fill="rgba(255,255,255,0.38)" font-family="Sora,sans-serif">48 min</text>
        <text x="128" y="130" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.4)"              font-family="Sora,sans-serif">"the usual spot"</text>

        <!-- Divider -->
        <line x1="40" y1="155" x2="340" y2="155" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

        <!-- With label -->
        <text x="190" y="177" text-anchor="middle" font-size="10.5" font-weight="600" fill="rgba(122,184,74,0.75)" font-family="Sora,sans-serif">With 2bottles</text>

        <!-- Road 2 -->
        <line x1="64"  y1="232" x2="316" y2="232" stroke="rgba(255,255,255,0.09)" stroke-width="10" stroke-linecap="round"/>

        <!-- Person A2 -->
        <circle cx="46"  cy="232" r="19" fill="rgba(47,111,166,0.22)" stroke="#4a8bc4" stroke-width="1.5"/>
        <text   x="46"  y="237" text-anchor="middle" font-size="11"  font-weight="700" fill="#85b7eb" font-family="Sora,sans-serif">A</text>

        <!-- Person B2 -->
        <circle cx="334" cy="232" r="19" fill="rgba(93,160,48,0.22)"  stroke="#7ab84a" stroke-width="1.5"/>
        <text   x="334" y="237" text-anchor="middle" font-size="11"  font-weight="700" fill="#c0dd97" font-family="Sora,sans-serif">B</text>

        <!-- Route dashes -->
        <line x1="67"  y1="232" x2="179" y2="232" stroke="#4a8bc4" stroke-width="2" stroke-dasharray="5 3" opacity=".65"/>
        <line x1="313" y1="232" x2="201" y2="232" stroke="#7ab84a" stroke-width="2" stroke-dasharray="5 3" opacity=".65"/>

        <!-- Fair pin -->
        <line x1="190" y1="210" x2="190" y2="252" stroke="rgba(122,184,74,0.75)" stroke-width="2"/>
        <circle cx="190" cy="206" r="10" fill="#5da030"/>
        <text   x="190" y="210" text-anchor="middle" font-size="9"  font-weight="700" fill="white" font-family="Sora,sans-serif">✓</text>

        <!-- Equal ETAs -->
        <text x="115" y="224" text-anchor="middle" font-size="9" font-weight="600" fill="#85b7eb" font-family="Sora,sans-serif">22 min</text>
        <text x="262" y="224" text-anchor="middle" font-size="9" font-weight="600" fill="#c0dd97" font-family="Sora,sans-serif">23 min</text>
        <text x="190" y="268" text-anchor="middle" font-size="9" fill="rgba(122,184,74,0.65)" font-family="Sora,sans-serif">Balanced for both</text>
      </svg>
    `;
  }

  private _flowSvg() {
    return html`
      <svg width="100%" viewBox="0 0 680 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </marker>
        </defs>

        <!-- Step 1 -->
        <rect x="20" y="52" width="108" height="56" rx="12" fill="#dfedfb" stroke="rgba(47,111,166,0.22)" stroke-width="1"/>
        <text x="74" y="78" text-anchor="middle" font-size="12" font-weight="700" fill="#0e3d66" font-family="Sora,sans-serif">Share</text>
        <text x="74" y="96" text-anchor="middle" font-size="10" fill="#2f6fa6"  font-family="Sora,sans-serif">location pins</text>

        <line x1="130" y1="80" x2="158" y2="80" stroke="#2f6fa6" stroke-width="1.5" marker-end="url(#arr)" opacity=".45"/>

        <!-- Step 2 -->
        <rect x="160" y="52" width="108" height="56" rx="12" fill="#dfedfb" stroke="rgba(47,111,166,0.22)" stroke-width="1"/>
        <text x="214" y="78" text-anchor="middle" font-size="12" font-weight="700" fill="#0e3d66" font-family="Sora,sans-serif">Invite</text>
        <text x="214" y="96" text-anchor="middle" font-size="10" fill="#2f6fa6"  font-family="Sora,sans-serif">partner joins</text>

        <line x1="270" y1="80" x2="298" y2="80" stroke="#2f6fa6" stroke-width="1.5" marker-end="url(#arr)" opacity=".45"/>

        <!-- Step 3 — highlighted -->
        <rect x="300" y="40" width="124" height="80" rx="14" fill="#2f6fa6"/>
        <text x="362" y="72" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff"              font-family="Sora,sans-serif">Fairness</text>
        <text x="362" y="90" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.78)" font-family="Sora,sans-serif">engine ranks</text>
        <text x="362" y="107" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.6)"  font-family="Sora,sans-serif">venues</text>

        <line x1="426" y1="80" x2="454" y2="80" stroke="#5da030" stroke-width="1.5" marker-end="url(#arr)" opacity=".55"/>

        <!-- Step 4 -->
        <rect x="456" y="52" width="108" height="56" rx="12" fill="#e4f3d0" stroke="rgba(93,160,48,0.28)" stroke-width="1"/>
        <text x="510" y="78" text-anchor="middle" font-size="12" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">Confirm</text>
        <text x="510" y="96" text-anchor="middle" font-size="10" fill="#3d7318"  font-family="Sora,sans-serif">venue locked</text>

        <line x1="566" y1="80" x2="594" y2="80" stroke="#5da030" stroke-width="1.5" marker-end="url(#arr)" opacity=".55"/>

        <!-- Step 5 -->
        <rect x="596" y="52" width="68" height="56" rx="12" fill="#e4f3d0" stroke="rgba(93,160,48,0.28)" stroke-width="1"/>
        <text x="630" y="82" text-anchor="middle" font-size="20" font-family="Sora,sans-serif">🚗</text>
        <text x="630" y="98" text-anchor="middle" font-size="9.5" font-weight="600" fill="#294f10" font-family="Sora,sans-serif">Go!</text>

        <!-- Step labels -->
        <text x="74"  y="130" text-anchor="middle" font-size="10" fill="#6b8699" font-family="Sora,sans-serif">Step 1</text>
        <text x="214" y="130" text-anchor="middle" font-size="10" fill="#6b8699" font-family="Sora,sans-serif">Step 2</text>
        <text x="362" y="136" text-anchor="middle" font-size="10" font-weight="600" fill="#2f6fa6" font-family="Sora,sans-serif">Step 3 · the magic</text>
        <text x="510" y="130" text-anchor="middle" font-size="10" fill="#6b8699" font-family="Sora,sans-serif">Step 4</text>
        <text x="630" y="130" text-anchor="middle" font-size="10" fill="#294f10" font-family="Sora,sans-serif">Done</text>
      </svg>
    `;
  }

  private _engineSvg() {
    return html`
      <svg width="100%" viewBox="0 0 340 408" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Outer orbit rings -->
        <circle cx="170" cy="196" r="144" stroke="rgba(47,111,166,0.07)" stroke-width="1" stroke-dasharray="4 4"/>
        <circle cx="170" cy="196" r="112" stroke="rgba(47,111,166,0.11)" stroke-width="1" stroke-dasharray="3 5"/>

        <!-- Engine halo -->
        <circle cx="170" cy="196" r="74" fill="#dfedfb" stroke="rgba(47,111,166,0.18)" stroke-width="1.5"/>

        <!-- Engine core -->
        <circle cx="170" cy="196" r="52" fill="#2f6fa6"/>

        <!-- Scale icon -->
        <line x1="170" y1="174" x2="170" y2="218" stroke="white" stroke-width="2"   stroke-linecap="round"/>
        <line x1="152" y1="174" x2="188" y2="174" stroke="white" stroke-width="2"   stroke-linecap="round"/>
        <circle cx="152" cy="186" r="9"  fill="rgba(255,255,255,0.22)" stroke="white" stroke-width="1.5"/>
        <circle cx="188" cy="186" r="9"  fill="rgba(255,255,255,0.22)" stroke="white" stroke-width="1.5"/>
        <text x="152" y="190" text-anchor="middle" font-size="8" font-weight="700" fill="white" font-family="Sora,sans-serif">A</text>
        <text x="188" y="190" text-anchor="middle" font-size="8" font-weight="700" fill="white" font-family="Sora,sans-serif">B</text>
        <text x="170" y="212" text-anchor="middle" font-size="9" font-weight="700" fill="white" font-family="Sora,sans-serif">FAIR</text>

        <!-- Input: Traffic (top) -->
        <circle cx="170" cy="52" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="170" y="47"  text-anchor="middle" font-size="17" font-family="Sora,sans-serif">🚦</text>
        <text x="170" y="66"  text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="Sora,sans-serif">Traffic</text>
        <line x1="170" y1="82" x2="170" y2="122" stroke="#2f6fa6" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Routes (left-top) -->
        <circle cx="50" cy="152" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="50"  y="147" text-anchor="middle" font-size="17" font-family="Sora,sans-serif">🗺️</text>
        <text x="50"  y="166" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="Sora,sans-serif">Routes</text>
        <line x1="78" y1="168" x2="116" y2="182" stroke="#2f6fa6" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Timing (left-bottom) -->
        <circle cx="50" cy="248" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="50"  y="243" text-anchor="middle" font-size="17" font-family="Sora,sans-serif">🕐</text>
        <text x="50"  y="262" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="Sora,sans-serif">Timing</text>
        <line x1="78" y1="238" x2="116" y2="216" stroke="#2f6fa6" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Venues (right-top) -->
        <circle cx="290" cy="152" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="290" y="147" text-anchor="middle" font-size="17" font-family="Sora,sans-serif">⭐</text>
        <text x="290" y="166" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="Sora,sans-serif">Venues</text>
        <line x1="262" y1="168" x2="224" y2="182" stroke="#5da030" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Vibes (right-bottom) -->
        <circle cx="290" cy="248" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="290" y="243" text-anchor="middle" font-size="17" font-family="Sora,sans-serif">💬</text>
        <text x="290" y="262" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="Sora,sans-serif">Vibe</text>
        <line x1="262" y1="238" x2="224" y2="214" stroke="#5da030" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Output arrow -->
        <defs>
          <marker id="arr-g" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#5da030" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </marker>
        </defs>
        <line x1="170" y1="270" x2="170" y2="336" stroke="#5da030" stroke-width="2" marker-end="url(#arr-g)" opacity=".6"/>

        <!-- Output pill -->
        <rect x="90" y="338" width="160" height="46" rx="23" fill="#e4f3d0" stroke="rgba(93,160,48,0.38)" stroke-width="1"/>
        <text x="170" y="356" text-anchor="middle" font-size="10" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">Ranked fair venues</text>
        <text x="170" y="373" text-anchor="middle" font-size="9"  fill="#3d7318"  font-family="Sora,sans-serif">sorted by balance score</text>
      </svg>
    `;
  }

  private _ctaPathSvg() {
    return html`
      <svg width="100%" viewBox="0 0 560 112" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:36px">
        <!-- You -->
        <circle cx="40"  cy="56" r="20" fill="#dfedfb" stroke="#2f6fa6" stroke-width="1.5"/>
        <text   x="40"  y="60" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e3d66" font-family="Sora,sans-serif">You</text>

        <!-- Them -->
        <circle cx="520" cy="56" r="20" fill="#e4f3d0" stroke="#5da030" stroke-width="1.5"/>
        <text   x="520" y="60" text-anchor="middle" font-size="10.5" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">Them</text>

        <!-- Paths converging -->
        <path d="M62 56 Q160 28 262 56"  stroke="#2f6fa6" stroke-width="2" stroke-dasharray="6 4" fill="none" stroke-linecap="round" opacity=".6"/>
        <path d="M498 56 Q400 84 282 56" stroke="#5da030" stroke-width="2" stroke-dasharray="6 4" fill="none" stroke-linecap="round" opacity=".6"/>

        <!-- Meeting point -->
        <circle cx="272" cy="56" r="30" fill="rgba(47,111,166,0.07)" stroke="rgba(47,111,166,0.14)" stroke-width="1"/>
        <circle cx="272" cy="56" r="18" fill="#0c1a27"/>
        <text   x="272" y="52" text-anchor="middle" font-size="9.5" fill="white" font-family="Sora,sans-serif">meet</text>
        <text   x="272" y="65" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,0.72)" font-family="Sora,sans-serif">here</text>
      </svg>
    `;
  }

  override render() {
    return html`
      <!-- NAV -->
      <nav class="nav">
        <a class="nav-logo" href="#">
          <div class="logo-mark">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="5.5" cy="8" r="4" fill="white" opacity=".92"/>
              <circle cx="10.5" cy="8" r="4" fill="white" opacity=".6"/>
            </svg>
          </div>
          2bottles
        </a>
        <div class="nav-links">
          <a href="#how">How it works</a>
          <a href="#fairness">Fairness</a>
          <a href="#stories">Stories</a>
        </div>
        <button class="nav-cta" @click=${(event: Event) => this._emit('start', event)}>Start a rendezvous</button>
      </nav>

      <!-- HERO -->
      <section class="hero">
        <div class="hero-bg"></div>
        <div class="hero-grid"></div>
        <div class="hero-left">
          <div class="hero-status">
            <span class="status-dot"></span>
            <span class="status-count">4,200</span> meetups coordinated so far
          </div>
          <h1 class="hero-title">
            Meet in the<br>
            <em>middle.</em><br>
            Not yours.
          </h1>
          <p class="hero-sub">
            2bottles finds the genuinely fair meeting point between two people —
            factoring real routes and real time, not just the nearest dot on a map.
          </p>
          <div class="hero-actions">
            <button class="btn-primary" @click=${(event: Event) => this._emit('start', event)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M5.5 4.5L10.5 7.5L5.5 10.5V4.5Z" fill="white"/>
              </svg>
              Start a Rendezvous
            </button>
            <button class="btn-ghost">See how it works</button>
          </div>
          <div class="social-proof">
            <div class="avatar-stack">
              <div class="avatar" style="background:#2f6fa6">TI</div>
              <div class="avatar" style="background:#5da030">AF</div>
              <div class="avatar" style="background:#8a4fff">NK</div>
              <div class="avatar" style="background:#c04828">BF</div>
            </div>
            <span>People who stopped arguing about where to meet</span>
          </div>
        </div>
        <div class="hero-right">
          ${this._heroCardSvg()}
        </div>
      </section>

      <!-- PROBLEM -->
      <section class="problem-section section" id="problem">
        <div class="section-inner">
          <div class="reveal">
            <p class="section-kicker">The honest problem</p>
            <h2 class="section-title">
              "Let's meet<br>
              somewhere in the<br>
              <span class="problem-accent">middle."</span><br>
              Whose middle?
            </h2>
            <p class="section-body">
              That "middle" your friend suggested is probably near their neighbourhood.
              2bottles finds the point where both of you travel roughly the same
              time — not the same kilometres, not the same guess.
            </p>
          </div>
          <div class="reveal" style="transition-delay:.14s">
            ${this._problemSvg()}
          </div>
        </div>
      </section>

      <!-- HOW IT WORKS -->
      <section class="how-section section" id="how">
        <div class="section-inner">
          <p class="section-kicker reveal">How it works</p>
          <h2 class="section-title reveal" style="transition-delay:.08s">
            Three steps to a fair meetup
          </h2>

          <div class="steps-grid">
            <div class="step-card reveal" style="transition-delay:.04s">
              <div class="step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="13" fill="#dfedfb"/>
                  <path d="M24 10C18.5 10 14 14.5 14 20C14 28 24 38 24 38C24 38 34 28 34 20C34 14.5 29.5 10 24 10Z" fill="#2f6fa6" opacity=".18"/>
                  <path d="M24 12C19 12 15 16 15 21C15 28 24 37 24 37C24 37 33 28 33 21C33 16 29 12 24 12Z" fill="#2f6fa6"/>
                  <circle cx="24" cy="21" r="5" fill="white"/>
                </svg>
              </div>
              <div class="step-num">01</div>
              <h3>Drop your pin</h3>
              <p>Share your real location — or override with any address. Your partner does the same from wherever they are.</p>
            </div>
            <div class="step-card reveal" style="transition-delay:.11s">
              <div class="step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="13" fill="#e4f3d0"/>
                  <line x1="24" y1="12" x2="24" y2="36" stroke="#5da030" stroke-width="2" stroke-linecap="round"/>
                  <line x1="14" y1="12" x2="34" y2="12" stroke="#5da030" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="14" cy="19" r="7" fill="rgba(93,160,48,0.2)" stroke="#5da030" stroke-width="1.5"/>
                  <circle cx="34" cy="19" r="7" fill="rgba(93,160,48,0.2)" stroke="#5da030" stroke-width="1.5"/>
                  <text x="14" y="23" text-anchor="middle" font-size="7" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">A</text>
                  <text x="34" y="23" text-anchor="middle" font-size="7" font-weight="700" fill="#294f10" font-family="Sora,sans-serif">B</text>
                  <rect x="18" y="34" width="12" height="4" rx="2" fill="#5da030"/>
                </svg>
              </div>
              <div class="step-num">02</div>
              <h3>Engine calculates</h3>
              <p>Live traffic, route shape, time of day — all weighed to surface venues sorted by fairness, not just proximity.</p>
            </div>
            <div class="step-card reveal" style="transition-delay:.18s">
              <div class="step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="13" fill="#eceafe"/>
                  <path d="M15 25L21 31L33 19" stroke="#534ab7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="24" cy="24" r="13" stroke="#534ab7" stroke-width="1.5" opacity=".28"/>
                </svg>
              </div>
              <div class="step-num">03</div>
              <h3>Both confirm, both move</h3>
              <p>Pick from ranked venues, confirm together, then track each other live as you head to the same fair place.</p>
            </div>
          </div>

          <div class="reveal" style="transition-delay:.18s">
            ${this._flowSvg()}
          </div>
        </div>
      </section>

      <!-- FAIRNESS ENGINE -->
      <section class="fairness-section section" id="fairness">
        <div class="section-inner">
          <div class="reveal">
            ${this._engineSvg()}
          </div>
          <div class="reveal" style="transition-delay:.14s">
            <p class="section-kicker">The fairness engine</p>
            <h2 class="section-title">Not the nearest.<br>The <em style="font-style:normal;color:var(--blue)">fairest.</em></h2>
            <p class="section-body">
              Most apps find the midpoint on a map. We find the midpoint in time —
              accounting for traffic, road shape, and the quality of what's actually
              there when you arrive.
            </p>
            <div class="fairness-points">
              <div class="fairness-point">
                <div class="fp-icon" style="background:var(--blue-light)">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <line x1="10" y1="3" x2="10" y2="17" stroke="#2f6fa6" stroke-width="1.5" stroke-linecap="round"/>
                    <line x1="4" y1="3" x2="16" y2="3" stroke="#2f6fa6" stroke-width="1.5" stroke-linecap="round"/>
                    <circle cx="6" cy="9" r="3" fill="rgba(47,111,166,0.25)" stroke="#2f6fa6" stroke-width="1"/>
                    <circle cx="14" cy="9" r="3" fill="rgba(47,111,166,0.25)" stroke="#2f6fa6" stroke-width="1"/>
                  </svg>
                </div>
                <div>
                  <div class="fp-title">Equal travel time, not distance</div>
                  <div class="fp-desc">Distance is a lie in Lagos traffic. We score on minutes — not kilometres.</div>
                </div>
              </div>
              <div class="fairness-point">
                <div class="fp-icon" style="background:var(--green-light)">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="3" y="3" width="14" height="14" rx="3" stroke="#5da030" stroke-width="1.5" fill="none"/>
                    <path d="M7 10H13M10 7V13" stroke="#5da030" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div>
                  <div class="fp-title">Venue quality is part of the score</div>
                  <div class="fp-desc">A perfectly-timed bad venue ranks lower than a great one that's slightly further.</div>
                </div>
              </div>
              <div class="fairness-point">
                <div class="fp-icon" style="background:#eceafe">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="7" stroke="#534ab7" stroke-width="1.5" fill="none"/>
                    <path d="M10 7V11L13 13" stroke="#534ab7" stroke-width="1.5" stroke-linecap="round"/>
                  </svg>
                </div>
                <div>
                  <div class="fp-title">Recalculates as you move</div>
                  <div class="fp-desc">Traffic shifts. 2bottles recalculates live so the meeting point stays fair end-to-end.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TESTIMONIALS -->
      <section class="testimonials-section section" id="stories">
        <div class="section-inner">
          <p class="section-kicker reveal">Real stories</p>
          <h2 class="section-title reveal" style="transition-delay:.08s">People who stopped arguing</h2>
          <div class="tgrid">
            <div class="tcard reveal" style="transition-delay:.04s">
              <p class="tcard-quote">"My friend lives in Victoria Island, I'm in Surulere. Before 2bottles we always ended up at his place or somewhere on the mainland — which meant I drove 45 minutes and he drove 8."</p>
              <div class="tcard-author">
                <div class="tcard-avatar" style="background:#2f6fa6">TI</div>
                <div>
                  <div class="tcard-name">Tunde Ibitoye</div>
                  <div class="tcard-role">Lagos Island · frequent meetup planner</div>
                </div>
              </div>
            </div>
            <div class="tcard reveal" style="transition-delay:.12s">
              <p class="tcard-quote">"I use it for client meetings now. Share a link, they confirm their location, nobody can say the venue was inconvenient. It's quietly become my professional superpower."</p>
              <div class="tcard-author">
                <div class="tcard-avatar" style="background:#5da030">AF</div>
                <div>
                  <div class="tcard-name">Amaka Fernandez</div>
                  <div class="tcard-role">Consultant · Abuja</div>
                </div>
              </div>
            </div>
            <div class="tcard reveal" style="transition-delay:.2s">
              <p class="tcard-quote">"It found a café on the Third Mainland neither of us knew existed. Equidistant, 4.6 stars, and we were both there in under 20 minutes. That is genuinely witchcraft."</p>
              <div class="tcard-author">
                <div class="tcard-avatar" style="background:#7f3fbf">NK</div>
                <div>
                  <div class="tcard-name">Ngozi Kalu</div>
                  <div class="tcard-role">Port Harcourt → Lagos</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- STATS -->
      <section class="stats-section section">
        <div class="section-inner">
          <div class="reveal">
            <div class="stat-num" style="color:#7ab84a">4,200+</div>
            <div class="stat-label">active users</div>
          </div>
          <div class="reveal" style="transition-delay:.07s">
            <div class="stat-num" style="color:#4a8bc4">96%</div>
            <div class="stat-label">avg fairness score</div>
          </div>
          <div class="reveal" style="transition-delay:.14s">
            <div class="stat-num" style="color:#b0d882">18 min</div>
            <div class="stat-label">avg saved per meetup</div>
          </div>
          <div class="reveal" style="transition-delay:.21s">
            <div class="stat-num" style="color:#85b7eb">3 cities</div>
            <div class="stat-label">Lagos · Abuja · Port Harcourt</div>
          </div>
        </div>
      </section>

      <!-- CTA -->
      <section class="cta-section">
        <div class="cta-bg"></div>
        <div class="section-inner reveal">
          ${this._ctaPathSvg()}
          <h2 class="section-title">
            Your next meetup<br>
            should be <em style="font-style:normal;background:linear-gradient(120deg,var(--blue-dark),var(--green-mid));-webkit-background-clip:text;background-clip:text;color:transparent">fair.</em>
          </h2>
          <p class="cta-sub">
            Start a rendezvous in 30 seconds. No sign-up needed for the first session —
            just share the link with whoever you're meeting.
          </p>
          <div class="cta-actions">
            <button class="btn-primary" style="font-size:15px;padding:15px 26px" @click=${(event: Event) => this._emit('start', event)}>
              Start your first rendezvous
            </button>
            ${this.canInstall ? html`
              <button class="btn-ghost" style="font-size:15px;padding:15px 26px" @click=${(event: Event) => this._emit('install', event)}>
                Install the app
              </button>
            ` : ''}
          </div>
          <p class="cta-fine">No account needed &nbsp;·&nbsp; Works in Lagos, Abuja &amp; Port Harcourt &nbsp;·&nbsp; Free to start</p>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <div class="footer-logo">
          <div class="logo-mark">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="5" cy="7" r="3.5" fill="white" opacity=".92"/>
              <circle cx="9" cy="7" r="3.5" fill="white" opacity=".58"/>
            </svg>
          </div>
          2bottles
        </div>
        <span>© 2026 2bottles. Built for Nigerian cities.</span>
        <div class="footer-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'landing-page': LandingPage; }
}