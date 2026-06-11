import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

@customElement('hero-gallery')
export class HeroGallery extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 380px;
      margin: 0 auto;
    }

    @media (max-width: 768px) {
      :host { max-width: 300px; }
    }
    @media (max-width: 480px) {
      :host { max-width: 280px; }
    }

    .gallery {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      background: linear-gradient(135deg, #1a2530 0%, #243240 100%);
      border-radius: 32px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .gallery::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 300px;
      height: 300px;
      background: radial-gradient(circle, rgba(74, 139, 196, 0.2) 0%, transparent 70%);
      pointer-events: none;
    }

    .phone-frame {
      position: relative;
      background: #0f1419;
      border-radius: 24px;
      padding: 12px;
      aspect-ratio: 9 / 16;
      width: 100%;
      max-width: 320px;
      margin: 0 auto;
    }

    .phone-screen {
      width: 100%;
      height: 100%;
      background: #141920;
      border-radius: 16px;
      overflow: hidden;
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .status-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 14px;
      z-index: 10;
      pointer-events: none;
    }

    .status-time {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.2px;
      color: #f5f7fa;
      background: rgba(15, 20, 25, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 99px;
      padding: 3px 10px;
      backdrop-filter: blur(10px);
    }

    .status-menu {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #f5f7fa;
      background: rgba(15, 20, 25, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 99px;
      padding: 3px 10px;
      backdrop-filter: blur(10px);
      cursor: pointer;
      pointer-events: auto;
    }

    .screen-content {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: #141920;
      position: relative;
    }

    .sheet {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      background: rgba(20, 25, 32, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(14px);
      border-radius: 22px 22px 0 0;
      padding: 12px 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .handle {
      width: 36px; height: 4px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 99px;
      margin: 0 auto 12px;
      flex-shrink: 0;
    }

    .sheet-title {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 17px;
      font-weight: 700;
      color: #f5f7fa;
      margin: 0;
    }

    .sheet-subtitle {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 12px;
      color: #8892a0;
      margin: 2px 0 0;
    }

    .gps-card {
      background: #1e3a52;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
    }

    .gps-icon {
      width: 36px; height: 36px;
      border-radius: 8px;
      background: rgba(74, 139, 196, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .gps-text { flex: 1; min-width: 0; }

    .gps-name {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #f5f7fa;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .gps-meta {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #8892a0;
      margin-top: 1px;
    }

    .live-badge {
      font-size: 10px;
      font-weight: 700;
      background: #1a3d1a;
      color: #d4e8c4;
      padding: 2px 8px;
      border-radius: 99px;
      flex-shrink: 0;
    }

    .edit-btn {
      position: absolute;
      top: 8px; right: 8px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(15, 20, 25, 0.75);
      color: #5a9bd4;
      border-radius: 99px;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 10px;
      font-weight: 600;
      padding: 3px 10px;
      cursor: pointer;
    }

    .input-field {
      width: 100%;
      padding: 11px 14px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      background: rgba(36, 43, 53, 0.75);
      color: #f5f7fa;
      box-sizing: border-box;
    }
    .input-field::placeholder { color: #6b7280; }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 13px 16px;
      border: none;
      border-radius: 12px;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      line-height: 1;
      transition: all 0.15s;
    }
    .btn:active { transform: scale(0.98); opacity: 0.9; }

    .btn-primary {
      background: #4a8bc4;
      color: #ffffff;
    }

    .btn-green {
      background: #1a3d1a;
      color: #d4e8c4;
    }

    .btn-outline {
      background: transparent;
      color: #5a9bd4;
      border: 1.5px solid rgba(90, 155, 212, 0.4);
    }

    .map-preview {
      flex: 1;
      background: linear-gradient(135deg, #0f1a22 0%, #1a2530 100%);
      border-radius: 12px;
      position: relative;
      overflow: hidden;
      min-height: 0;
    }

    .map-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(74, 139, 196, 0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(74, 139, 196, 0.06) 1px, transparent 1px);
      background-size: 32px 32px;
    }

    .pin {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .pin::after {
      content: '';
      width: 10px;
      height: 10px;
      background: white;
      border-radius: 50%;
      transform: rotate(45deg);
    }

    .pin-you {
      background: #4a8bc4;
      top: 65%;
      left: 20%;
    }

    .pin-partner {
      background: #4ade80;
      top: 25%;
      right: 25%;
    }

    .pin-meet {
      background: #7ab84a;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      width: 36px;
      height: 36px;
    }

    .pin-meet::after {
      width: 14px;
      height: 14px;
    }

    .venue-card {
      background: rgba(0, 0, 0, 0.035);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .venue-icon {
      width: 44px; height: 44px;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }

    .venue-info { flex: 1; min-width: 0; }

    .venue-name {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #f5f7fa;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      margin: 0;
    }

    .venue-meta {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #8892a0;
      margin: 2px 0 0;
    }

    .venue-eta {
      text-align: right;
      flex-shrink: 0;
    }

    .venue-eta-val {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #5a9bd4;
    }

    .venue-eta-label {
      font-size: 10px;
      color: #8892a0;
      margin-top: 1px;
    }

    .venue-badge {
      display: inline-block;
      background: #1a3d1a;
      color: #d4e8c4;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      margin-top: 6px;
    }

    .selected-mark {
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #4a8bc4;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #fff;
      flex-shrink: 0;
    }

    .link-card {
      background: rgba(20, 25, 32, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 12px 16px;
      text-align: center;
    }

    .link-label {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .link-value {
      font-family: 'DM Mono', monospace;
      font-size: 13px;
      font-weight: 500;
      color: #5a9bd4;
      word-break: break-all;
    }

    .link-hint {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #8892a0;
      margin-top: 6px;
    }

    .partner-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      background: rgba(0, 0, 0, 0.03);
      border-radius: 12px;
    }

    .partner-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-weight: 700;
      font-size: 12px;
      color: #fff;
      flex-shrink: 0;
    }

    .partner-info { flex: 1; }

    .partner-name {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #f5f7fa;
    }

    .partner-detail {
      font-size: 11px;
      color: #8892a0;
      margin-top: 1px;
    }

    .agreed-badge {
      font-size: 10px;
      font-weight: 700;
      background: #1a3d1a;
      color: #d4e8c4;
      padding: 2px 8px;
      border-radius: 99px;
      flex-shrink: 0;
    }

    .tracking-card {
      background: rgba(20, 25, 32, 0.95);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      padding: 14px;
    }

    .status-strip {
      background: rgba(20, 25, 32, 0.85);
      border-radius: 99px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      font-weight: 700;
      color: #4ade80;
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .status-dot {
      width: 8px; height: 8px;
      background: #4ade80;
      border-radius: 50%;
    }

    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .venue-name-bar {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .venue-emoji-box {
      width: 40px; height: 40px;
      border-radius: 12px;
      background: rgba(74, 139, 196, 0.15);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .venue-text-name {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #f5f7fa;
      margin: 0;
    }

    .venue-text-addr {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #8892a0;
      margin: 1px 0 0;
    }

    .eta-grid {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .eta-item { flex: 1; text-align: center; }

    .eta-item label {
      display: block;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 10px;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .eta-val {
      display: block;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #5a9bd4;
      line-height: 1;
    }

    .eta-divider {
      width: 1px;
      height: 28px;
      background: rgba(255, 255, 255, 0.08);
    }

    .tracking-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .tracking-row:last-child { margin-bottom: 0; }

    .tracking-avatar {
      width: 32px; height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .tracking-info { flex: 1; }

    .tracking-name {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 600;
      color: #e5e7eb;
    }

    .tracking-eta-text {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 11px;
      color: #8892a0;
    }

    .progress-bar {
      height: 5px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 3px;
      overflow: hidden;
      margin-top: 6px;
    }

    .progress-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }

    .slides {
      display: grid;
      width: 100%;
    }

    .slide {
      grid-area: 1 / 1;
      position: relative;
      opacity: 0;
      transform: translateX(20px);
      transition: opacity 0.5s ease, transform 0.5s ease;
      pointer-events: none;
    }
    .slide.active { opacity: 1; transform: translateX(0); pointer-events: auto; z-index: 1; }
    .slide.prev { transform: translateX(-20px); }

    .indicators {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 20px;
    }

    .indicator {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .indicator.active {
      background: white;
      width: 20px;
      border-radius: 3px;
    }

    .gallery-header {
      width: 100%;
    }

    .step-label {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .step-number {
      width: 28px; height: 28px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: white;
    }

    .step-text {
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
    }

    @media (max-width: 768px) {
      .gallery { padding: 14px; border-radius: 24px; gap: 14px; }
      .phone-frame { padding: 8px; border-radius: 18px; }
      .phone-screen { border-radius: 12px; }
      .step-number { width: 24px; height: 24px; font-size: 10px; }
      .step-text { font-size: 11px; }
      .sheet { padding: 10px 14px 16px; border-radius: 18px; gap: 12px; }
      .sheet-title { font-size: 15px; }
      .sheet-subtitle { font-size: 11px; }
      .gps-card { padding: 8px 10px; }
      .gps-name { font-size: 12px; }
      .btn { padding: 12px 14px; font-size: 13px; border-radius: 10px; }
      .input-field { padding: 10px 12px; font-size: 13px; border-radius: 10px; }
      .venue-card { padding: 10px; }
      .venue-name { font-size: 13px; }
      .tracking-card { padding: 10px; }
      .venue-text-name { font-size: 13px; }
      .eta-val { font-size: 18px; }
      .indicators { gap: 5px; }
      .indicator { width: 5px; height: 5px; }
      .indicator.active { width: 16px; }
    }

    @media (max-width: 480px) {
      .gallery { padding: 10px; border-radius: 20px; gap: 10px; }
      .phone-frame { padding: 6px; border-radius: 14px; max-width: none; }
      .phone-screen { border-radius: 10px; }
      .handle { width: 28px; height: 3px; margin-bottom: 8px; }
      .sheet { padding: 8px 10px 12px; border-radius: 14px; gap: 10px; }
      .sheet-title { font-size: 14px; }
      .sheet-subtitle { font-size: 10px; }
      .gps-icon { width: 30px; height: 30px; font-size: 14px; }
      .gps-name { font-size: 11px; }
      .btn { padding: 10px 12px; font-size: 12px; }
      .input-field { padding: 8px 10px; font-size: 12px; }
      .venue-icon { width: 36px; height: 36px; font-size: 18px; }
      .venue-name { font-size: 12px; }
      .venue-meta { font-size: 10px; }
      .venue-eta-val { font-size: 12px; }
      .link-value { font-size: 11px; }
      .status-time { font-size: 10px; padding: 2px 8px; }
      .status-menu { font-size: 9px; padding: 2px 8px; }
      .eta-val { font-size: 16px; }
      .tracking-avatar { width: 26px; height: 26px; font-size: 10px; }
      .tracking-name { font-size: 11px; }
      .progress-bar { height: 4px; }
      .indicator { width: 4px; height: 4px; }
      .indicator.active { width: 14px; }
      .step-number { width: 20px; height: 20px; font-size: 9px; }
      .step-text { font-size: 10px; }
    }
  `;

  @state() private _currentSlide = 0;
  @state() private _prevSlide = -1;
  private _autoplayTimer?: ReturnType<typeof setInterval>;

  private _slides = [
    {
      step: '1',
      label: 'Create session',
      render: () => this._renderCreateSession(),
    },
    {
      step: '2',
      label: 'Share link',
      render: () => this._renderInvite(),
    },
    {
      step: '3',
      label: 'Pick venue',
      render: () => this._renderVenue(),
    },
    {
      step: '4',
      label: 'Track & meet',
      render: () => this._renderTracking(),
    },
  ];

  override connectedCallback() {
    super.connectedCallback();
    this._startAutoplay();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._stopAutoplay();
  }

  private _startAutoplay() {
    this._autoplayTimer = setInterval(() => {
      this._nextSlide();
    }, 3500);
  }

  private _stopAutoplay() {
    if (this._autoplayTimer) {
      clearInterval(this._autoplayTimer);
    }
  }

  private _nextSlide() {
    this._prevSlide = this._currentSlide;
    this._currentSlide = (this._currentSlide + 1) % this._slides.length;
  }

  private _goToSlide(index: number) {
    this._stopAutoplay();
    this._prevSlide = this._currentSlide;
    this._currentSlide = index;
    this._startAutoplay();
  }

  private _renderCreateSession() {
    return html`
      <div class="phone-frame">
        <div class="phone-screen">
          <div class="status-bar">
            <div class="status-time">9:41</div>
            <div class="status-menu">···</div>
          </div>
          <div class="screen-content">
            <div class="map-preview">
              <div class="map-grid"></div>
              <div class="pin pin-you"></div>
            </div>
            <div class="sheet">
              <div class="handle"></div>
              <h3 class="sheet-title">Start a Rendezvous</h3>
              <p class="sheet-subtitle">Pick a name for your session</p>
              <div class="gps-card">
                <div class="gps-icon">📍</div>
                <div class="gps-text">
                  <div class="gps-name">Current Location</div>
                  <div class="gps-meta">GPS signal active</div>
                </div>
                <span class="live-badge">LIVE</span>
              </div>
              <input class="input-field" placeholder="Session name" .value=${'Evening Drinks'}>
              <button class="btn btn-primary">Create Session →</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderInvite() {
    return html`
      <div class="phone-frame">
        <div class="phone-screen">
          <div class="status-bar">
            <div class="status-time">9:41</div>
            <div class="status-menu">···</div>
          </div>
          <div class="screen-content">
            <div class="map-preview">
              <div class="map-grid"></div>
              <div class="pin pin-you"></div>
              <div class="pin pin-partner"></div>
            </div>
            <div class="sheet">
              <div class="handle"></div>
              <h3 class="sheet-title">Invite your partner</h3>
              <p class="sheet-subtitle">They'll see the session instantly</p>
              <div class="link-card">
                <div class="link-label">Session link</div>
                <div class="link-value">2bottles.app/join/abc123</div>
                <div class="link-hint">Tap to copy</div>
              </div>
              <div class="partner-row">
                <div class="partner-avatar" style="background:#4a8bc4;">A</div>
                <div class="partner-info">
                  <div class="partner-name">Alex</div>
                  <div class="partner-detail">Joined via link</div>
                </div>
                <span class="agreed-badge">✓ Ready</span>
              </div>
              <button class="btn btn-green">Share Link</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderVenue() {
    return html`
      <div class="phone-frame">
        <div class="phone-screen">
          <div class="status-bar">
            <div class="status-time">9:41</div>
            <div class="status-menu">···</div>
          </div>
          <div class="screen-content">
            <div class="map-preview">
              <div class="map-grid"></div>
              <div class="pin pin-you"></div>
              <div class="pin pin-partner"></div>
              <div class="pin pin-meet"></div>
            </div>
            <div class="sheet">
              <div class="handle"></div>
              <h3 class="sheet-title">Pick a fair venue</h3>
              <p class="sheet-subtitle">Equal travel time for both</p>
              <div class="venue-card">
                <div class="venue-icon">☕</div>
                <div class="venue-info">
                  <div class="venue-name">Muri Square Café</div>
                  <div class="venue-meta">Café · 0.4 km from midpoint</div>
                </div>
                <div class="venue-eta">
                  <div class="venue-eta-val">8 min</div>
                  <div class="venue-eta-label">for both</div>
                </div>
                <div class="selected-mark">✓</div>
              </div>
              <div class="venue-card">
                <div class="venue-icon">🍕</div>
                <div class="venue-info">
                  <div class="venue-name">Piazza Romana</div>
                  <div class="venue-meta">Italian · 0.6 km from midpoint</div>
                </div>
                <div class="venue-eta">
                  <div class="venue-eta-val">11 min</div>
                  <div class="venue-eta-label">for both</div>
                </div>
              </div>
              <button class="btn btn-primary">Confirm Venue</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderTracking() {
    return html`
      <div class="phone-frame">
        <div class="phone-screen">
          <div class="status-bar">
            <div class="status-time">9:41</div>
            <div class="status-menu">···</div>
          </div>
          <div class="screen-content">
            <div class="map-preview">
              <div class="map-grid"></div>
              <div class="pin pin-you"></div>
              <div class="pin pin-partner"></div>
              <div class="pin pin-meet"></div>
            </div>
            <div class="sheet" style="padding-bottom:14px;">
              <div class="handle"></div>
              <div class="status-strip">
                <div class="status-indicator">
                  <div class="status-dot"></div>
                  <span>Alex is on the way</span>
                </div>
                <span>8 min away</span>
              </div>
              <div class="venue-name-bar" style="margin-bottom:0;">
                <div class="venue-emoji-box">☕</div>
                <div>
                  <div class="venue-text-name">Muri Square Café</div>
                  <div class="venue-text-addr">12 Muri Square, Lagos</div>
                </div>
              </div>
              <div class="eta-grid">
                <div class="eta-item">
                  <label>You</label>
                  <span class="eta-val">6</span>
                </div>
                <div class="eta-divider"></div>
                <div class="eta-item">
                  <label>Alex</label>
                  <span class="eta-val">10</span>
                </div>
                <div class="eta-divider"></div>
                <div class="eta-item">
                  <label>To venue</label>
                  <span class="eta-val" style="color:#4ade80;">8</span>
                </div>
              </div>
              <div class="tracking-row">
                <div class="tracking-avatar" style="background:#4a8bc4;">Y</div>
                <div class="tracking-info">
                  <div class="tracking-name">You — leaving soon</div>
                  <div class="tracking-eta-text">6 min to venue</div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:40%;background:#4a8bc4;"></div>
                  </div>
                </div>
              </div>
              <div class="tracking-row">
                <div class="tracking-avatar" style="background:#4ade80;">A</div>
                <div class="tracking-info">
                  <div class="tracking-name">Alex — on the move</div>
                  <div class="tracking-eta-text">10 min to venue</div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:65%;background:#4ade80;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  override render() {
    const current = this._slides[this._currentSlide];
    return html`
      <div class="gallery">
        <div class="gallery-header">
          <div class="step-label">
            <div class="step-number">${current.step}</div>
            <div class="step-text">${current.label}</div>
          </div>
        </div>
        <div class="slides">
          ${this._slides.map((slide, i) => html`
            <div class="slide ${i === this._currentSlide ? 'active' : ''} ${i === this._prevSlide ? 'prev' : ''}">
              ${slide.render()}
            </div>
          `)}
        </div>
        <div class="indicators">
          ${this._slides.map((_, i) => html`
            <div 
              class="indicator ${i === this._currentSlide ? 'active' : ''}"
              @click=${() => this._goToSlide(i)}
            ></div>
          `)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hero-gallery': HeroGallery;
  }
}
