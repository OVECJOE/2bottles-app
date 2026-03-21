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

type LandingCta = 'start' | 'install';
type DemoStep = 'location' | 'quiz-location' | 'identity' | 'invite' | 'venue' | 'quiz-fairness' | 'tracking' | 'complete';
type QuizOption = { id: string; label: string; correct: boolean };
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
        font-family: var(--font-sans);
        color: var(--color-text-primary);
      }

      .surface {
        position: relative;
        isolation: isolate;
        min-height: 100dvh;
        overflow: visible;
        padding: clamp(18px, 3vw, 28px);
        display: block;
        background:
          radial-gradient(1200px 680px at -8% -14%, var(--blue-100) 0%, transparent 60%),
          radial-gradient(980px 600px at 108% 2%, var(--green-100) 0%, transparent 58%),
          radial-gradient(760px 400px at 50% 114%, var(--neutral-0) 0%, transparent 68%),
          linear-gradient(180deg, rgba(77, 114, 152, 0.05) 0%, rgba(122, 184, 74, 0.03) 100%),
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
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-xl);
        background:
          linear-gradient(155deg, rgba(255, 255, 255, 0.78) 0%, rgba(244, 246, 248, 0.88) 100%),
          linear-gradient(120deg, rgba(77, 114, 152, 0.08), rgba(122, 184, 74, 0.05));
        backdrop-filter: blur(8px);
        position: relative;
        overflow: hidden;
      }

      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: inherit;
        border: 1px solid rgba(77, 114, 152, 0.26);
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
        border: 1px solid var(--color-border-strong);
        border-radius: var(--border-radius-pill);
        padding: 6px 10px;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        background: linear-gradient(120deg, rgba(255, 255, 255, 0.9), rgba(244, 246, 248, 0.86));
      }

      .signal-dot {
        width: 7px;
        height: 7px;
        border-radius: var(--border-radius-pill);
        background: var(--color-blue);
        animation: signal-pulse 1.6s var(--ease-in-out) infinite;
      }

      .badge {
        width: max-content;
        border-radius: var(--border-radius-pill);
        border: 1px solid var(--color-border-strong);
        font-size: var(--text-xs);
        font-weight: var(--weight-bold);
        letter-spacing: 0.7px;
        padding: 6px 11px;
        background: linear-gradient(120deg, rgba(255, 255, 255, 0.90), rgba(244, 246, 248, 0.9));
      }

      .title {
        font-size: clamp(26px, 4.5vw, 44px);
        line-height: 1.02;
        letter-spacing: -1px;
        max-width: 16ch;
        background: linear-gradient(130deg, var(--color-text-primary) 6%, var(--color-blue-dark) 58%, var(--color-green-dark) 110%);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }

      .subtitle {
        font-size: var(--text-lg);
        color: var(--color-text-secondary);
        line-height: 1.5;
        max-width: 50ch;
      }

      .preview {
        position: relative;
        border-radius: var(--border-radius-lg);
        border: 1px solid var(--color-border-strong);
        background:
          linear-gradient(145deg, var(--color-surface-inverse) 0%, rgba(36, 50, 64, 0.92) 100%),
          repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0px, rgba(255, 255, 255, 0.04) 1px, transparent 1px, transparent 18px);
        color: var(--color-text-inverted);
        padding: var(--space-4);
        display: grid;
        align-content: center;
        gap: var(--space-2);
        overflow: hidden;
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
        border-radius: var(--border-radius-md);
        padding: 8px;
        display: grid;
        gap: 2px;
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
        border: 1px solid var(--color-border-strong);
        border-radius: var(--border-radius-pill);
        background: linear-gradient(120deg, rgba(255, 255, 255, 0.92), rgba(244, 246, 248, 0.88));
        backdrop-filter: blur(6px);
      }

      .coach strong { font-size: var(--text-sm); }
      .coach span { font-size: var(--text-sm); color: var(--color-text-secondary); }

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
        border: 1px solid var(--color-border);
        border-radius: var(--border-radius-md);
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.72);
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
      }

      .flow-node.active {
        border-color: var(--color-blue-mid);
        color: var(--color-blue-dark);
        background: rgba(219, 232, 244, 0.72);
      }

      .flow-node.done {
        border-color: var(--color-success-strong);
        color: var(--color-success-text);
        background: rgba(208, 239, 177, 0.68);
      }

      .panel {
        border: 1px solid var(--color-border-strong);
        border-radius: var(--border-radius-xl);
        background: linear-gradient(150deg, rgba(255, 255, 255, 0.90), rgba(244, 246, 248, 0.88));
        padding: clamp(18px, 2.8vw, 24px);
        display: grid;
        gap: var(--space-4);
        position: relative;
        overflow: hidden;
        backdrop-filter: blur(6px);
        clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%);
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
        border-radius: var(--border-radius-md);
        background: linear-gradient(125deg, var(--color-blue-dark), var(--color-blue-mid));
        color: var(--color-blue-text);
        font-size: var(--text-md);
        font-weight: var(--weight-bold);
        font-family: inherit;
        letter-spacing: 0.15px;
        padding: 12px 16px;
        cursor: pointer;
        transition: transform var(--duration-fast) var(--ease-spring), filter var(--duration-fast) var(--ease-out);
      }

      .action:hover {
        transform: translateY(-1px);
        filter: saturate(1.1);
      }

      .action.ghost {
        background: rgba(255, 255, 255, 0.72);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border);
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
        background: rgba(15, 26, 34, 0.72);
        display: grid;
        place-items: center;
        z-index: 15;
        padding: var(--space-4);
      }

      .quiz {
        width: min(520px, 100%);
        border-radius: var(--border-radius-xl);
        border: 1px solid var(--color-border-strong);
        background:
          linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(244, 246, 248, 0.93)),
          radial-gradient(500px 180px at 10% -20%, rgba(77, 114, 152, 0.14) 0%, transparent 70%);
        padding: var(--space-5);
        display: grid;
        gap: var(--space-3);
        backdrop-filter: blur(8px);
        position: relative;
        overflow: hidden;
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
        border: 1px solid var(--color-border-strong);
        border-radius: var(--border-radius-pill);
        padding: 4px 9px;
        font-size: var(--text-xs);
        color: var(--color-blue-dark);
        background: rgba(219, 232, 244, 0.7);
      }

      .quiz h3 {
        margin: 0;
        font-size: var(--text-xl);
      }

      .quiz p {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
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
        .coach {
          top: 8px;
          border-radius: var(--border-radius-lg);
          align-items: flex-start;
          flex-direction: column;
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
    this._track('demo_step_completed', { completedStep: this._step });
    if (this._stepIndex < DEMO_STEPS.length - 1) this._stepIndex += 1;
    this._track('demo_step_started', { startedStep: this._step });
    this._quizAnswer = '';
    this._quizFeedback = '';
  }

  private _startDemo() {
    this._introOpen = false;
    this._demoStarted = true;
    this._track('demo_started');
    this._track('demo_step_started', { startedStep: this._step });
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
      this._track('demo_quiz_answered', { question: 'location-override', correct: true, choice: option.id });
      setTimeout(() => this._next(), 450);
    } else {
      this._quizFeedback = 'Not quite. Manual location overwrites the active one for this flow.';
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
      this._track('demo_quiz_answered', { question: 'fairness', correct: true, choice: option.id });
      setTimeout(() => this._next(), 450);
    } else {
      this._quizFeedback = 'Try once more. The goal is balanced effort for both people.';
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
            <span class="badge">demo://rendezvous/invite/f2a9</span>
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
            <span class="badge">Quiz score: ${this._quizCorrectCount}/2</span>
          </div>
          <button class="action" @click=${this._enterRealApp}>Enter Real App</button>
        </div>
      `;
    }

    return '';
  }

  override render() {
    const showQuiz = this._step === 'quiz-location' || this._step === 'quiz-fairness';

    return html`
      <div class="surface">
        <canvas class="webgl-bg" aria-hidden="true"></canvas>
        <div class="stage" aria-live="polite">
          <section class="hero">
            <div class="intro-copy">
              <span class="badge">ACTIVE ONBOARDING DEMO</span>
              <div class="title">Learn 2bottles by using it, not by reading about it.</div>
              <p class="subtitle">
                This guided simulation runs the full rendezvous flow with prompts, checks, and realistic decisions.
                Complete it once, then jump straight into real mode.
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
                <strong>2-minute demo mode</strong>
                <span class="preview-live">Realtime</span>
              </div>
              <p>Location override, invite loop, fairness selection, and live tracking in one guided run.</p>
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
            <span class="quiz-kicker">Onboarding Required</span>
            <h3>Welcome to 2bottles</h3>
            <p>
              You will complete a forced demo run before using real mode. It takes about 2 minutes and shows the full rendezvous loop.
            </p>
            <div class="row">
              <button class="action" @click=${this._startDemo}>Start Demo Mode</button>
              ${this.canInstall ? html`<button class="action ghost" @click=${() => this._emit('install')}>Install App</button>` : ''}
            </div>
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
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'landing-page': LandingPage; }
}
