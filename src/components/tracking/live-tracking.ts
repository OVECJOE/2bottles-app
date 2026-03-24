/**
 * <live-tracking> — active navigation + ETA + in-session chat overlay.
 *
 * Responsibilities:
 *   compute rolling ETA/progress from live coordinates
 *   drive proximity/arrival notifications
 *   coordinate map behavior (follow, route mode, fit bounds)
 */
import { LitElement, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { liveTrackingStyles } from './live-tracking.styles.js';
import { locationStore, sessionStore, uiStore } from '../../store/index.js';
import { haversineMeters } from '../../services/geocoding.service.js';
import { p2pService } from '../../services/p2p.service.js';
import '../ui/screen-shell.js';

@customElement('live-tracking')
export class LiveTracking extends LitElement {
  static override styles = liveTrackingStyles;

  @state() private _showChat = false;
  @state() private _lastDistanceToDest: number | null = null;
  @state() private _elapsedSeconds = 0;
  @state() private _etaBaselineSeconds: number | null = null;
  @state() private _isStalled = false;
  @state() private _lastProgressDistance: number | null = null;
  @state() private _lastProgressSecond = 0;
  @state() private _arrivalNotified = false;
  @state() private _lastProximityTier = -1;
  @state() private _unreadMessages = 0;
  @state() private _followUser = false;
  @state() private _routeMode: 'both' | 'mine' = 'both';
  
  private _ticker?: any;
  private _unsubLocation?: () => void;
  private _unsubSession?: () => void;
  private _lastOwnSample: { lat: number; lng: number; t: number } | null = null;
  private _lastChatMessageCount = 0;
  @query('.chat-body') private _chatBodyEl?: HTMLElement;

  override connectedCallback() {
    super.connectedCallback();
    // Always reset panel visibility when entering tracking.
    // This avoids getting stuck if a previous screen persisted sheetOpen=false.
    uiStore.openSheet();
    this._lastChatMessageCount = sessionStore.chatMessages.length;
    this._unsubLocation = locationStore.subscribe(() => {
      this._onLocationUpdate();
      this.requestUpdate();
    });
    this._unsubSession = sessionStore.subscribe(() => {
      this._onChatUpdate();
      if (sessionStore.session?.status === 'ended') {
        uiStore.goToEndSession();
      }
      this.requestUpdate();
      if (this._showChat) this._scrollChatToBottom();
    });

    locationStore.startWatching();
    this._fireMapEvent('map-view:follow-user', { enabled: this._followUser });
    this._fireMapEvent('map-view:route-mode', { mode: this._routeMode });
    this._fireMapEvent('map-view:draw-tracking-routes', {});
    this._fireMapEvent('map-view:fit-tracking', {});

    this._startTimer();
  }

  private _onChatUpdate() {
    const nextCount = sessionStore.chatMessages.length;
    if (nextCount < this._lastChatMessageCount) {
      this._lastChatMessageCount = nextCount;
      this._unreadMessages = 0;
      return;
    }

    if (nextCount > this._lastChatMessageCount) {
      const incoming = sessionStore.chatMessages
        .slice(this._lastChatMessageCount)
        .filter((m) => m.senderId !== 'me').length;
      if (incoming > 0 && !this._showChat) {
        this._unreadMessages += incoming;
      }
      this._lastChatMessageCount = nextCount;
    }
  }

  private _startTimer() {
    this._ticker = setInterval(() => {
      this._elapsedSeconds++;
      this.requestUpdate();
    }, 1000);
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubLocation?.();
    this._unsubSession?.();
    clearInterval(this._ticker);
    this._fireMapEvent('map-view:follow-user', { enabled: false });
    this._fireMapEvent('map-view:route-mode', { mode: 'both' });
  }

  private _onLocationUpdate() {
    const { own, partner, destination } = locationStore;
    if (!own || !destination) return;

    const distOwn = haversineMeters(own, destination);
    const distPart = partner ? haversineMeters(partner, destination) : null;

    // ETA is distance / speed. We estimate personal speed from recent movement
    // and clamp it to a realistic urban range to avoid wild spikes.
    // Distance math reference (great-circle/haversine):
    // https://en.wikipedia.org/wiki/Haversine_formula
    const speedKmhOwn = this._estimateOwnSpeedKmh(own);
    const etaOwn = Math.round((distOwn / 1000) / speedKmhOwn * 60);
    const etaPart = distPart !== null ? Math.round((distPart / 1000) / 12 * 60) : null;

    if (this._etaBaselineSeconds === null && etaOwn > 0) {
      this._etaBaselineSeconds = etaOwn * 60;
      this._lastProgressSecond = this._elapsedSeconds;
    }

    if (this._lastProgressDistance === null || distOwn < this._lastProgressDistance - 12) {
      this._lastProgressDistance = distOwn;
      this._lastProgressSecond = this._elapsedSeconds;
      this._isStalled = false;
    } else {
      this._isStalled = (this._elapsedSeconds - this._lastProgressSecond) > 90 && distOwn > 120;
    }

    locationStore.setEtas(etaOwn, etaPart);
    locationStore.setDistances(distOwn, distPart);

    if (partner) {
      const distBetweenUsers = haversineMeters(own, partner);
      this._handleProximityAlert(distBetweenUsers);
    } else {
      this._lastProximityTier = -1;
    }

    if (distOwn < 60 && (this._lastDistanceToDest === null || this._lastDistanceToDest >= 60)) {
      this._onArrived();
    }
    this._lastDistanceToDest = distOwn;
  }

  private _getProximityTier(distanceM: number): number {
    if (distanceM <= 140) return 1;
    if (distanceM <= 320) return 0;
    return -1;
  }

  private _notifyProximity(message: string) {
    uiStore.showToast(message);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
      new Notification('2bottles', { body: message });
    }
  }

  private _handleProximityAlert(distanceM: number) {
    const tier = this._getProximityTier(distanceM);
    if (tier === -1) {
      if (distanceM > 800) this._lastProximityTier = -1;
      return;
    }
    if (tier <= this._lastProximityTier) return;

    const partnerName = sessionStore.partnerName || 'Partner';

    if (tier === 0) {
      this._notifyProximity(`${partnerName} is about 2 blocks away.`);
    } else if (tier === 1) {
      this._notifyProximity(`${partnerName} is almost there.`);
    }

    this._lastProximityTier = tier;
  }

  private _estimateOwnSpeedKmh(own: { lat: number; lng: number }) {
    const now = Date.now();
    if (!this._lastOwnSample) {
      this._lastOwnSample = { lat: own.lat, lng: own.lng, t: now };
      return 10;
    }

    // Convert elapsed milliseconds to hours for km/h, with a 1-second floor
    // so near-simultaneous GPS samples cannot blow up the speed estimate.
    // Unit conversion refresher: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date/now
    const dtHours = Math.max((now - this._lastOwnSample.t) / 3_600_000, 1 / 3600);
    const movedMeters = haversineMeters(
      { lat: this._lastOwnSample.lat, lng: this._lastOwnSample.lng },
      own,
    );
    this._lastOwnSample = { lat: own.lat, lng: own.lng, t: now };

    const speed = (movedMeters / 1000) / dtHours;
    if (!Number.isFinite(speed) || speed <= 0.5) return this._isStalled ? 4 : 10;
    return Math.min(45, Math.max(4, speed));
  }

  private _onArrived() {
    uiStore.showToast('You have arrived at the destination!');
    if (!this._arrivalNotified) {
      this._arrivalNotified = true;
      p2pService.send({ type: 'partner:status', status: 'arrived' });
    }
  }

  private _toggleView() {
    this._showChat = !this._showChat;
    if (this._showChat) {
      this._unreadMessages = 0;
      this._scrollChatToBottom();
    }
  }

  private _scrollChatToBottom() {
    requestAnimationFrame(() => {
      if (this._chatBodyEl) {
        this._chatBodyEl.scrollTop = this._chatBodyEl.scrollHeight;
      }
    });
  }

  private _toggleFollowUser() {
    this._followUser = !this._followUser;
    this._fireMapEvent('map-view:follow-user', { enabled: this._followUser });
  }

  private _setRouteMode(mode: 'both' | 'mine') {
    if (this._routeMode === mode) return;
    this._routeMode = mode;
    this._fireMapEvent('map-view:route-mode', { mode });
  }

  private _sendMessage(e: Event) {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const input = form.querySelector('input');
    if (!(input instanceof HTMLInputElement)) return;
    const text = input.value.trim();
    if (!text) return;

    const timestamp = Date.now();
    const id = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2);

    sessionStore.addMessage({
      id,
      senderId: 'me',
      text,
      timestamp,
    });

    p2pService.send({ type: 'chat:message', text, timestamp });
    input.value = '';
  }

  private async _endSession() {
    const confirmed = await uiStore.confirm({
      title: 'End Session?',
      message: 'Are you sure you want to end this session for everyone?',
      confirmLabel: 'End Session',
      cancelLabel: 'Keep Going'
    });

    if (confirmed) {
      p2pService.endSessionForAll();
      await sessionStore.setSessionStatus('ended');
      uiStore.goToEndSession();
    }
  }

  private _fireMapEvent(type: string, detail: unknown = {}) {
    this.dispatchEvent(new CustomEvent(type, {
      detail,
      bubbles: true,
      composed: true
    }));
  }

  private _formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  private _formatProgressTimer() {
    if (this._etaBaselineSeconds === null) return this._formatTime(this._elapsedSeconds);
    const delta = this._etaBaselineSeconds - this._elapsedSeconds;
    if (delta >= 0) return `-${this._formatTime(delta)}`;
    return `+${this._formatTime(Math.abs(delta))}`;
  }

  override render() {
    const { session, partnerName, chatMessages, selectedVenue } = sessionStore;
    const { ownEtaMinutes, partnerEtaMinutes, ownDistanceM, partnerDistanceM, isWatching } = locationStore;

    if (!session) return html`<div>Loading session...</div>`;

    return html`
        <screen-shell screen='live-tracking'>
      <div class="tracking-overlay sheet">
                <div class="status-strip ${isWatching ? 'online' : 'offline'}">
                    <div class="status-indicator">
                        <span class="pulse-dot"></span>
                        <span class="status-text">
                            ${isWatching ? 'Live Tracking' : 'Searching for GPS...'}
                            <span class="timer-tag">${this._formatProgressTimer()}</span>
                        </span>
                    </div>
                    <button class="end-btn" @click=${this._endSession}>End Session</button>
                </div>

                <div class="main-content">
                    <div class="eta-card card">
                        <div class="venue-info">
                            <span class="venue-emoji">${selectedVenue?.emoji || '📍'}</span>
                            <div class="venue-text">
                                <h3>${selectedVenue?.name || 'Meetup Point'}</h3>
                                <p>
                                  ${ownDistanceM !== null ? (ownDistanceM / 1000).toFixed(1) : '--'} km away
                                  ${this._isStalled ? ' · traffic slowing you down' : ''}
                                </p>
                            </div>
                        </div>

                        <div class="eta-grid">
                            <div class="eta-item">
                                <label>You</label>
                                <span class="eta-val">${ownEtaMinutes !== null ? `${ownEtaMinutes}m` : '--'}</span>
                                <span class="dist-val">${ownDistanceM !== null ? (ownDistanceM / 1000).toFixed(1) : '--'}km</span>
                            </div>
                            <div class="eta-divider"></div>
                            <div class="eta-item">
                                <label>${partnerName || 'Partner'}</label>
                                <span class="eta-val">${partnerEtaMinutes !== null ? `${partnerEtaMinutes}m` : '--'}</span>
                                <span class="dist-val">${partnerDistanceM !== null ? `${(partnerDistanceM / 1000).toFixed(1)}km` : '--'}</span>
                            </div>
                        </div>
                        
                        <div class="recenter-bar">
                             <button class="text-btn" @click=${() => this._fireMapEvent('map-view:fit-tracking', {})}>
                                Recenter Map
                             </button>
                             <button class="text-btn ${this._followUser ? 'active' : ''}" @click=${this._toggleFollowUser}>
                                ${this._followUser ? 'Following You' : 'Follow Me'}
                             </button>
                        </div>

                        <div class="route-mode-row">
                            <button
                              class="route-mode-btn ${this._routeMode === 'both' ? 'active' : ''}"
                              @click=${() => this._setRouteMode('both')}
                            >Both Routes</button>
                            <button
                              class="route-mode-btn ${this._routeMode === 'mine' ? 'active' : ''}"
                              @click=${() => this._setRouteMode('mine')}
                            >My Route</button>
                        </div>
                    </div>

                    <div class="chat-widget ${this._showChat ? 'expanded' : 'collapsed'} card">
                      <div
                          class="chat-header"
                          role="button"
                          tabindex="0"
                          aria-expanded=${this._showChat ? 'true' : 'false'}
                          @click=${this._toggleView}
                          @keydown=${(e: KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              this._toggleView();
                            }
                          }}
                        >
                            <div class="chat-title">
                                <span class="chat-icon">💭</span>
                                <span>Chat with ${partnerName || 'Partner'}</span>
                            </div>
                            <span class="chat-toggle">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="m18 15-6-6-6 6"/>
                                </svg>
                              ${!this._showChat && this._unreadMessages > 0 ? html`
                                <span class="chat-unread-badge">${this._unreadMessages > 99 ? '99+' : this._unreadMessages}</span>
                              ` : null}
                            </span>
                        </div>

                        ${this._showChat ? html`
                            <div class="chat-view">
                                <div class="chat-body" id="chat-body">
                                    ${chatMessages.map(msg => html`
                                        <div class="msg ${msg.senderId === 'me' ? 'sent' : 'received'}">
                                            <div class="msg-bubble">${msg.text}</div>
                                        </div>
                                    `)}
                                </div>
                                <form class="chat-input" @submit=${this._sendMessage}>
                                    <input type="text" placeholder="Type a message..." autocomplete="off" maxlength="400">
                                    <button type="submit">Send</button>
                                </form>
                            </div>
                        ` : null}
                    </div>
                </div>
                </div>
                </screen-shell>
        `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'live-tracking': LiveTracking; }
}