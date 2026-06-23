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
import './hero-gallery.js';

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

        background:
          radial-gradient(1200px 620px at 6% -10%, rgba(74, 139, 196, 0.14) 0%, rgba(74, 139, 196, 0) 66%),
          radial-gradient(900px 520px at 96% 8%, rgba(122, 184, 74, 0.11) 0%, rgba(122, 184, 74, 0) 68%),
          linear-gradient(180deg, #fbfdff 0%, #f4f9ff 34%, #f7fbf8 100%);
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
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.88));
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
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .logo-mark img {
        display: block;
        width: 100%;
        height: 100%;
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
        grid-template-columns: 1.4fr 1fr;
        align-items: center;
        min-height: calc(100dvh - 61px);
        padding: 72px 48px 64px;
        gap: 48px;
        position: relative;
        overflow: hidden;
      }

      .hero::before,
      .hero::after {
        content: '';
        position: absolute;
        z-index: 0;
        pointer-events: none;
        border-radius: 999px;
        filter: blur(16px);
      }

      .hero::before {
        width: 540px;
        height: 540px;
        left: -170px;
        top: -170px;
        background:
          radial-gradient(circle at 42% 38%, rgba(74, 139, 196, 0.22) 0%, rgba(74, 139, 196, 0.08) 30%, rgba(74, 139, 196, 0) 72%);
        animation: drift-a 14s ease-in-out infinite;
      }

      .hero::after {
        width: 500px;
        height: 500px;
        right: -180px;
        bottom: -180px;
        background:
          radial-gradient(circle at 52% 50%, rgba(122, 184, 74, 0.2) 0%, rgba(122, 184, 74, 0.07) 30%, rgba(122, 184, 74, 0) 72%);
        animation: drift-b 16s ease-in-out infinite;
      }

      .hero-bg {
        position: absolute;
        inset: 0;
        z-index: 0;
        background:
          radial-gradient(680px 380px at 16% 72%, rgba(122, 184, 74, 0.14) 0%, rgba(122, 184, 74, 0.03) 40%, transparent 74%),
          radial-gradient(720px 420px at 88% 22%, rgba(47, 111, 166, 0.16) 0%, rgba(47, 111, 166, 0.04) 42%, transparent 76%),
          conic-gradient(from 220deg at 62% 60%, rgba(47, 111, 166, 0.08), rgba(122, 184, 74, 0.07), rgba(47, 111, 166, 0.08));
        opacity: 0.95;
      }

      .hero-grid {
        position: absolute;
        inset: 0;
        z-index: 0;
        background-image:
          linear-gradient(rgba(12, 26, 39, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(12, 26, 39, 0.045) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: radial-gradient(ellipse at 52% 42%, black 24%, #ffffff 82%);
        opacity: 0.65;
      }

      .hero-grid::after {
        content: '';
        position: absolute;
        inset: 0;
        background:
          repeating-linear-gradient(
            -35deg,
            rgba(255, 255, 255, 0.14) 0,
            rgba(255, 255, 255, 0.14) 2px,
            rgba(255, 255, 255, 0) 2px,
            rgba(255, 255, 255, 0) 22px
          );
        mix-blend-mode: soft-light;
        opacity: 0.45;
      }

      .hero-left {
        position: relative;
        z-index: 1;
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

      .hero-right {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: center;
        min-height: 500px;
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
        background: radial-gradient(900px 500px at 50% 100%, rgba(47, 111, 166, 0.07), #ffffff 70%);
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
        color: var(--ink-muted);
      }

      /* ── FOOTER ── */
      .footer {
        border-top: 1px solid var(--border);
        padding: 28px 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.72);
        background: var(--ink);
      }

      .footer-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        color: var(--white);
      }

      .footer-links {
        display: flex;
        gap: 22px;
      }

      .footer-links a {
        color: rgba(255, 255, 255, 0.72);
        text-decoration: none;
        transition: color 0.2s;
      }

      .footer-links a:hover { color: var(--white); }

      /* ── ANIMATIONS ── */
      @keyframes drift-a {
        0%, 100% {
          transform: translate3d(0, 0, 0) scale(1);
        }
        50% {
          transform: translate3d(24px, 20px, 0) scale(1.06);
        }
      }

      @keyframes drift-b {
        0%, 100% {
          transform: translate3d(0, 0, 0) scale(1);
        }
        50% {
          transform: translate3d(-24px, -22px, 0) scale(1.05);
        }
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
        .hero { grid-template-columns: 1fr; padding: 60px 22px 52px; min-height: auto; gap: 44px; }
        .hero-left { text-align: center; }
        .hero-sub { margin-left: auto; margin-right: auto; }
        .hero-actions { justify-content: center; }
        .hero-right { min-height: 0; }
        .section { padding: 64px 22px; }
        .problem-section .section-inner,
        .fairness-section .section-inner { grid-template-columns: 1fr; gap: 44px; }
        .steps-grid { grid-template-columns: 1fr; gap: 16px; }
        .stats-section .section-inner { grid-template-columns: repeat(2, 1fr); }
        .footer { flex-direction: column; gap: 14px; text-align: center; }
      }

      @media (max-width: 480px) {
        .nav { padding: 12px 16px; }
        .hero { padding: 44px 16px 36px; gap: 32px; }
        .hero-left { text-align: center; }
        .hero-right { min-height: 0; }
        .hero-title { font-size: 32px; letter-spacing: -1.5px; }
        .hero-sub { font-size: 14px; margin-left: auto; margin-right: auto; margin-bottom: 24px; }
        .hero-actions { justify-content: center; flex-direction: column; align-items: center; }
        .btn-primary, .btn-ghost { width: 100%; justify-content: center; }
        .section { padding: 48px 16px; }
        .cta-section { padding: 72px 16px; }
        .stats-section { padding: 48px 16px; }
        .footer { padding: 20px 16px; }
      }

      @media (prefers-reduced-motion: reduce) {
        .hero::before,
        .hero::after {
          animation: none;
        }
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

  private _problemSvg() {
    return html`
      <svg width="100%" viewBox="0 0 380 290" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- Without label -->
        <text x="190" y="22" text-anchor="middle" font-size="10.5" font-weight="600" fill="rgba(255,255,255,0.38)" font-family="DM Sans,system-ui,-apple-system,sans-serif">Without 2bottles</text>

        <!-- Road -->
        <line x1="64"  y1="90" x2="316" y2="90" stroke="rgba(255,255,255,0.09)" stroke-width="10" stroke-linecap="round"/>

        <!-- Person A -->
        <circle cx="46"  cy="90" r="19" fill="rgba(47,111,166,0.22)" stroke="#4a8bc4" stroke-width="1.5"/>
        <text   x="46"  y="95" text-anchor="middle" font-size="11"  font-weight="700" fill="#85b7eb" font-family="DM Sans,system-ui,-apple-system,sans-serif">A</text>

        <!-- Person B -->
        <circle cx="334" cy="90" r="19" fill="rgba(93,160,48,0.22)"  stroke="#7ab84a" stroke-width="1.5"/>
        <text   x="334" y="95" text-anchor="middle" font-size="11"  font-weight="700" fill="#c0dd97" font-family="DM Sans,system-ui,-apple-system,sans-serif">B</text>

        <!-- Unfair pin — skewed left -->
        <line x1="128" y1="68" x2="128" y2="112" stroke="rgba(232,89,60,0.75)" stroke-width="2"/>
        <circle cx="128" cy="64" r="10" fill="#E8593C"/>
        <text   x="128" y="68" text-anchor="middle" font-size="9"  font-weight="700" fill="white" font-family="DM Sans,system-ui,-apple-system,sans-serif">✕</text>

        <!-- Distance labels -->
        <text x="87"  y="82" text-anchor="middle" font-size="9" font-weight="600" fill="#E8593C"             font-family="DM Sans,system-ui,-apple-system,sans-serif">20 min</text>
        <text x="232" y="82" text-anchor="middle" font-size="9" font-weight="500" fill="rgba(255,255,255,0.38)" font-family="DM Sans,system-ui,-apple-system,sans-serif">48 min</text>
        <text x="128" y="130" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.4)"              font-family="DM Sans,system-ui,-apple-system,sans-serif">"the usual spot"</text>

        <!-- Divider -->
        <line x1="40" y1="155" x2="340" y2="155" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>

        <!-- With label -->
        <text x="190" y="177" text-anchor="middle" font-size="10.5" font-weight="600" fill="rgba(122,184,74,0.75)" font-family="DM Sans,system-ui,-apple-system,sans-serif">With 2bottles</text>

        <!-- Road 2 -->
        <line x1="64"  y1="232" x2="316" y2="232" stroke="rgba(255,255,255,0.09)" stroke-width="10" stroke-linecap="round"/>

        <!-- Person A2 -->
        <circle cx="46"  cy="232" r="19" fill="rgba(47,111,166,0.22)" stroke="#4a8bc4" stroke-width="1.5"/>
        <text   x="46"  y="237" text-anchor="middle" font-size="11"  font-weight="700" fill="#85b7eb" font-family="DM Sans,system-ui,-apple-system,sans-serif">A</text>

        <!-- Person B2 -->
        <circle cx="334" cy="232" r="19" fill="rgba(93,160,48,0.22)"  stroke="#7ab84a" stroke-width="1.5"/>
        <text   x="334" y="237" text-anchor="middle" font-size="11"  font-weight="700" fill="#c0dd97" font-family="DM Sans,system-ui,-apple-system,sans-serif">B</text>

        <!-- Route dashes -->
        <line x1="67"  y1="232" x2="179" y2="232" stroke="#4a8bc4" stroke-width="2" stroke-dasharray="5 3" opacity=".65"/>
        <line x1="313" y1="232" x2="201" y2="232" stroke="#7ab84a" stroke-width="2" stroke-dasharray="5 3" opacity=".65"/>

        <!-- Fair pin -->
        <line x1="190" y1="210" x2="190" y2="252" stroke="rgba(122,184,74,0.75)" stroke-width="2"/>
        <circle cx="190" cy="206" r="10" fill="#5da030"/>
        <text   x="190" y="210" text-anchor="middle" font-size="9"  font-weight="700" fill="white" font-family="DM Sans,system-ui,-apple-system,sans-serif">✓</text>

        <!-- Equal ETAs -->
        <text x="115" y="224" text-anchor="middle" font-size="9" font-weight="600" fill="#85b7eb" font-family="DM Sans,system-ui,-apple-system,sans-serif">22 min</text>
        <text x="262" y="224" text-anchor="middle" font-size="9" font-weight="600" fill="#c0dd97" font-family="DM Sans,system-ui,-apple-system,sans-serif">23 min</text>
        <text x="190" y="268" text-anchor="middle" font-size="9" fill="rgba(122,184,74,0.65)" font-family="DM Sans,system-ui,-apple-system,sans-serif">Balanced for both</text>
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
        <text x="74" y="78" text-anchor="middle" font-size="12" font-weight="700" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">Share</text>
        <text x="74" y="96" text-anchor="middle" font-size="10" fill="#2f6fa6"  font-family="DM Sans,system-ui,-apple-system,sans-serif">location pins</text>

        <line x1="130" y1="80" x2="158" y2="80" stroke="#2f6fa6" stroke-width="1.5" marker-end="url(#arr)" opacity=".45"/>

        <!-- Step 2 -->
        <rect x="160" y="52" width="108" height="56" rx="12" fill="#dfedfb" stroke="rgba(47,111,166,0.22)" stroke-width="1"/>
        <text x="214" y="78" text-anchor="middle" font-size="12" font-weight="700" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">Invite</text>
        <text x="214" y="96" text-anchor="middle" font-size="10" fill="#2f6fa6"  font-family="DM Sans,system-ui,-apple-system,sans-serif">partner joins</text>

        <line x1="270" y1="80" x2="298" y2="80" stroke="#2f6fa6" stroke-width="1.5" marker-end="url(#arr)" opacity=".45"/>

        <!-- Step 3 — highlighted -->
        <rect x="300" y="40" width="124" height="80" rx="14" fill="#2f6fa6"/>
        <text x="362" y="72" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff"              font-family="DM Sans,system-ui,-apple-system,sans-serif">Fairness</text>
        <text x="362" y="90" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.78)" font-family="DM Sans,system-ui,-apple-system,sans-serif">engine ranks</text>
        <text x="362" y="107" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.6)"  font-family="DM Sans,system-ui,-apple-system,sans-serif">venues</text>

        <line x1="426" y1="80" x2="454" y2="80" stroke="#5da030" stroke-width="1.5" marker-end="url(#arr)" opacity=".55"/>

        <!-- Step 4 -->
        <rect x="456" y="52" width="108" height="56" rx="12" fill="#e4f3d0" stroke="rgba(93,160,48,0.28)" stroke-width="1"/>
        <text x="510" y="78" text-anchor="middle" font-size="12" font-weight="700" fill="#294f10" font-family="DM Sans,system-ui,-apple-system,sans-serif">Confirm</text>
        <text x="510" y="96" text-anchor="middle" font-size="10" fill="#3d7318"  font-family="DM Sans,system-ui,-apple-system,sans-serif">venue locked</text>

        <line x1="566" y1="80" x2="594" y2="80" stroke="#5da030" stroke-width="1.5" marker-end="url(#arr)" opacity=".55"/>

        <!-- Step 5 -->
        <rect x="596" y="52" width="68" height="56" rx="12" fill="#e4f3d0" stroke="rgba(93,160,48,0.28)" stroke-width="1"/>
        <text x="630" y="82" text-anchor="middle" font-size="20" font-family="DM Sans,system-ui,-apple-system,sans-serif">🚗</text>
        <text x="630" y="98" text-anchor="middle" font-size="9.5" font-weight="600" fill="#294f10" font-family="DM Sans,system-ui,-apple-system,sans-serif">Go!</text>

        <!-- Step labels -->
        <text x="74"  y="130" text-anchor="middle" font-size="10" fill="#6b8699" font-family="DM Sans,system-ui,-apple-system,sans-serif">Step 1</text>
        <text x="214" y="130" text-anchor="middle" font-size="10" fill="#6b8699" font-family="DM Sans,system-ui,-apple-system,sans-serif">Step 2</text>
        <text x="362" y="136" text-anchor="middle" font-size="10" font-weight="600" fill="#2f6fa6" font-family="DM Sans,system-ui,-apple-system,sans-serif">Step 3 · the magic</text>
        <text x="510" y="130" text-anchor="middle" font-size="10" fill="#6b8699" font-family="DM Sans,system-ui,-apple-system,sans-serif">Step 4</text>
        <text x="630" y="130" text-anchor="middle" font-size="10" fill="#294f10" font-family="DM Sans,system-ui,-apple-system,sans-serif">Done</text>
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
        <text x="152" y="190" text-anchor="middle" font-size="8" font-weight="700" fill="white" font-family="DM Sans,system-ui,-apple-system,sans-serif">A</text>
        <text x="188" y="190" text-anchor="middle" font-size="8" font-weight="700" fill="white" font-family="DM Sans,system-ui,-apple-system,sans-serif">B</text>
        <text x="170" y="212" text-anchor="middle" font-size="9" font-weight="700" fill="white" font-family="DM Sans,system-ui,-apple-system,sans-serif">FAIR</text>

        <!-- Input: Traffic (top) -->
        <circle cx="170" cy="52" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="170" y="47"  text-anchor="middle" font-size="17" font-family="DM Sans,system-ui,-apple-system,sans-serif">🚦</text>
        <text x="170" y="66"  text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">Traffic</text>
        <line x1="170" y1="82" x2="170" y2="122" stroke="#2f6fa6" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Routes (left-top) -->
        <circle cx="50" cy="152" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="50"  y="147" text-anchor="middle" font-size="17" font-family="DM Sans,system-ui,-apple-system,sans-serif">🗺️</text>
        <text x="50"  y="166" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">Routes</text>
        <line x1="78" y1="168" x2="116" y2="182" stroke="#2f6fa6" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Timing (left-bottom) -->
        <circle cx="50" cy="248" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="50"  y="243" text-anchor="middle" font-size="17" font-family="DM Sans,system-ui,-apple-system,sans-serif">🕐</text>
        <text x="50"  y="262" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">Timing</text>
        <line x1="78" y1="238" x2="116" y2="216" stroke="#2f6fa6" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Venues (right-top) -->
        <circle cx="290" cy="152" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="290" y="147" text-anchor="middle" font-size="17" font-family="DM Sans,system-ui,-apple-system,sans-serif">⭐</text>
        <text x="290" y="166" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">Venues</text>
        <line x1="262" y1="168" x2="224" y2="182" stroke="#5da030" stroke-width="1.5" stroke-dasharray="4 3" opacity=".38"/>

        <!-- Input: Vibes (right-bottom) -->
        <circle cx="290" cy="248" r="28" fill="white" stroke="rgba(47,111,166,0.16)" stroke-width="1"/>
        <text x="290" y="243" text-anchor="middle" font-size="17" font-family="DM Sans,system-ui,-apple-system,sans-serif">💬</text>
        <text x="290" y="262" text-anchor="middle" font-size="9"  font-weight="600" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">Vibe</text>
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
        <text x="170" y="356" text-anchor="middle" font-size="10" font-weight="700" fill="#294f10" font-family="DM Sans,system-ui,-apple-system,sans-serif">Ranked fair venues</text>
        <text x="170" y="373" text-anchor="middle" font-size="9"  fill="#3d7318"  font-family="DM Sans,system-ui,-apple-system,sans-serif">sorted by balance score</text>
      </svg>
    `;
  }

  private _ctaPathSvg() {
    return html`
      <svg width="100%" viewBox="0 0 560 112" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:36px">
        <!-- You -->
        <circle cx="40"  cy="56" r="20" fill="#dfedfb" stroke="#2f6fa6" stroke-width="1.5"/>
        <text   x="40"  y="60" text-anchor="middle" font-size="10.5" font-weight="700" fill="#0e3d66" font-family="DM Sans,system-ui,-apple-system,sans-serif">You</text>

        <!-- Them -->
        <circle cx="520" cy="56" r="20" fill="#e4f3d0" stroke="#5da030" stroke-width="1.5"/>
        <text   x="520" y="60" text-anchor="middle" font-size="10.5" font-weight="700" fill="#294f10" font-family="DM Sans,system-ui,-apple-system,sans-serif">Them</text>

        <!-- Paths converging -->
        <path d="M62 56 Q160 28 262 56"  stroke="#2f6fa6" stroke-width="2" stroke-dasharray="6 4" fill="none" stroke-linecap="round" opacity=".6"/>
        <path d="M498 56 Q400 84 282 56" stroke="#5da030" stroke-width="2" stroke-dasharray="6 4" fill="none" stroke-linecap="round" opacity=".6"/>

        <!-- Meeting point -->
        <circle cx="272" cy="56" r="30" fill="rgba(47,111,166,0.07)" stroke="rgba(47,111,166,0.14)" stroke-width="1"/>
        <circle cx="272" cy="56" r="18" fill="#0c1a27"/>
        <text   x="272" y="52" text-anchor="middle" font-size="9.5" fill="white" font-family="DM Sans,system-ui,-apple-system,sans-serif">meet</text>
        <text   x="272" y="65" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,0.72)" font-family="DM Sans,system-ui,-apple-system,sans-serif">here</text>
      </svg>
    `;
  }

  override render() {
    return html`
      <!-- NAV -->
      <nav class="nav">
        <a class="nav-logo" href="#" @click=${(e: Event) => { e.preventDefault(); (this.renderRoot as ShadowRoot).querySelector('.hero')?.scrollIntoView({ behavior: 'smooth' }); }}>
          <div class="logo-mark">
            <img src="/favicon.svg" alt="" aria-hidden="true" />
          </div>
          2bottles
        </a>
        <button class="nav-cta" @click=${(event: Event) => this._emit('start', event)}>Start a rendezvous</button>
      </nav>

      <!-- HERO -->
      <section class="hero">
        <div class="hero-bg"></div>
        <div class="hero-grid"></div>
        <div class="hero-left">
          <h1 class="hero-title">
            Meet <em>halfway.</em><br>
            Actually halfway.
          </h1>
          <p class="hero-sub">
            Not the midpoint on a map. The midpoint in travel time. Two people start from anywhere.
            2bottles finds the place that's fair for both — factoring real traffic, not guesswork.
          </p>
          <div class="hero-actions">
            <button class="btn-primary" @click=${(event: Event) => this._emit('start', event)}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M5.5 4.5L10.5 7.5L5.5 10.5V4.5Z" fill="white"/>
              </svg>
              Start a Rendezvous
            </button>
          </div>
        </div>
        <div class="hero-right">
          <hero-gallery></hero-gallery>
        </div>
      </section>

      <!-- PROBLEM -->
      <section class="problem-section section" id="problem">
        <div class="section-inner">
          <div class="reveal">
            <p class="section-kicker">The problem</p>
            <h2 class="section-title">
              "Let's meet in the<br>
              <span class="problem-accent">middle."</span><br>
              Whose middle exactly?
            </h2>
            <p class="section-body">
              The "middle" your friend suggested is probably near their neighbourhood.
              Every meetup is a negotiation — and someone always travels more.
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
            Three steps. One fair place.
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
              <h3>Share your location</h3>
              <p>Drop your pin — your real address or anywhere you choose. Your partner shares theirs too. No account needed.</p>
            </div>
            <div class="step-card reveal" style="transition-delay:.11s">
              <div class="step-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="13" fill="#e4f3d0"/>
                  <line x1="24" y1="12" x2="24" y2="36" stroke="#5da030" stroke-width="2" stroke-linecap="round"/>
                  <line x1="14" y1="12" x2="34" y2="12" stroke="#5da030" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="14" cy="19" r="7" fill="rgba(93,160,48,0.2)" stroke="#5da030" stroke-width="1.5"/>
                  <circle cx="34" cy="19" r="7" fill="rgba(93,160,48,0.2)" stroke="#5da030" stroke-width="1.5"/>
                  <text x="14" y="23" text-anchor="middle" font-size="7" font-weight="700" fill="#294f10" font-family="DM Sans,system-ui,-apple-system,sans-serif">A</text>
                  <text x="34" y="23" text-anchor="middle" font-size="7" font-weight="700" fill="#294f10" font-family="DM Sans,system-ui,-apple-system,sans-serif">B</text>
                  <rect x="18" y="34" width="12" height="4" rx="2" fill="#5da030"/>
                </svg>
              </div>
              <div class="step-num">02</div>
              <h3>Engine finds the fairest spot</h3>
              <p>Traffic, route shape, time of day, venue quality — all weighed to surface places sorted by fairness, not proximity.</p>
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
              <h3>Pick, confirm, and move</h3>
              <p>Choose from ranked venues, confirm together, then track each other live as you head to the same fair place.</p>
            </div>
          </div>

          <div class="reveal" style="transition-delay:.18s">
            ${this._flowSvg()}
          </div>
        </div>
      </section>

      <!-- FAIRNESS AXIOMS -->
      <section class="fairness-section section" id="fairness">
        <div class="section-inner">
          <div class="reveal">
            ${this._engineSvg()}
          </div>
          <div class="reveal" style="transition-delay:.14s">
            <p class="section-kicker">The fairness axioms</p>
            <h2 class="section-title">Not the nearest.<br>The <em style="font-style:normal;color:var(--blue)">fairest.</em></h2>
            <p class="section-body">
              These are not marketing claims. They are architectural constraints.
              Every meetup scored by real travel time, not wishful thinking.
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
                  <div class="fp-title">I — Equal travel time, not distance</div>
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
                  <div class="fp-title">II — Venue quality is part of the score</div>
                  <div class="fp-desc">A perfectly-timed bad venue ranks lower than a great one slightly further away.</div>
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
                  <div class="fp-title">III — Recalculates as you move</div>
                  <div class="fp-desc">Traffic shifts. 2bottles recalculates live so the meeting point stays fair end-to-end.</div>
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
            Ready for a fair meetup?
          </h2>
          <p class="cta-sub">
            No sign-up. No account. Just share a link with whoever you're meeting
            and let the engine find the fairest place for both of you.
          </p>
          <div class="cta-actions">
            <button class="btn-primary" style="font-size:15px;padding:15px 26px" @click=${(event: Event) => this._emit('start', event)}>
              Start a Rendezvous
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
            <img src="/favicon.svg" alt="" aria-hidden="true" />
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