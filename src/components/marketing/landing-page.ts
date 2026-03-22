/**
 * <landing-page> — mandatory demo onboarding experience.
 *
 * Responsibilities:
 *   run a guided, interactive simulation of the 2bottles flow
 *   teach key actions with step prompts and quiz checkpoints
 *   hand off users into real app mode once demo is completed
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { sharedStyles } from '../../styles/shared-styles.js';

type LandingCta = 'start' | 'install' | 'skip';
type DemoStep = 'location' | 'quiz-location' | 'identity' | 'invite' | 'venue' | 'quiz-fairness' | 'tracking' | 'complete';
type QuizOption = { id: string; label: string; correct: boolean };
type DemoMode = 'guided' | 'fast';
type DemoAnalyticsEvent = {
  name: string;
  step: DemoStep;
  stepIndex: number;
  at: number;
  meta?: Record<string, unknown>;
};

const DEMO_STEPS: DemoStep[] = [
  'location',
  'quiz-location',
  'identity',
  'invite',
  'venue',
  'quiz-fairness',
  'tracking',
  'complete',
];

const FLOW_STEPS: DemoStep[] = [
  'location',
  'quiz-location',
  'identity',
  'invite',
  'venue',
  'quiz-fairness',
  'tracking',
];

const STEP_XP: Record<DemoStep, number> = {
  location: 12,
  'quiz-location': 18,
  identity: 14,
  invite: 14,
  venue: 16,
  'quiz-fairness': 20,
  tracking: 24,
  complete: 30,
};

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
        font-family: 'Space Grotesk', 'Sora', var(--font-sans);
        color: var(--color-text-primary);
        --onboard-ink: #142231;
        --onboard-muted: #425569;
        --onboard-accent: #2f6fa6;
        --onboard-lime: #7ab84a;
        --onboard-glass: rgba(255, 255, 255, 0.76);
        --modal-bg-a: rgba(250, 253, 255, 0.97);
        --modal-bg-b: rgba(228, 241, 251, 0.95);
        --modal-border: rgba(255, 255, 255, 0.34);
        --modal-shadow: rgba(6, 20, 34, 0.42);
      }

      .surface {
        position: relative;
        isolation: isolate;
        min-height: 100dvh;
        overflow: visible;
        padding: clamp(18px, 3vw, 28px);
        display: block;
        background:
          radial-gradient(1280px 760px at -15% -12%, rgba(77, 114, 152, 0.26) 0%, transparent 62%),
          radial-gradient(980px 620px at 108% -8%, rgba(122, 184, 74, 0.22) 0%, transparent 60%),
          radial-gradient(700px 420px at 48% 115%, rgba(255, 255, 255, 0.76) 0%, transparent 74%),
          conic-gradient(from 220deg at 78% 18%, rgba(77, 114, 152, 0.1), rgba(122, 184, 74, 0.08), rgba(77, 114, 152, 0.08)),
          var(--landing-surface-bg);
      }

      .webgl-bg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
        opacity: 0.82;
        mix-blend-mode: multiply;
      }

      .surface::before,
      .surface::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .surface::before {
        z-index: 1;
        opacity: 0.46;
        background-image:
          linear-gradient(rgba(46, 74, 99, 0.16) 1px, transparent 1px),
          linear-gradient(90deg, rgba(46, 74, 99, 0.16) 1px, transparent 1px);
        background-size: 42px 42px;
        mask-image: radial-gradient(circle at 52% 38%, black 24%, transparent 86%);
        animation: grid-drift 20s linear infinite;
      }

      .surface::after {
        z-index: 1;
        background:
          radial-gradient(660px 340px at 16% 20%, rgba(77, 114, 152, 0.32) 0%, transparent 74%),
          radial-gradient(560px 300px at 84% 16%, rgba(122, 184, 74, 0.23) 0%, transparent 72%);
        filter: blur(4px);
        animation: orb-float 12s ease-in-out infinite alternate;
      }

      .stage {
        position: relative;
        z-index: 2;
        width: 100%;
        max-width: none;
        border-radius: 0;
        border: none;
        background: transparent;
        box-shadow: none;
        overflow: visible;
      }

      .hero {
        padding: clamp(18px, 3.2vw, 32px);
        display: grid;
        grid-template-columns: 1.15fr 1fr;
        gap: clamp(16px, 2.4vw, 26px);
        border: 1px solid rgba(20, 34, 49, 0.16);
        border-radius: 28px;
        background:
          linear-gradient(148deg, rgba(255, 255, 255, 0.82) 0%, rgba(242, 246, 250, 0.92) 100%),
          linear-gradient(110deg, rgba(47, 111, 166, 0.15), rgba(122, 184, 74, 0.11));
        backdrop-filter: blur(10px);
        position: relative;
        overflow: hidden;
        box-shadow:
          0 18px 46px rgba(14, 27, 41, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.5);
      }

      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: inherit;
        border: 1px solid rgba(47, 111, 166, 0.3);
        mask-image: linear-gradient(160deg, black 40%, transparent 75%);
      }

      .hero::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.50) 42%, transparent 58%);
        transform: translateX(-120%);
        animation: hero-sheen 7.8s var(--ease-in-out) infinite;
      }

      .intro-copy {
        display: grid;
        gap: var(--space-4);
      }

      .signal-strip {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .signal-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 1px solid rgba(20, 34, 49, 0.18);
        border-radius: var(--border-radius-pill);
        padding: 6px 10px;
        font-size: var(--text-xs);
        color: var(--onboard-muted);
        background: linear-gradient(118deg, rgba(255, 255, 255, 0.9), rgba(237, 245, 252, 0.88));
      }

      .signal-dot {
        width: 7px;
        height: 7px;
        border-radius: var(--border-radius-pill);
        background: var(--color-blue);
        animation: signal-pulse 1.6s var(--ease-in-out) infinite;
      }

      .eyebrow {
        font-size: var(--text-xs);
        letter-spacing: 1px;
        font-weight: var(--weight-bold);
        color: var(--onboard-accent);
        text-transform: uppercase;
      }

      .invite-link {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        border-bottom: 1px dashed var(--color-border-strong);
        padding-bottom: 2px;
      }

      .score-line {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .title {
        font-family: 'Space Grotesk', 'Sora', var(--font-sans);
        font-size: clamp(30px, 5vw, 54px);
        line-height: 0.95;
        letter-spacing: -1.6px;
        max-width: 16ch;
        background: linear-gradient(125deg, #0f1e2f 0%, #1f5686 54%, #4f8f29 120%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .subtitle {
        font-size: clamp(16px, 1.5vw, 18px);
        color: var(--onboard-muted);
        line-height: 1.55;
        max-width: 50ch;
      }

      .preview {
        position: relative;
        border-radius: 22px;
        border: 1px solid rgba(214, 230, 242, 0.55);
        background:
          linear-gradient(145deg, rgba(14, 27, 41, 0.95) 0%, rgba(24, 44, 62, 0.92) 100%),
          repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0px, rgba(255, 255, 255, 0.05) 1px, transparent 1px, transparent 16px);
        color: var(--color-text-inverted);
        padding: var(--space-4);
        display: grid;
        align-content: center;
        gap: var(--space-2);
        overflow: hidden;
        box-shadow: 0 24px 48px rgba(11, 22, 34, 0.34);
      }

      .preview::before {
        content: '';
        position: absolute;
        width: 210px;
        height: 210px;
        right: -70px;
        top: -90px;
        border-radius: 50%;
        border: 1px solid rgba(244, 249, 253, 0.35);
        background: radial-gradient(circle at center, rgba(77, 114, 152, 0.36) 0%, rgba(77, 114, 152, 0.0) 72%);
        animation: preview-ring 10s linear infinite;
      }

      .preview::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(120deg, transparent 34%, rgba(244, 249, 253, 0.11) 46%, transparent 56%);
        transform: translateX(-130%);
        animation: preview-sweep 8.6s var(--ease-in-out) infinite;
      }

      .preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }

      .preview-live {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        border: 1px solid rgba(244, 249, 253, 0.28);
        border-radius: var(--border-radius-pill);
        padding: 4px 8px;
        font-size: var(--text-xs);
        color: var(--landing-hero-text-secondary);
      }

      .preview-live::before {
        content: '';
        width: 7px;
        height: 7px;
        border-radius: var(--border-radius-pill);
        background: var(--accent-amber-500);
        animation: signal-pulse 1.4s var(--ease-in-out) infinite;
      }

      .preview-metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-2);
      }

      .metric {
        border: 1px solid rgba(244, 249, 253, 0.20);
        border-radius: 14px;
        padding: 8px;
        display: grid;
        gap: 2px;
        background: linear-gradient(130deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.01));
      }

      .metric-value {
        font-size: var(--text-sm);
        font-weight: var(--weight-bold);
        color: var(--landing-hero-text);
      }

      .metric-label {
        font-size: var(--text-xs);
        color: var(--landing-hero-text-secondary);
      }

      .preview strong {
        font-size: clamp(20px, 3vw, 30px);
      }

      .preview p {
        margin: 0;
        color: var(--color-text-on-dark);
        font-size: var(--text-sm);
      }

      .progress {
        display: flex;
        gap: 6px;
        margin-top: var(--space-1);
      }

      .progress span {
        width: 100%;
        height: 6px;
        border-radius: 999px;
        background: var(--color-border-dark);
        transition: background-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
      }

      .progress span.active {
        background: var(--color-action);
        transform: scaleY(1.1);
      }

      .coach {
        position: sticky;
        top: 10px;
        z-index: 2;
        margin-top: var(--space-2);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: 10px clamp(16px, 2.2vw, 24px);
        border: 1px solid rgba(20, 34, 49, 0.18);
        border-radius: 18px;
        background: linear-gradient(122deg, rgba(255, 255, 255, 0.9), rgba(235, 244, 252, 0.86));
        backdrop-filter: blur(6px);
        box-shadow: 0 8px 24px rgba(16, 34, 51, 0.12);
      }

      .coach strong { font-size: var(--text-sm); }
      .coach span { font-size: var(--text-sm); color: var(--color-text-secondary); }

      .hud {
        display: grid;
        gap: var(--space-2);
        border: 1px solid rgba(20, 34, 49, 0.18);
        border-radius: 16px;
        padding: 12px;
        background: linear-gradient(132deg, rgba(255, 255, 255, 0.92), rgba(234, 243, 252, 0.88));
      }

      .hud-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .hud-top strong {
        color: var(--color-blue-dark);
      }

      .xp-track {
        height: 8px;
        border-radius: var(--border-radius-pill);
        border: 1px solid var(--color-border);
        overflow: hidden;
        background: var(--color-surface-soft);
      }

      .xp-fill {
        height: 100%;
        width: var(--xp, 0%);
        background: linear-gradient(90deg, var(--color-blue-mid), var(--color-green-mid));
        transition: width var(--duration-base) var(--ease-out);
      }

      .combo-pill {
        width: max-content;
        border-radius: var(--border-radius-pill);
        border: 1px solid var(--color-border-strong);
        background: var(--color-blue-light);
        color: var(--color-blue-dark);
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        padding: 4px 10px;
      }

      .reward-toast {
        position: fixed;
        bottom: var(--space-5);
        left: 50%;
        transform: translateX(-50%);
        z-index: 20;
        border: 1px solid var(--color-border-strong);
        border-radius: var(--border-radius-pill);
        background: linear-gradient(120deg, rgba(208, 239, 177, 0.95), rgba(219, 232, 244, 0.95));
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--weight-bold);
        padding: 9px 14px;
        animation: reward-pop 420ms var(--ease-spring) both;
      }

      .coach.step-enter {
        animation: coach-in 180ms var(--ease-out) both;
      }

      .demo {
        padding: var(--space-3) 0 0;
        display: grid;
        gap: var(--space-4);
      }

      .flow-rail {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: var(--space-2);
        width: 100%;
      }

      .flow-node {
        border: 1px solid rgba(20, 34, 49, 0.16);
        border-radius: 12px;
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.82);
        font-size: var(--text-xs);
        color: var(--onboard-muted);
        transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
      }

      .flow-node.active {
        border-color: var(--onboard-accent);
        color: var(--onboard-accent);
        background: rgba(223, 238, 251, 0.92);
      }

      .flow-node.done {
        border-color: var(--color-success-strong);
        color: var(--color-success-text);
        background: rgba(208, 239, 177, 0.68);
      }

      .panel {
        border: 1px solid rgba(20, 34, 49, 0.16);
        border-radius: 24px;
        background: linear-gradient(148deg, rgba(255, 255, 255, 0.94), rgba(236, 244, 250, 0.9));
        padding: clamp(18px, 2.8vw, 24px);
        display: grid;
        gap: var(--space-4);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(8px);
        clip-path: polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%);
        box-shadow: 0 14px 34px rgba(18, 37, 53, 0.11);
      }

      .panel::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background:
          radial-gradient(420px 120px at 8% -18%, rgba(77, 114, 152, 0.20) 0%, transparent 66%),
          radial-gradient(360px 140px at 92% -20%, rgba(122, 184, 74, 0.18) 0%, transparent 70%);
        opacity: 0.9;
      }

      .panel.step-enter {
        animation: panel-in 240ms var(--ease-out) both;
      }

      .panel > * {
        position: relative;
        z-index: 1;
      }

      .row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .loc-card {
        position: relative;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-surface-muted);
        padding: var(--space-3);
      }

      .loc-top {
        display: flex;
        gap: var(--space-3);
        align-items: center;
      }

      .loc-icon {
        width: 34px;
        height: 34px;
        border-radius: var(--border-radius-sm);
        background: var(--color-blue-light);
        display: grid;
        place-items: center;
      }

      .loc-name {
        font-size: var(--text-md);
        font-weight: var(--weight-medium);
      }

      .loc-meta {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .edit-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        border: 1px solid var(--color-border-strong);
        background: var(--color-surface);
        color: var(--color-blue-dark);
        border-radius: var(--border-radius-pill);
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        font-family: inherit;
        padding: 6px 10px;
        cursor: pointer;
      }

      .edit-btn:disabled,
      .action:disabled { opacity: 0.55; cursor: not-allowed; }

      .options {
        margin-top: var(--space-3);
        display: grid;
        gap: var(--space-2);
      }

      .option {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        padding: 10px 12px;
        font-size: var(--text-sm);
        font-family: inherit;
        background: var(--color-surface);
        cursor: pointer;
        text-align: left;
        transition: border-color var(--duration-fast), background var(--duration-fast);
      }

      .option:hover {
        border-color: var(--color-blue);
        background: var(--color-blue-light);
      }

      .field {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        padding: 12px;
        font-size: var(--text-md);
        font-family: var(--font-sans);
        background: var(--color-surface);
      }

      .field:focus {
        outline: none;
        border-color: var(--color-blue);
      }

      .action {
        border: none;
        border-radius: 14px;
        background: linear-gradient(125deg, #154772, #2d75af);
        color: var(--color-blue-text);
        font-size: 15px;
        font-weight: var(--weight-bold);
        font-family: inherit;
        letter-spacing: 0.2px;
        padding: 13px 18px;
        cursor: pointer;
        transition: transform var(--duration-fast) var(--ease-spring), filter var(--duration-fast) var(--ease-out);
      }

      .action:hover {
        transform: translateY(-1px);
        filter: saturate(1.1);
      }

      .action.ghost {
        background: rgba(255, 255, 255, 0.86);
        color: var(--onboard-ink);
        border: 1px solid rgba(20, 34, 49, 0.16);
      }

      .action.ghost.selected {
        border-color: var(--color-blue);
        background: var(--color-blue-light);
      }

      .venue {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        background: var(--color-surface);
        padding: var(--space-3);
        font-family: inherit;
        cursor: pointer;
        display: grid;
        gap: 3px;
        transition: border-color var(--duration-fast), background var(--duration-fast);
      }

      .step-title {
        font-size: var(--text-xl);
        font-weight: var(--weight-bold);
        letter-spacing: -0.2px;
      }

      .step-copy {
        font-size: var(--text-md);
        color: var(--color-text-secondary);
        max-width: 64ch;
      }

      .venue.active {
        border-color: var(--color-blue);
        background: var(--color-blue-light);
      }

      .venue strong { font-size: var(--text-sm); }
      .venue span { font-size: var(--text-xs); color: var(--color-text-muted); }

      .tracker {
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        overflow: hidden;
        height: 12px;
        background: var(--color-surface-soft);
      }

      .tracker-fill {
        height: 100%;
        width: var(--progress, 0%);
        background: var(--color-action);
        transition: width 320ms var(--ease-out);
      }

      .quiz-overlay {
        position: fixed;
        inset: 0;
        background:
          radial-gradient(800px 400px at 50% 110%, rgba(122, 184, 74, 0.14), transparent 70%),
          linear-gradient(180deg, rgba(9, 20, 33, 0.52), rgba(9, 20, 33, 0.82));
        display: grid;
        place-items: center;
        z-index: 15;
        padding: clamp(var(--space-3), 3vw, var(--space-6));
        overflow-x: hidden;
      }

      .quiz {
        box-sizing: border-box;
        width: min(520px, calc(100vw - 2 * clamp(var(--space-4), 5vw, var(--space-6))));
        max-width: 100%;
        max-height: min(760px, calc(100dvh - 2 * var(--space-3)));
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        border-radius: 22px;
        border: 1px solid var(--modal-border);
        background:
          linear-gradient(145deg, var(--modal-bg-a), var(--modal-bg-b)),
          radial-gradient(520px 200px at 10% -20%, rgba(47, 111, 166, 0.2) 0%, transparent 70%);
        padding: clamp(var(--space-4), 2vw, var(--space-5));
        display: grid;
        gap: var(--space-3);
        backdrop-filter: blur(10px);
        position: relative;
        box-shadow: 0 26px 56px var(--modal-shadow);
        scrollbar-width: thin;
      }

      .quiz::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: linear-gradient(100deg, transparent 26%, rgba(255, 255, 255, 0.36) 44%, transparent 62%);
        transform: translateX(-120%);
        animation: quiz-sheen 8.5s var(--ease-in-out) infinite;
      }

      .quiz > * {
        position: relative;
        z-index: 1;
      }

      .quiz-kicker {
        width: max-content;
        border: 1px solid rgba(20, 34, 49, 0.2);
        border-radius: var(--border-radius-pill);
        padding: 5px 10px;
        font-size: var(--text-xs);
        color: #1b5684;
        background: linear-gradient(120deg, rgba(219, 232, 244, 0.86), rgba(208, 239, 177, 0.62));
      }

      .quiz h3 {
        margin: 0;
        font-size: clamp(22px, 2.4vw, 28px);
        letter-spacing: -0.4px;
        color: var(--onboard-ink);
      }

      .quiz p {
        margin: 0;
        color: var(--onboard-muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .quiz .row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .quiz .row .action {
        flex: 1;
        min-width: 180px;
      }

      .mode-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-2);
      }

      .mode-btn {
        border: 1px solid rgba(20, 34, 49, 0.18);
        border-radius: 14px;
        padding: 12px;
        background: linear-gradient(130deg, rgba(255, 255, 255, 0.88), rgba(236, 245, 252, 0.82));
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        display: grid;
        gap: 4px;
        transition: transform var(--duration-fast) var(--ease-spring), border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
      }

      .mode-btn strong {
        font-size: var(--text-sm);
        color: var(--onboard-ink);
      }

      .mode-btn span {
        font-size: var(--text-xs);
        color: var(--onboard-muted);
      }

      .mode-btn:hover {
        transform: translateY(-1px);
        border-color: var(--onboard-accent);
        background: linear-gradient(130deg, rgba(220, 236, 250, 0.9), rgba(233, 247, 225, 0.86));
      }

      .mode-btn:focus-visible {
        outline: 2px solid rgba(47, 111, 166, 0.6);
        outline-offset: 2px;
      }

      .quickstart-hint {
        margin-top: var(--space-1);
        font-size: var(--text-xs);
        color: #536676;
      }

      .quiz-result {
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
      }

      .quiz-result.good { color: var(--color-green-dark); }
      .quiz-result.bad { color: var(--color-danger-text); }

      @keyframes panel-in {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      @keyframes hero-sheen {
        0% { transform: translateX(-120%); }
        25% { transform: translateX(120%); }
        100% { transform: translateX(120%); }
      }

      @keyframes preview-ring {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes preview-sweep {
        0% { transform: translateX(-130%); }
        24% { transform: translateX(130%); }
        100% { transform: translateX(130%); }
      }

      @keyframes signal-pulse {
        0%, 100% { transform: scale(0.9); opacity: 0.7; }
        50% { transform: scale(1.25); opacity: 1; }
      }

      @keyframes coach-in {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes quiz-sheen {
        0% { transform: translateX(-120%); }
        20% { transform: translateX(120%); }
        100% { transform: translateX(120%); }
      }

      @keyframes reward-pop {
        from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.95); }
        to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
      }

      @keyframes grid-drift {
        from { background-position: 0 0, 0 0; }
        to { background-position: 34px 20px, 20px 34px; }
      }

      @keyframes orb-float {
        from { transform: translate3d(0, 0, 0); }
        to { transform: translate3d(0, -14px, 0); }
      }

      @media (max-width: 900px) {
        .hero { grid-template-columns: 1fr; }
        .subtitle { font-size: var(--text-md); }
        .flow-rail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .preview-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .quiz-overlay { padding: var(--space-5); }
        .quiz { border-radius: var(--border-radius-lg); }
        .mode-grid { grid-template-columns: 1fr; }
        .coach {
          top: 8px;
          border-radius: var(--border-radius-lg);
          align-items: flex-start;
          flex-direction: column;
        }
      }

      @media (max-width: 640px) {
        .quiz-overlay {
          align-items: end;
          padding: var(--space-2);
        }

        .quiz {
          width: 100%;
          max-width: 100%;
          max-height: min(88dvh, 760px);
          border-radius: 18px;
          padding: var(--space-4);
          gap: var(--space-2);
        }

        .quiz::before {
          animation-duration: 10s;
        }

        .quiz h3 {
          font-size: 22px;
        }

        .quiz .row {
          display: grid;
          grid-template-columns: 1fr;
        }

        .quiz .row .action {
          min-width: 0;
          width: 100%;
        }

        .quickstart-hint {
          font-size: 11px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .webgl-bg {
          display: none;
        }
      }
    `,
  ];

  @property({ type: Boolean }) canInstall = false;

  @state() private _introOpen = true;
  @state() private _mode: DemoMode = 'guided';
  @state() private _stepIndex = 0;
  @state() private _demoName = '';
  @state() private _manualEditorOpen = false;
  @state() private _selectedLocation = 'Current GPS location';
  @state() private _inviteSent = false;
  @state() private _selectedVenue = '';
  @state() private _trackingStarted = false;
  @state() private _trackingProgress = 0;
  @state() private _quizAnswer = '';
  @state() private _quizFeedback = '';
  @state() private _quizCorrectCount = 0;
  @state() private _xp = 0;
  @state() private _level = 1;
  @state() private _combo = 0;
  @state() private _reward = '';

  private _trackingTimer: ReturnType<typeof setInterval> | null = null;
  private _backgroundCanvas: HTMLCanvasElement | null = null;
  private _backgroundGl: WebGLRenderingContext | null = null;
  private _backgroundProgram: WebGLProgram | null = null;
  private _backgroundTimeUniform: WebGLUniformLocation | null = null;
  private _backgroundResolutionUniform: WebGLUniformLocation | null = null;
  private _backgroundFocusUniform: WebGLUniformLocation | null = null;
  private _backgroundStepUniform: WebGLUniformLocation | null = null;
  private _backgroundFrame = 0;
  private _backgroundStart = 0;
  private _backgroundResizeObserver: ResizeObserver | null = null;
  private _surfaceEl: HTMLElement | null = null;
  private _pointerX = 0.5;
  private _pointerY = 0.5;
  private _demoStarted = false;
  private _demoCompleted = false;

  override firstUpdated() {
    this._surfaceEl = this.renderRoot.querySelector<HTMLElement>('.surface');
    this._surfaceEl?.addEventListener('pointermove', this._onPointerMove);
    this._surfaceEl?.addEventListener('pointerleave', this._onPointerLeave);
    this._initBackgroundWebGl();
  }

  override disconnectedCallback() {
    this._surfaceEl?.removeEventListener('pointermove', this._onPointerMove);
    this._surfaceEl?.removeEventListener('pointerleave', this._onPointerLeave);
    this._surfaceEl = null;
    this._destroyBackgroundWebGl();
    super.disconnectedCallback();
    if (this._trackingTimer) clearInterval(this._trackingTimer);
    if (this._demoStarted && !this._demoCompleted) {
      this._track('demo_abandoned', { reason: 'component_disconnected' });
    }
  }

  private _initBackgroundWebGl() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = this.renderRoot.querySelector<HTMLCanvasElement>('.webgl-bg');
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });

    if (!gl) return;

    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;

      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;

      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_focus;
      uniform float u_step;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);

        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));

        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) +
               (c - a) * u.y * (1.0 - u.x) +
               (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p *= 2.02;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = v_uv;
        vec2 centered = (uv - 0.5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
        vec2 focus = (u_focus - 0.5) * vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);

        float t = u_time * 0.00022;
        float field = fbm(centered * 2.6 + vec2(t * 1.6, -t * 0.9));
        float field2 = fbm(centered * 3.4 - vec2(t * 1.1, t * 1.35));
        float field3 = fbm((centered + focus * 0.85) * 4.5 + vec2(-t * 2.3, t * 1.8));

        vec3 deepBlue = vec3(0.18, 0.29, 0.39);
        vec3 actionBlue = vec3(0.30, 0.45, 0.59);
        vec3 softGreen = vec3(0.48, 0.72, 0.29);
        vec3 bright = vec3(0.84, 0.93, 0.98);

        float beam = smoothstep(0.43, 0.9, field + field2 * 0.45);
        float pulse = 0.5 + 0.5 * sin((field * 6.2 + field2 * 3.1) + u_time * 0.0012);
        float stepPulse = 0.5 + 0.5 * sin(u_time * 0.001 + u_step * 0.72);
        float focusHalo = smoothstep(0.5, 0.0, distance(centered, focus));

        vec3 color = mix(deepBlue, actionBlue, beam);
        color = mix(color, softGreen, pulse * 0.17);
        color = mix(color, bright, field3 * 0.24 * stepPulse);
        color += bright * focusHalo * 0.16;

        float vignette = smoothstep(1.05, 0.08, length(centered));
        float alpha = clamp(vignette * (0.42 + stepPulse * 0.14), 0.0, 0.62);

        gl_FragColor = vec4(color, alpha);
      }
    `;

    const vertexShader = this._createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this._createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = this._createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    const positionAttribute = gl.getAttribLocation(program, 'a_position');
    const resolutionUniform = gl.getUniformLocation(program, 'u_resolution');
    const timeUniform = gl.getUniformLocation(program, 'u_time');
    const focusUniform = gl.getUniformLocation(program, 'u_focus');
    const stepUniform = gl.getUniformLocation(program, 'u_step');

    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    if (!buffer) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this._backgroundCanvas = canvas;
    this._backgroundGl = gl;
    this._backgroundProgram = program;
    this._backgroundTimeUniform = timeUniform;
    this._backgroundResolutionUniform = resolutionUniform;
    this._backgroundFocusUniform = focusUniform;
    this._backgroundStepUniform = stepUniform;
    this._backgroundStart = performance.now();

    const resize = () => {
      if (!this._backgroundCanvas || !this._backgroundGl) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = this._backgroundCanvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (this._backgroundCanvas.width !== width || this._backgroundCanvas.height !== height) {
        this._backgroundCanvas.width = width;
        this._backgroundCanvas.height = height;
      }

      this._backgroundGl.viewport(0, 0, width, height);
    };

    resize();

    this._backgroundResizeObserver = new ResizeObserver(() => resize());
    this._backgroundResizeObserver.observe(canvas);

    const renderFrame = (now: number) => {
      if (!this._backgroundGl || !this._backgroundProgram) return;

      const activeGl = this._backgroundGl;
      activeGl.useProgram(this._backgroundProgram);
      activeGl.disable(activeGl.DEPTH_TEST);
      activeGl.enable(activeGl.BLEND);
      activeGl.blendFunc(activeGl.SRC_ALPHA, activeGl.ONE_MINUS_SRC_ALPHA);

      activeGl.bindBuffer(activeGl.ARRAY_BUFFER, buffer);
      activeGl.enableVertexAttribArray(positionAttribute);
      activeGl.vertexAttribPointer(positionAttribute, 2, activeGl.FLOAT, false, 0, 0);

      if (this._backgroundResolutionUniform) {
        activeGl.uniform2f(this._backgroundResolutionUniform, activeGl.canvas.width, activeGl.canvas.height);
      }

      if (this._backgroundTimeUniform) {
        activeGl.uniform1f(this._backgroundTimeUniform, now - this._backgroundStart);
      }

      if (this._backgroundFocusUniform) {
        activeGl.uniform2f(this._backgroundFocusUniform, this._pointerX, this._pointerY);
      }

      if (this._backgroundStepUniform) {
        activeGl.uniform1f(this._backgroundStepUniform, this._stepIndex);
      }

      activeGl.drawArrays(activeGl.TRIANGLE_STRIP, 0, 4);
      this._backgroundFrame = window.requestAnimationFrame(renderFrame);
    };

    this._backgroundFrame = window.requestAnimationFrame(renderFrame);
  }

  private _destroyBackgroundWebGl() {
    if (this._backgroundFrame) {
      window.cancelAnimationFrame(this._backgroundFrame);
      this._backgroundFrame = 0;
    }

    if (this._backgroundResizeObserver) {
      this._backgroundResizeObserver.disconnect();
      this._backgroundResizeObserver = null;
    }

    if (this._backgroundGl) {
      const loseContext = this._backgroundGl.getExtension('WEBGL_lose_context');
      loseContext?.loseContext();
    }

    this._backgroundCanvas = null;
    this._backgroundProgram = null;
    this._backgroundGl = null;
    this._backgroundTimeUniform = null;
    this._backgroundResolutionUniform = null;
    this._backgroundFocusUniform = null;
    this._backgroundStepUniform = null;
  }

  private _onPointerMove = (event: PointerEvent) => {
    const target = this._surfaceEl;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this._pointerX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this._pointerY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  };

  private _onPointerLeave = () => {
    this._pointerX = 0.5;
    this._pointerY = 0.5;
  };

  private _createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (!ok) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private _createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const ok = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!ok) {
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  private _track(name: string, meta?: Record<string, unknown>) {
    const event: DemoAnalyticsEvent = {
      name,
      step: this._step,
      stepIndex: this._stepIndex,
      at: Date.now(),
      meta,
    };

    const scope = window as unknown as {
      __twoBottlesDemoAnalytics?: DemoAnalyticsEvent[];
    };
    scope.__twoBottlesDemoAnalytics = scope.__twoBottlesDemoAnalytics || [];
    scope.__twoBottlesDemoAnalytics.push(event);

    window.dispatchEvent(new CustomEvent('demo-analytics', { detail: event }));
  }

  private _xpForNextLevel(): number {
    return 80 + (this._level - 1) * 40;
  }

  private _awardXp(source: string, amount: number) {
    let nextXp = this._xp + amount;
    let nextLevel = this._level;
    let threshold = this._xpForNextLevel();

    while (nextXp >= threshold) {
      nextXp -= threshold;
      nextLevel += 1;
      threshold = 80 + (nextLevel - 1) * 40;
      this._reward = `Level up! You reached L${nextLevel}.`;
    }

    if (nextLevel === this._level) {
      this._reward = `+${amount} XP · ${source}`;
    }

    this._xp = nextXp;
    this._level = nextLevel;
    this.requestUpdate();

    window.setTimeout(() => {
      if (this._reward.includes(source) || this._reward.includes('Level up!')) {
        this._reward = '';
      }
    }, 1100);
  }

  private _emit(action: LandingCta) {
    this.dispatchEvent(new CustomEvent('landing-action', {
      detail: { action },
      bubbles: true,
      composed: true,
    }));
  }

  private get _step(): DemoStep {
    return DEMO_STEPS[this._stepIndex];
  }

  private get _stepMessage(): string {
    switch (this._step) {
      case 'location': return 'Step 1: Edit your live location once to experience manual override.';
      case 'quiz-location': return 'Quick check: confirm what manual override does before moving on.';
      case 'identity': return 'Step 2: Add your name and create your demo session.';
      case 'invite': return 'Step 3: Send a demo invite so the partner flow activates.';
      case 'venue': return 'Step 4: Choose the fairest venue based on both routes.';
      case 'quiz-fairness': return 'Quick check: fairness is the product core, lock this in.';
      case 'tracking': return 'Step 5: Start tracking to watch live rendezvous progress.';
      case 'complete': return 'Demo complete. You have seen the full loop.';
      default: return '';
    }
  }

  private _next() {
    const completed = this._step;
    this._track('demo_step_completed', { completedStep: this._step });
    const bonus = this._mode === 'fast' ? 5 : 0;
    this._awardXp(`Step: ${this._flowLabel(completed) || completed}`, STEP_XP[completed] + bonus);
    if (this._stepIndex < DEMO_STEPS.length - 1) this._stepIndex += 1;

    while (this._mode === 'fast' && (this._step === 'quiz-location' || this._step === 'quiz-fairness')) {
      this._track('demo_step_skipped', { skippedStep: this._step, mode: this._mode });
      if (this._stepIndex >= DEMO_STEPS.length - 1) break;
      this._stepIndex += 1;
    }

    this._track('demo_step_started', { startedStep: this._step });
    this._quizAnswer = '';
    this._quizFeedback = '';
  }

  private _startDemo(mode: DemoMode) {
    this._mode = mode;
    this._introOpen = false;
    this._demoStarted = true;
    this._track('demo_started', { mode });
    this._track('demo_step_started', { startedStep: this._step });
  }

  private _skipDemo() {
    this._demoCompleted = true;
    this._track('demo_skipped', {
      reason: 'user_already_familiar',
      reachedStep: this._step,
    });
    this._emit('skip');
  }

  private _toggleManualEditor() {
    if (this._step !== 'location') return;
    this._manualEditorOpen = !this._manualEditorOpen;
  }

  private _pickDemoLocation(label: string) {
    if (this._step !== 'location') return;
    this._selectedLocation = label;
    this._manualEditorOpen = false;
    this._track('demo_location_selected', { label });
    this._next();
  }

  private _submitLocationQuiz(option: QuizOption) {
    if (this._step !== 'quiz-location') return;
    this._quizAnswer = option.id;
    if (option.correct) {
      this._quizFeedback = 'Correct. Manual selection becomes the active location used for planning.';
      this._quizCorrectCount += 1;
      this._combo += 1;
      this._awardXp('Quiz streak', this._combo >= 2 ? 16 : 10);
      this._track('demo_quiz_answered', { question: 'location-override', correct: true, choice: option.id });
      setTimeout(() => this._next(), 450);
    } else {
      this._quizFeedback = 'Not quite. Manual location overwrites the active one for this flow.';
      this._combo = 0;
      this._track('demo_quiz_answered', { question: 'location-override', correct: false, choice: option.id });
    }
  }

  private _continueIdentity() {
    if (this._step !== 'identity') return;
    if (this._demoName.trim().length < 2) return;
    this._track('demo_identity_set', { length: this._demoName.trim().length });
    this._next();
  }

  private _sendInvite() {
    if (this._step !== 'invite') return;
    this._inviteSent = true;
    this._track('demo_invite_sent');
    this._next();
  }

  private _selectVenue(name: string) {
    if (this._step !== 'venue') return;
    this._selectedVenue = name;
  }

  private _confirmVenue() {
    if (this._step !== 'venue' || !this._selectedVenue) return;
    this._track('demo_venue_selected', { venue: this._selectedVenue });
    this._next();
  }

  private _submitFairnessQuiz(option: QuizOption) {
    if (this._step !== 'quiz-fairness') return;
    this._quizAnswer = option.id;
    if (option.correct) {
      this._quizFeedback = 'Exactly. Fairness balances both travel burdens, not just nearest-place wins.';
      this._quizCorrectCount += 1;
      this._combo += 1;
      this._awardXp('Fairness mastered', this._combo >= 2 ? 20 : 12);
      this._track('demo_quiz_answered', { question: 'fairness', correct: true, choice: option.id });
      setTimeout(() => this._next(), 450);
    } else {
      this._quizFeedback = 'Try once more. The goal is balanced effort for both people.';
      this._combo = 0;
      this._track('demo_quiz_answered', { question: 'fairness', correct: false, choice: option.id });
    }
  }

  private _startTracking() {
    if (this._step !== 'tracking' || this._trackingStarted) return;
    this._trackingStarted = true;
    this._trackingProgress = 0;

    if (this._trackingTimer) clearInterval(this._trackingTimer);
    this._trackingTimer = setInterval(() => {
      this._trackingProgress = Math.min(this._trackingProgress + 10, 100);
      if (this._trackingProgress >= 100) {
        if (this._trackingTimer) clearInterval(this._trackingTimer);
        this._trackingTimer = null;
        this._track('demo_tracking_completed');
        this._next();
      }
    }, 240);
  }

  private _shouldShowQuiz(): boolean {
    if (this._mode === 'fast') return false;
    return this._step === 'quiz-location' || this._step === 'quiz-fairness';
  }

  private _enterRealApp() {
    this._demoCompleted = true;
    this._track('demo_completed', {
      quizCorrectCount: this._quizCorrectCount,
      quizTotal: 2,
      completionRate: this._quizCorrectCount / 2,
    });
    this._emit('start');
  }

  private _quizOptionsForCurrentStep(): QuizOption[] {
    if (this._step === 'quiz-location') {
      return [
        { id: 'a', label: 'It replaces the active location used by the session flow.', correct: true },
        { id: 'b', label: 'It only changes a label, GPS still drives everything.', correct: false },
        { id: 'c', label: 'It disables venue ranking entirely.', correct: false },
      ];
    }
    return [
      { id: 'a', label: 'Pick the nearest place to only one person.', correct: false },
      { id: 'b', label: 'Balance travel effort for both participants.', correct: true },
      { id: 'c', label: 'Always prefer highest-rated venue regardless of distance.', correct: false },
    ];
  }

  private _flowLabel(step: DemoStep): string {
    switch (step) {
      case 'location': return 'Location';
      case 'quiz-location': return 'Check 1';
      case 'identity': return 'Identity';
      case 'invite': return 'Invite';
      case 'venue': return 'Venue';
      case 'quiz-fairness': return 'Check 2';
      case 'tracking': return 'Tracking';
      default: return '';
    }
  }

  private _renderActivePanel() {
    const venueOptions = [
      { name: 'Muri Square Cafe', etaA: '14m', etaB: '12m', fair: 'Very balanced' },
      { name: 'Falomo Hub', etaA: '10m', etaB: '23m', fair: 'One-sided' },
      { name: 'Neptune Garden', etaA: '17m', etaB: '15m', fair: 'Balanced' },
    ];

    if (this._step === 'location') {
      return html`
        <div class="panel step-enter">
          <div class="step-title">Set your active location</div>
          <div class="step-copy">Use Edit to switch from live location to a manual address.</div>
          <div class="loc-card">
            <div class="loc-top">
              <div class="loc-icon">📍</div>
              <div>
                <div class="loc-name">${this._selectedLocation}</div>
                <div class="loc-meta">${this._manualEditorOpen ? 'Pick a manual address from the demo options.' : 'Current active location in demo mode.'}</div>
              </div>
            </div>
            <button class="edit-btn" @click=${this._toggleManualEditor}>${this._manualEditorOpen ? 'Close' : 'Edit'}</button>
            ${this._manualEditorOpen ? html`
              <div class="options">
                <button class="option" @click=${() => this._pickDemoLocation('Nicon Town, Lekki Phase 1')}>Nicon Town, Lekki Phase 1</button>
                <button class="option" @click=${() => this._pickDemoLocation('Admiralty Way, Lekki')}>Admiralty Way, Lekki</button>
                <button class="option" @click=${() => this._pickDemoLocation('Oniru Waterfront')}>Oniru Waterfront</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (this._step === 'identity') {
      return html`
        <div class="panel step-enter">
          <div class="step-title">Create session identity</div>
          <div class="step-copy">This mirrors the real create-session screen: add your name, then create.</div>
          <input
            class="field"
            .value=${this._demoName}
            placeholder="Your Name"
            @input=${(e: InputEvent) => { this._demoName = (e.target as HTMLInputElement).value; }}
          />
          <button class="action" @click=${this._continueIdentity} ?disabled=${this._demoName.trim().length < 2}>Create Demo Session</button>
        </div>
      `;
    }

    if (this._step === 'invite') {
      return html`
        <div class="panel step-enter">
          <div class="step-title">Invite your partner</div>
          <div class="step-copy">Like the real invite step, send one link to pull your partner in.</div>
          <div class="row">
            <span class="invite-link">demo://rendezvous/invite/f2a9</span>
          </div>
          <button class="action" @click=${this._sendInvite}>${this._inviteSent ? 'Invite Sent' : 'Send Demo Invite'}</button>
        </div>
      `;
    }

    if (this._step === 'venue') {
      return html`
        <div class="panel step-enter">
          <div class="step-title">Choose a fair venue</div>
          <div class="step-copy">Select the venue that balances travel effort for both participants.</div>
          <div class="options">
            ${venueOptions.map((v) => html`
              <button class="venue ${this._selectedVenue === v.name ? 'active' : ''}" @click=${() => this._selectVenue(v.name)}>
                <strong>${v.name}</strong>
                <span>You ${v.etaA} · Partner ${v.etaB} · ${v.fair}</span>
              </button>
            `)}
          </div>
          <button class="action" @click=${this._confirmVenue} ?disabled=${!this._selectedVenue}>Confirm Venue</button>
        </div>
      `;
    }

    if (this._step === 'tracking') {
      return html`
        <div class="panel step-enter">
          <div class="step-title">Track live progress</div>
          <div class="step-copy">This simulates the live tracking phase in the actual app.</div>
          <div class="tracker" style=${`--progress:${this._trackingProgress}%`}>
            <div class="tracker-fill"></div>
          </div>
          <button class="action" @click=${this._startTracking} ?disabled=${this._trackingStarted}>
            ${this._trackingStarted ? 'Tracking...' : 'Start Live Tracking'}
          </button>
        </div>
      `;
    }

    if (this._step === 'complete') {
      return html`
        <div class="panel step-enter">
          <div class="step-title">You are ready</div>
          <div class="step-copy">You have completed the same path users follow in real sessions.</div>
          <div class="row">
            <span class="score-line">Quiz score: ${this._quizCorrectCount}/2</span>
          </div>
          <button class="action" @click=${this._enterRealApp}>Enter Real App</button>
        </div>
      `;
    }

    return '';
  }

  override render() {
    const showQuiz = this._shouldShowQuiz();
    const xpProgress = Math.max(0, Math.min(100, Math.round((this._xp / this._xpForNextLevel()) * 100)));

    return html`
      <div class="surface">
        <canvas class="webgl-bg" aria-hidden="true"></canvas>
        <div class="stage" aria-live="polite">
          <section class="hero">
            <div class="intro-copy">
              <span class="eyebrow">Active Onboarding Demo</span>
              <div class="title">Master the rendezvous loop in one cinematic run.</div>
              <p class="subtitle">
                No dry tutorial walls. You will move through the real flow, make decisions, and feel how fairness and timing work together.
              </p>
              <div class="signal-strip" aria-label="Demo capability highlights">
                <span class="signal-pill"><span class="signal-dot"></span>Live route sync</span>
                <span class="signal-pill"><span class="signal-dot"></span>Fairness engine</span>
                <span class="signal-pill"><span class="signal-dot"></span>2 min guided loop</span>
              </div>
              <div class="row">
                ${this.canInstall ? html`
                  <button class="action ghost" @click=${() => this._emit('install')}>Install App</button>
                ` : ''}
              </div>
            </div>
            <div class="preview">
              <div class="preview-head">
                  <strong>Mission Control</strong>
                <span class="preview-live">Realtime</span>
              </div>
                <p>Location override, invite handoff, fairness pick, and live tracking in one guided run.</p>
              <div class="preview-metrics" aria-label="Demo metrics">
                <div class="metric">
                  <span class="metric-value">7 Steps</span>
                  <span class="metric-label">Guided flow</span>
                </div>
                <div class="metric">
                  <span class="metric-value">~120s</span>
                  <span class="metric-label">Time to finish</span>
                </div>
                <div class="metric">
                  <span class="metric-value">1 Invite</span>
                  <span class="metric-label">Partner handoff</span>
                </div>
              </div>
              <div class="progress">
                ${DEMO_STEPS.map((_, i) => html`<span class=${i <= this._stepIndex ? 'active' : ''}></span>`)}
              </div>
            </div>
          </section>

          ${!this._introOpen ? html`
            <div class="coach step-enter">
              <strong>${this._step === 'complete' ? 'Unlocked' : `Step ${Math.min(this._stepIndex + 1, DEMO_STEPS.length - 1)} / ${DEMO_STEPS.length - 1}`}</strong>
              <span>${this._stepMessage}</span>
            </div>

            <div class="hud">
              <div class="hud-top">
                <span>Mode: <strong>${this._mode === 'fast' ? 'Fast Track' : 'Guided'}</strong></span>
                <span>Level <strong>${this._level}</strong> · ${this._xp}/${this._xpForNextLevel()} XP</span>
              </div>
              <div class="xp-track" style=${`--xp:${xpProgress}%`}><div class="xp-fill"></div></div>
              <span class="combo-pill">Combo x${Math.max(1, this._combo)}</span>
            </div>

            <section class="demo">
              <div class="flow-rail" aria-label="Onboarding flow progress">
                ${FLOW_STEPS.map((step, index) => {
                  const state = this._stepIndex > index ? 'done' : (this._stepIndex === index ? 'active' : '');
                  return html`<div class="flow-node ${state}">${this._flowLabel(step)}</div>`;
                })}
              </div>
              ${this._renderActivePanel()}
            </section>
          ` : ''}
        </div>
      </div>

      ${this._introOpen ? html`
        <div class="quiz-overlay" role="dialog" aria-modal="true" aria-label="Demo intro">
          <div class="quiz">
            <span class="quiz-kicker">Choose your start mode</span>
            <h3>Welcome to 2bottles</h3>
            <p>
                Choose your pace. Guided teaches every move. Fast Track jumps straight into action.
            </p>
            <div class="mode-grid">
              <button class="mode-btn" @click=${() => this._startDemo('guided')}>
                <strong>Guided Mode</strong>
                <span>Full tutorial, quizzes, and coaching prompts.</span>
              </button>
              <button class="mode-btn" @click=${() => this._startDemo('fast')}>
                <strong>Fast Track</strong>
                <span>Compressed flow, skip checks, sprint to launch.</span>
              </button>
            </div>
            <div class="row">
              <button class="action ghost" @click=${this._skipDemo}>I already know this</button>
              ${this.canInstall ? html`<button class="action ghost" @click=${() => this._emit('install')}>Install App</button>` : ''}
            </div>
            <p class="quickstart-hint">Tip for another device: open with <strong>?quickstart=1</strong> to jump to setup.</p>
          </div>
        </div>
      ` : ''}

      ${(showQuiz && !this._introOpen) ? html`
        <div class="quiz-overlay" role="dialog" aria-modal="true" aria-label="Demo quiz">
          <div class="quiz">
            <span class="quiz-kicker">Knowledge Check</span>
            <h3>${this._step === 'quiz-location' ? 'Quick Check: Location Override' : 'Quick Check: Fairness'}</h3>
            <p>${this._step === 'quiz-location' ? 'What happens when a manual address is selected?' : 'What is the fairness goal in rendezvous selection?'}</p>
            ${this._quizOptionsForCurrentStep().map((o) => html`
              <button class="action ghost ${this._quizAnswer === o.id ? 'selected' : ''}" @click=${() => this._step === 'quiz-location' ? this._submitLocationQuiz(o) : this._submitFairnessQuiz(o)}>${o.label}</button>
            `)}
            ${this._quizFeedback ? html`
              <div class="quiz-result ${this._quizFeedback.startsWith('Correct') || this._quizFeedback.startsWith('Exactly') ? 'good' : 'bad'}">${this._quizFeedback}</div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      ${this._reward ? html`
        <div class="reward-toast" role="status" aria-live="polite">${this._reward}</div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'landing-page': LandingPage; }
}
