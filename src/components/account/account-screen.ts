import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authStore, uiStore } from '../../store/index.js';
import { billingEnabled, usersApi } from '../../api/users.api.js';
import { sharedStyles } from '../../styles/shared-styles.js';
import '../../components/ui/screen-shell.js';

@customElement('account-screen')
export class AccountScreen extends LitElement {
  static override styles = [
    sharedStyles,
    css`
      :host { display: block; }

      .sheet {
        gap: var(--space-3);
      }

      .card {
        border-radius: var(--border-radius-lg);
        border: 1px solid rgba(77, 114, 152, 0.2);
        background: rgba(77, 114, 152, 0.08);
        padding: var(--space-4);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .card-title {
        font-size: var(--text-lg);
        font-weight: var(--weight-bold);
        color: var(--color-text-primary);
      }

      .card-subtitle {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }

      .plan-pill {
        width: fit-content;
        border-radius: var(--border-radius-pill);
        padding: 2px 10px;
        font-size: 10px;
        font-weight: var(--weight-bold);
        background: var(--color-blue-light);
        color: var(--color-blue-dark);
      }

      .plan-pill.paid {
        background: var(--color-success-bg);
        color: var(--color-success-text);
      }

      .meta {
        font-size: var(--text-xs);
        color: var(--color-text-muted);
      }

      .access-input {
        margin-top: var(--space-1);
      }
    `,
  ];

  @state() private _signedIn = false;
  @state() private _displayName = 'Friend';
  @state() private _membership: 'free' | 'paid' = 'free';
  @state() private _maxParticipants = 2;
  @state() private _requiresSignIn = false;
  @state() private _accessPass = '';
  @state() private _working = false;

  private _unsubAuth?: () => void;

  override connectedCallback() {
    super.connectedCallback();
    this._unsubAuth = authStore.subscribe(() => this._sync());
    this._sync();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubAuth?.();
  }

  private _sync() {
    this._signedIn = authStore.signedIn;
    this._displayName = authStore.displayName;
    this._membership = authStore.membership;
    this._maxParticipants = authStore.maxParticipants;
    this._requiresSignIn = authStore.requiresSignIn;
  }

  private async _signIn() {
    if (!this._accessPass.trim()) {
      uiStore.showToast('Paste your access pass to sign in.');
      return;
    }

    this._working = true;
    uiStore.setLoading(true);
    try {
      await authStore.signInWithAccessPass(this._accessPass);
      this._accessPass = '';
      uiStore.showToast('You are signed in.');
    } catch {
      uiStore.showToast('That access pass did not work. Please try again.');
    } finally {
      this._working = false;
      uiStore.setLoading(false);
    }
  }

  private _signOut() {
    authStore.signOut();
    uiStore.showToast('Signed out.');
  }

  private async _upgrade() {
    if (!billingEnabled) {
      uiStore.showToast('Billing is disabled. This app is running in free self-hosted mode.');
      return;
    }

    if (!this._signedIn) {
      uiStore.showToast('Sign in first, then upgrade in one tap.');
      return;
    }

    uiStore.setLoading(true);
    try {
      const entitlements = await usersApi.getEntitlements();
      if (entitlements.membership === 'paid') {
        uiStore.showToast('Premium is already active.');
        return;
      }

      const base = window.location.origin;
      const { url } = await usersApi.createCheckout({
        successUrl: `${base}/?billing=success`,
        cancelUrl: `${base}/?billing=cancel`,
      });
      window.location.assign(url);
    } catch {
      uiStore.showToast('Checkout is unavailable right now. Please try again.');
    } finally {
      uiStore.setLoading(false);
    }
  }

  override render() {
    return html`
      <screen-shell screen="account">
        <div class="sheet">
          <div class="handle"></div>
          <div class="title">Your Account</div>
          <div class="subtitle">Manage sign-in and your plan in one place.</div>

          <div class="card">
            ${this._signedIn ? html`
              <div class="card-title">Hi ${this._displayName}</div>
              <div class="plan-pill ${this._membership === 'paid' ? 'paid' : ''}">
                ${billingEnabled ? (this._membership === 'paid' ? 'Premium active' : 'Free plan') : 'Free self-hosted'}
              </div>
              <div class="meta">
                Meetup size limit: up to ${this._maxParticipants} ${this._maxParticipants === 1 ? 'person' : 'people'}.
              </div>
              <div class="card-subtitle">
                ${!billingEnabled
                  ? 'No billing provider is connected. You can keep running this app in free self-hosted mode.'
                  : this._membership === 'paid'
                  ? 'You are on Premium. Enjoy bigger group plans and priority access.'
                  : 'Upgrade to Premium for larger group meetups and a faster planning flow.'}
              </div>
              ${billingEnabled && this._membership !== 'paid' ? html`
                <button class="btn btn-green" @click=${this._upgrade}>Upgrade to Premium</button>
              ` : ''}
              <button class="btn btn-outline" @click=${this._signOut}>Sign out</button>
            ` : html`
              <div class="card-title">Sign in to save your plans</div>
              <div class="card-subtitle">
                Paste your access pass to keep invites, plans, and membership tied to your account.
              </div>
              <input
                type="text"
                class="input-base access-input"
                placeholder="Paste your access pass"
                .value=${this._accessPass}
                @input=${(e: Event) => { this._accessPass = (e.target as HTMLInputElement).value; }}
              />
              <button class="btn btn-primary" ?disabled=${this._working} @click=${this._signIn}>
                ${this._working ? 'Signing in...' : 'Sign in'}
              </button>
              ${this._requiresSignIn ? html`
                <div class="meta" style="color: var(--color-warning-text);">
                  Sign in is needed to send direct invites.
                </div>
              ` : ''}
            `}
          </div>

          <button class="btn btn-ghost" @click=${() => uiStore.goHome()}>Back to Home</button>
        </div>
      </screen-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'account-screen': AccountScreen;
  }
}
