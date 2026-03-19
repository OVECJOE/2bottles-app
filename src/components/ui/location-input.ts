/**
 * <location-input> — text input with live geocoding autocomplete.
 * Uses Nominatim under the hood (no API key).
 * Debounces queries at 400ms, shows a max of 6 suggestions.
 *
 * Dispatches:
 *   location-selected  { displayName, shortName, lat, lng }
 *
 * Properties:
 *   placeholder — input placeholder text
 *   value       — current text value (reflects user input)
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { geocodeAutocomplete, type GeocodeSuggestion } from '../../services/geocoding.service.js';

@customElement('location-input')
export class LocationInput extends LitElement {
  static override styles = css`
    :host { display: block; position: relative; }

    .input-wrap {
      position: relative; display: flex; align-items: center;
    }

    .icon {
      position: absolute; left: var(--space-3);
      font-size: 14px; color: var(--color-text-muted);
      pointer-events: none; z-index: 1;
    }

    .spinner {
      position: absolute; right: var(--space-3);
      width: 14px; height: 14px;
      border: 2px solid rgba(0,0,0,0.1);
      border-top-color: var(--color-blue);
      border-radius: 50%;
      animation: spin 600ms linear infinite;
    }

    input {
      width: 100%;
      padding: var(--space-3) var(--space-3) var(--space-3) 36px;
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--border-radius-md);
      font-family: var(--font-sans);
      font-size: var(--text-md);
      color: var(--color-text-primary);
      background: rgba(0,0,0,0.03);
      outline: none;
      transition: border-color var(--duration-fast);
    }
    input:focus { border-color: var(--color-blue); background: #fff; }
    input::placeholder { color: var(--color-text-muted); }

    .dropdown {
      position: absolute;
      bottom: calc(10 * var(--space-2));
      left: 0; right: 0;
      background: rgba(255,255,255,0.98);
      border: 1px solid rgba(0,0,0,0.1);
      border-radius: var(--border-radius-md);
      box-shadow: var(--shadow-lg);
      z-index: var(--z-modal);
      overflow: hidden;
      animation: slide-down var(--duration-fast) var(--ease-out) both;
    }

    .suggestion {
      display: flex; align-items: flex-start; gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      cursor: pointer;
      transition: background var(--duration-fast);
      border-bottom: var(--border-width) solid var(--border-color);
    }
    .suggestion:last-child { border-bottom: none; }
    .suggestion:hover { background: var(--color-blue-light); }
    .suggestion:active { background: rgba(77,114,152,0.15); }

    .sugg-icon {
      width: 28px; height: 28px; border-radius: var(--border-radius-sm);
      background: var(--color-blue-light);
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; flex-shrink: 0; margin-top: 1px;
      color: var(--color-blue);
    }

    .sugg-text { flex: 1; min-width: 0; }
    .sugg-short {
      font-size: var(--text-sm); font-weight: var(--weight-medium);
      color: var(--color-text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .sugg-full {
      font-size: var(--text-xs); color: var(--color-text-muted); margin-top: 1px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .suggestion.selected { background: var(--color-blue-light); }

    .empty {
      padding: var(--space-4) var(--space-4);
      font-size: var(--text-sm); color: var(--color-text-muted); text-align: center;
    }

    .loading-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-4);
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .loading-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--color-blue);
      animation: dot-blink 1.2s infinite ease-in-out;
    }

    .loading-dot:nth-child(2) { animation-delay: 0.15s; }
    .loading-dot:nth-child(3) { animation-delay: 0.3s; }

    @keyframes dot-blink {
      0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
      40% { opacity: 1; transform: scale(1); }
    }

    .scope-row {
      display: flex;
      gap: var(--space-2);
      margin-top: var(--space-2);
    }

    .scope-btn {
      border: 1px solid rgba(0,0,0,0.12);
      background: #fff;
      color: var(--color-text-primary);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: var(--text-xs);
      cursor: pointer;
      transition: all var(--duration-fast);
    }

    .scope-btn.active {
      border-color: var(--color-blue);
      background: var(--color-blue-light);
      color: var(--color-blue);
      font-weight: var(--weight-medium);
    }
  `;

  @property() country?: string;
  @property() placeholder = 'Search for a place…';
  @property() value = '';
  @property({ type: Boolean }) showScopeToggle = true;

  @state() private _suggestions: GeocodeSuggestion[] = [];
  @state() private _loading = false;
  @state() private _open = false;
  @state() private _selectedIndex = -1;
  @state() private _scope: 'nearby' | 'global' = 'nearby';
  @state() private _nearbyCenter: { lat: number; lng: number } | null = null;

  private _debounceTimer: any = null;
  private _blurTimer: ReturnType<typeof setTimeout> | null = null;
  private _requestSeq = 0;
  private _lastQuery = '';

  override disconnectedCallback() {
    super.disconnectedCallback();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._blurTimer) {
      clearTimeout(this._blurTimer);
      this._blurTimer = null;
    }
  }

  private async _onInput(e: InputEvent) {
    const val = (e.target as HTMLInputElement).value;
    this.value = val;
    this._selectedIndex = -1;

    await this._search(val);
  }

  private async _search(val: string) {
    if (!val.trim() || val.trim().length < 3) {
      this._suggestions = [];
      this._loading = false;
      this._open = false;
      return;
    }

    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._loading = true;
    this._open = true;
    const reqId = ++this._requestSeq;

    this._debounceTimer = setTimeout(async () => {
        this._lastQuery = val;

        try {
            if (this._scope === 'nearby' && !this._nearbyCenter) {
              this._nearbyCenter = await this._resolveNearbyCenter();
            }

            const results = await geocodeAutocomplete(val, {
                immediate: true,
                countrycodes: this.country,
                biasCenter: this._scope === 'nearby' ? this._nearbyCenter ?? undefined : undefined,
                biasRadiusKm: this._scope === 'nearby' ? 30 : undefined,
            });
            // Bug 39: Race condition check
            if (this._lastQuery === val && this._requestSeq === reqId) {
                this._suggestions = results;
            }
        } catch {
            if (this._lastQuery === val && this._requestSeq === reqId) this._suggestions = [];
        } finally {
            if (this._lastQuery === val && this._requestSeq === reqId) this._loading = false;
        }
    }, 400);
  }

  private async _resolveNearbyCenter(): Promise<{ lat: number; lng: number } | null> {
    if (!navigator.geolocation || !window.isSecureContext) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 }
      );
    });
  }

  private async _setScope(scope: 'nearby' | 'global') {
    this._scope = scope;
    if (scope === 'nearby' && !this._nearbyCenter) {
      this._nearbyCenter = await this._resolveNearbyCenter();
    }
    // Re-run query in the new scope if user already typed text.
    const current = this.value.trim();
    if (current.length >= 2) await this._search(current);
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this._open = false;
      return;
    }

    if (this._open && this._suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._selectedIndex = (this._selectedIndex + 1) % this._suggestions.length;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._selectedIndex = (this._selectedIndex - 1 + this._suggestions.length) % this._suggestions.length;
      } else if (e.key === 'Enter' && this._selectedIndex !== -1) {
        e.preventDefault();
        this._select(this._suggestions[this._selectedIndex]);
      }
    }
  }

  private _select(s: GeocodeSuggestion) {
    this.value = s.shortName;
    this._open = false;
    this._suggestions = [];

    this.dispatchEvent(new CustomEvent('location-selected', {
      bubbles: true, composed: true,
      detail: { displayName: s.displayName, shortName: s.shortName, lat: s.lat, lng: s.lng },
    }));
  }

  private _onBlur() {
    // Small delay so clicks on suggestions register before blur closes dropdown
    if (this._blurTimer) clearTimeout(this._blurTimer);
    this._blurTimer = setTimeout(() => {
      this._open = false;
      this._blurTimer = null;
    }, 180);
  }

  private _typeIcon(type: string): string {
    if (type === 'restaurant' || type === 'cafe' || type === 'bar') return '🍽';
    if (type === 'hotel' || type === 'hostel') return '🏨';
    if (type === 'park' || type === 'garden') return '🌳';
    if (type === 'mall' || type === 'supermarket') return '🛍';
    if (type === 'cinema' || type === 'theatre') return '🎬';
    if (type === 'hospital' || type === 'clinic') return '🏥';
    return '📍';
  }

  override render() {
    return html`
      <div class="input-wrap">
        <span class="icon">📍</span>
        <input
          type="text"
          .value=${this.value}
          role="combobox"
          aria-expanded=${this._open ? 'true' : 'false'}
          aria-controls="location-suggestions"
          aria-autocomplete="list"
          aria-label=${this.placeholder}
          placeholder=${this.placeholder}
          autocomplete="off"
          spellcheck="false"
          @input=${this._onInput}
          @blur=${this._onBlur}
          @keydown=${this._onKeyDown}
        />
        ${this._loading ? html`<div class="spinner"></div>` : ''}
      </div>

      ${this.showScopeToggle ? html`
        <div class="scope-row" aria-label="Search scope">
          <button
            type="button"
            class="scope-btn ${this._scope === 'nearby' ? 'active' : ''}"
            @click=${() => this._setScope('nearby')}
          >Nearby</button>
          <button
            type="button"
            class="scope-btn ${this._scope === 'global' ? 'active' : ''}"
            @click=${() => this._setScope('global')}
          >Global</button>
        </div>
      ` : ''}

      ${this._open ? html`
        <div class="dropdown" id="location-suggestions" role="listbox" aria-label="Location suggestions">
          ${this._suggestions.length > 0 ? this._suggestions.map((s, i) => html`
            <div
                class="suggestion ${this._selectedIndex === i ? 'selected' : ''}"
          role="option"
          aria-selected=${this._selectedIndex === i ? 'true' : 'false'}
                @mousedown=${() => this._select(s)}
                @mouseenter=${() => { this._selectedIndex = i; }}
            >
              <div class="sugg-icon">${this._typeIcon(s.type)}</div>
              <div class="sugg-text">
                <div class="sugg-short">${s.shortName}</div>
                <div class="sugg-full">${s.displayName}</div>
              </div>
            </div>
          `) : this._loading ? html`
            <div class="loading-row" aria-live="polite">
              <span>Searching</span>
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
            </div>
          ` : html`
            <div class="empty">No results found</div>
          `}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'location-input': LocationInput; }
}