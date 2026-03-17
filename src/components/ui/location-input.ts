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
      bottom: calc(3 * var(--space-4));
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
  `;

  @property() country?: string;
  @property() placeholder = 'Search for a place…';
  @property() value = '';

  @state() private _suggestions: GeocodeSuggestion[] = [];
  @state() private _loading = false;
  @state() private _open = false;
  @state() private _selectedIndex = -1;

  private _debounceTimer: any = null;
  private _lastQuery = '';

  private async _onInput(e: InputEvent) {
    const val = (e.target as HTMLInputElement).value;
    this.value = val;
    this._selectedIndex = -1;

    if (!val.trim() || val.trim().length < 3) {
      this._suggestions = [];
      this._open = false;
      return;
    }

    if (this._debounceTimer) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(async () => {
        this._lastQuery = val;
        this._loading = true;
        this._open = true;

        try {
            const results = await geocodeAutocomplete(val, {
                immediate: true,
                countrycodes: this.country
            });
            // Bug 39: Race condition check
            if (this._lastQuery === val) {
                this._suggestions = results;
            }
        } catch {
            if (this._lastQuery === val) this._suggestions = [];
        } finally {
            if (this._lastQuery === val) this._loading = false;
        }
    }, 400);
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
    setTimeout(() => { this._open = false; }, 180);
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
          placeholder=${this.placeholder}
          autocomplete="off"
          spellcheck="false"
          @input=${this._onInput}
          @blur=${this._onBlur}
          @keydown=${this._onKeyDown}
        />
        ${this._loading ? html`<div class="spinner"></div>` : ''}
      </div>

      ${this._open ? html`
        <div class="dropdown">
          ${this._suggestions.length > 0 ? this._suggestions.map((s, i) => html`
            <div
                class="suggestion ${this._selectedIndex === i ? 'selected' : ''}"
                @mousedown=${() => this._select(s)}
                @mouseenter=${() => { this._selectedIndex = i; }}
            >
              <div class="sugg-icon">${this._typeIcon(s.type)}</div>
              <div class="sugg-text">
                <div class="sugg-short">${s.shortName}</div>
                <div class="sugg-full">${s.displayName}</div>
              </div>
            </div>
          `) : !this._loading ? html`
            <div class="empty">No results found</div>
          ` : ''}
        </div>
      ` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap { 'location-input': LocationInput; }
}