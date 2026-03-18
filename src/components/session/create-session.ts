/**
 * <create-session> — first screen.
 * Shows live GPS location. Lets the user override with a manual
 * address via <location-input> (real Nominatim autocomplete).
 * On confirm, calls sessionService.createSession() which hits
 * the API and navigates to invite-partner.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { locationStore, uiStore, sessionStore, authStore } from '../../store/index.js';
import { reverseGeocode } from '../../services/geocoding.service.js';
import { p2pService } from '../../services/p2p.service.js';
import { sessionsApi, type PendingInvite } from '../../api/sessions.api.js';
import { wsService } from '../../services/websocket.service.js';
import { sharedStyles } from '../../styles/shared-styles.js';
import { billingEnabled, usersApi } from '../../api/users.api.js';
import '../../components/ui/location-input.js';
import '../../components/ui/screen-shell.js';
import type { GeocodeSuggestion } from '../../services/geocoding.service.js';
import type { Coordinates } from '../../types/index.js';

@customElement('create-session')
export class CreateSession extends LitElement {
  static override styles = [
    sharedStyles,
    css`
    :host { display: block; }

    /* Local overrides */
    .sheet { animation: slide-up var(--duration-sheet) var(--ease-out) both; }

    .gps-row {
      display: flex; align-items: center; gap: var(--space-3);
      background: rgba(77,114,152,0.07);
      border: 1px solid rgba(77,114,152,0.15);
      border-radius: var(--border-radius-md);
      padding: var(--space-3);
      margin-bottom: var(--space-3);
      cursor: pointer;
      transition: background var(--duration-fast);
    }
    .gps-row:hover { background: rgba(77,114,152,0.12); }
    .gps-row.active {
      border-color: var(--color-blue);
      background: var(--color-blue-light);
    }

    .gps-icon {
      width: 36px; height: 36px; border-radius: var(--border-radius-sm);
      background: var(--color-blue-light);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; font-size: 16px;
    }

    .gps-text { flex: 1; min-width: 0; }
    .gps-name {
      font-size: var(--text-md); font-weight: var(--weight-medium);
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .gps-meta { font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px; }

    .live-badge {
      font-size: 10px; font-weight: var(--weight-bold);
      background: var(--color-green); color: var(--color-green-text);
      padding: 2px 8px; border-radius: var(--border-radius-pill); flex-shrink: 0;
    }
    .pending-badge {
      font-size: 10px; color: var(--color-text-muted); flex-shrink: 0;
    }

    .or-row {
      display: flex; align-items: center; gap: var(--space-3);
      margin: var(--space-1) 0 var(--space-3);
      font-size: var(--text-xs); color: var(--color-text-muted);
    }
    .or-row::before, .or-row::after {
      content: ''; flex: 1; height: 0.5px; background: rgba(0,0,0,0.1);
    }

    .selected-manual {
      display: flex; align-items: center; gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: rgba(208,239,177,0.4);
      border: 1px solid rgba(208,239,177,0.9);
      border-radius: var(--border-radius-md);
      margin-top: var(--space-2);
      font-size: var(--text-sm);
    }
    .selected-manual button {
      margin-left: auto; background: none; border: none;
      font-size: 14px; cursor: pointer; color: var(--color-text-muted); padding: 0;
    }

    .error {
      font-size: var(--text-xs); color: var(--color-danger-text);
      text-align: center; margin-top: var(--space-2);
    }

    .name-input {
        box-sizing: border-box;
        width: 100%; padding: 12px;
        border: 1px solid rgba(0,0,0,0.1); border-radius: var(--border-radius-md);
        font-family: var(--font-sans); font-size: var(--text-md);
        background: var(--color-sheet-bg);
    }
    .name-input:focus { outline: none; border-color: var(--color-blue); box-shadow: 0 0 0 2px rgba(77,114,152,0.1); }
    .name-input { margin-top: var(--space-4); }

    .account-card {
      background: rgba(77,114,152,0.08);
      border: 1px solid rgba(77,114,152,0.22);
      border-radius: var(--border-radius-lg);
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .account-title {
      font-size: var(--text-md);
      font-weight: var(--weight-bold);
      color: var(--color-text-primary);
    }
    .account-subtitle {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      line-height: var(--line-height-base);
    }
    .account-row {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      flex-wrap: wrap;
    }
    .plan-pill {
      font-size: 10px;
      border-radius: var(--border-radius-pill);
      padding: 2px 8px;
      font-weight: var(--weight-bold);
      background: var(--color-blue-light);
      color: var(--color-blue-dark);
    }
    .plan-pill.paid {
      background: var(--color-success-bg);
      color: var(--color-success-text);
    }
    .access-input {
      margin-top: var(--space-1);
    }
  `  ];

  @state() private _gpsName = 'Detecting your location…';
  @state() private _gpsReady = false;
  @state() private _usingGps = true;
  @state() private _manualSelection: GeocodeSuggestion | null = null;
  @state() private _loading = false;
  @state() private _error = '';
  @state() private _name = '';
  @state() private _accessPass = '';
  @state() private _signingIn = false;
  @state() private _membership: 'free' | 'paid' = 'free';
  @state() private _signedIn = false;
  @state() private _displayName = 'Friend';
  @state() private _requiresSignIn = false;
  @state() private _pendingInvites: PendingInvite[] = [];
  @state() private _inviteActionSessionId: string | null = null;
 
  private _unsub?: () => void;
  private _unsubAuth?: () => void;
  private _unsubInviteUpdates?: () => void;
  private _lastGeocodeTime = 0;
  private _lastGeocodePos: Coordinates | null = null;
  private _reverseInFlight = false;

  override connectedCallback() {
    super.connectedCallback();
    locationStore.startWatching();
    this._unsub = locationStore.subscribe(() => this._onLocationUpdate());
    this._unsubAuth = authStore.subscribe(() => this._syncAuthState());
    this._syncAuthState();
    this._onLocationUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsub?.();
    this._unsubAuth?.();
    this._unsubInviteUpdates?.();
  }

  private _syncAuthState() {
    this._membership = authStore.membership;
    this._signedIn = authStore.signedIn;
    this._displayName = authStore.displayName;
    this._requiresSignIn = authStore.requiresSignIn;

    if (this._signedIn) {
      if (!this._unsubInviteUpdates) {
        wsService.connectInviteChannel();
        this._unsubInviteUpdates = wsService.subscribeInviteUpdates(() => {
          void this._loadPendingInvites();
        });
      }
      void this._loadPendingInvites();
      return;
    }

    this._pendingInvites = [];
    if (this._unsubInviteUpdates) {
      this._unsubInviteUpdates();
      this._unsubInviteUpdates = undefined;
    }
    wsService.disconnectInviteChannel();
  }

  private async _handleSignIn() {
    if (!this._accessPass.trim()) {
      uiStore.showToast('Paste your access pass to continue.');
      return;
    }

    this._signingIn = true;
    uiStore.setLoading(true);

    try {
      await authStore.signInWithAccessPass(this._accessPass);
      this._accessPass = '';
      uiStore.showToast('Welcome back. You are signed in.');
    } catch {
      uiStore.showToast('We could not sign you in with that pass. Please check and try again.');
    } finally {
      this._signingIn = false;
      uiStore.setLoading(false);
    }
  }

  private async _handleUpgrade() {
    if (!billingEnabled) {
      uiStore.showToast('Billing is disabled. This app stays in free self-hosted mode.');
      return;
    }

    if (!this._signedIn) {
      uiStore.showToast('Sign in first, then you can upgrade in one tap.');
      return;
    }

    uiStore.setLoading(true);
    try {
      const entitlements = await usersApi.getEntitlements();
      if (entitlements.membership === 'paid') {
        uiStore.showToast('Premium is already active on your account.');
        return;
      }

      const base = window.location.origin;
      const { url } = await usersApi.createCheckout({
        successUrl: `${base}/?billing=success`,
        cancelUrl: `${base}/?billing=cancel`,
      });

      window.location.assign(url);
    } catch {
      uiStore.showToast('We could not start checkout right now. Please try again.');
    } finally {
      uiStore.setLoading(false);
    }
  }

  private async _loadPendingInvites() {
    try {
      const { invites } = await sessionsApi.listPendingInvites();
      this._pendingInvites = invites;
    } catch {
      // Keep UI quiet when backend auth is disabled or endpoint is temporarily unavailable.
      this._pendingInvites = [];
    }
  }

  private async _acceptInvite(invite: PendingInvite) {
    if (this._inviteActionSessionId) return;
    this._inviteActionSessionId = invite.sessionId;
    uiStore.setLoading(true);

    try {
      await sessionsApi.respondToInvite(invite.sessionId, { action: 'accept' });

      if (sessionStore.session) {
        p2pService.disconnect();
        await sessionStore.endSession();
      }

      await sessionStore.joinSession(invite.sessionId);
      await p2pService.connect(invite.sessionId);
      p2pService.send({ type: 'partner:status', status: 'accepted' });

      uiStore.showToast('Invite accepted. Opening coordination.');
      uiStore.goToSelectVenue();
      await this._loadPendingInvites();
    } catch (err: any) {
      console.error('[CreateSession] Accept invite failed:', err);
      uiStore.showToast('Could not accept invite right now.');
    } finally {
      this._inviteActionSessionId = null;
      uiStore.setLoading(false);
    }
  }

  private async _rejectInvite(invite: PendingInvite) {
    if (this._inviteActionSessionId) return;
    this._inviteActionSessionId = invite.sessionId;

    try {
      await sessionsApi.respondToInvite(invite.sessionId, { action: 'reject' });
      uiStore.showToast('Invite declined.');
      await this._loadPendingInvites();
    } catch (err: any) {
      console.error('[CreateSession] Reject invite failed:', err);
      uiStore.showToast('Could not decline invite right now.');
    } finally {
      this._inviteActionSessionId = null;
    }
  }

  private async _onLocationUpdate() {
    const own = locationStore.own;
    if (!own) return;

    this._gpsReady = true;

    this.dispatchEvent(new CustomEvent('map-view:move-to', {
      bubbles: true, composed: true,
      detail: { coords: own, zoom: 15 },
    }));

    // Reverse geocode for a human-readable name
    // Bug 205: Debounce to prevent 429 Rate Limit
    const now = Date.now();
    const distMoved = this._lastGeocodePos ? ( (Math.abs(own.lat - this._lastGeocodePos.lat) + Math.abs(own.lng - this._lastGeocodePos.lng)) * 111000 ) : Infinity;
    
    if (this._reverseInFlight) return;
    if (now - this._lastGeocodeTime < 15000 && distMoved < 80) return;

    try {
      this._reverseInFlight = true;
      // Stamp now so frequent GPS updates don't queue concurrent reverse requests.
      this._lastGeocodeTime = now;
      this._gpsName = await reverseGeocode(own.lat, own.lng);
      this._lastGeocodePos = { ...own };
    } catch {
      this._gpsName = `${own.lat.toFixed(4)}, ${own.lng.toFixed(4)}`;
      this._lastGeocodePos = { ...own };
      this._lastGeocodeTime = Date.now();
    } finally {
      this._reverseInFlight = false;
    }
  }

  private _onLocationSelected(e: CustomEvent<GeocodeSuggestion>) {
    this._manualSelection = e.detail;
    this._usingGps = false;
    this.dispatchEvent(new CustomEvent('map-view:move-to', {
      bubbles: true, composed: true,
      detail: { coords: { lat: e.detail.lat, lng: e.detail.lng }, zoom: 15 },
    }));
  }

  private _useGps() {
    this._usingGps = true;
    this._manualSelection = null;
  }

  private async _handleCreate() {
    const canProceed = (this._usingGps ? this._gpsReady : !!this._manualSelection) && this._name.trim().length >= 2;
    if (!canProceed) {
      this._error = 'We need your location to find a fair meetup spot.';
      return;
    }

    this._loading = true;
    uiStore.setLoading(true);
    this._error = '';

    try {
      if (!this._usingGps && this._manualSelection) {
        locationStore.setOwnLocation({ lat: this._manualSelection.lat, lng: this._manualSelection.lng });
      }

      sessionStore.setOwnName(this._name);

      const peerId = await p2pService.init();
      await sessionStore.createSession(peerId);

      uiStore.goToInvite();
    } catch (err: any) {
      console.error('[CreateSession] Error:', err);
      this._error = err?.message ?? 'Something went wrong. Please try again.';
    } finally {
      this._loading = false;
      uiStore.setLoading(false);
    }
  }

  override render() {
    const canProceed = this._usingGps ? this._gpsReady : !!this._manualSelection;
    const acc = locationStore.accuracy;

    return html`
      <screen-shell screen='create-session'>
      <div class="sheet">
        <div class="handle"></div>
        <div class="title">Start a Rendezvous</div>
        <div class="subtitle">Your location helps us find a fair spot for both of you</div>

        <div class="account-card">
          ${this._signedIn ? html`
            <div class="account-title">Welcome back, ${this._displayName}</div>
            <div class="account-subtitle">
              Your account is ready. Keep your plans and invites in sync across devices.
            </div>
            <div class="account-row">
              <span class="plan-pill ${this._membership === 'paid' ? 'paid' : ''}">
                ${billingEnabled ? (this._membership === 'paid' ? 'Premium active' : 'Free plan') : 'Free self-hosted'}
              </span>
              ${billingEnabled && this._membership !== 'paid' ? html`
                <button class="btn btn-green" style="width:auto; margin:0;" @click=${this._handleUpgrade}>Upgrade now</button>
              ` : ''}
            </div>
          ` : html`
            <div class="account-title">Save your plans and invites</div>
            <div class="account-subtitle">
              Sign in with your access pass to keep everything on your account and upgrade whenever you are ready.
            </div>
            <input
              type="text"
              class="input-base access-input"
              placeholder="Paste your access pass"
              .value=${this._accessPass}
              @input=${(e: Event) => { this._accessPass = (e.target as HTMLInputElement).value; }}
            />
            <div class="account-row">
              <button class="btn btn-primary" style="margin:0;" ?disabled=${this._signingIn} @click=${this._handleSignIn}>
                ${this._signingIn ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
            ${this._requiresSignIn ? html`
              <div class="account-subtitle" style="color: var(--color-warning-text);">
                Sign in is needed to send direct invites.
              </div>
            ` : ''}
          `}
        </div>

        <div class="gps-row ${this._usingGps && this._gpsReady ? 'active' : ''}" @click=${this._useGps}>
          <div class="gps-icon">📍</div>
          <div class="gps-text">
            <div class="gps-name">${this._gpsName}</div>
            <div class="gps-meta">
              ${this._gpsReady
        ? `GPS · ${acc ? `±${Math.round(acc)}m` : 'high accuracy'}`
        : 'Waiting for GPS signal…'}
            </div>
          </div>
          ${this._gpsReady
        ? html`<span class="live-badge">LIVE</span>`
        : html`<span class="pending-badge">…</span>`}
        </div>

        <div class="or-row">or enter address manually</div>

        <location-input
          placeholder="e.g. Nicon Town, Lekki Phase 1"
          @location-selected=${this._onLocationSelected}
        ></location-input>

        <input
          type="text"
          class="input-base name-input"
          placeholder="Your Name (Required)"
          .value=${this._name}
          @input=${(e: any) => { this._name = e.target.value; this._error = ''; }}
          required
          minlength="2"
        />

        ${this._manualSelection && !this._usingGps ? html`
          <div class="selected-manual">
            <span>📍</span>
            <span>${this._manualSelection.shortName}</span>
            <button @click=${this._useGps} title="Clear">✕</button>
          </div>
        ` : ''}

        <button
          class="btn btn-primary"
          ?disabled=${this._loading || !canProceed}
          @click=${this._handleCreate}
        >
          ${this._loading
        ? html`<span>Creating…</span>`
        : html`<span>Create Session</span><span>→</span>`}
        </button>

        ${this._error ? html`<div class="error">${this._error}</div>` : ''}

        ${this._signedIn && this._pendingInvites.length > 0 ? html`
          <div class="or-row">pending invites</div>
          ${this._pendingInvites.map((invite) => {
            const acting = this._inviteActionSessionId === invite.sessionId;
            return html`
              <div class="gps-row" style="margin-bottom: var(--space-2); cursor: default;">
                <div class="gps-icon">📨</div>
                <div class="gps-text">
                  <div class="gps-name">Invite to session ${invite.sessionId.slice(0, 8)}...</div>
                  <div class="gps-meta">From ${invite.inviterUserId.slice(0, 8)}... · ${new Date(invite.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
              <div style="display:flex; gap: var(--space-2); margin-bottom: var(--space-4);">
                <button class="btn btn-primary" style="flex:1;" ?disabled=${acting} @click=${() => this._acceptInvite(invite)}>
                  ${acting ? 'Working...' : 'Accept'}
                </button>
                <button class="btn btn-ghost" style="flex:1;" ?disabled=${acting} @click=${() => this._rejectInvite(invite)}>
                  Decline
                </button>
              </div>
            `;
          })}
        ` : ''}
      </div>
      </screen-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'create-session': CreateSession; }
}