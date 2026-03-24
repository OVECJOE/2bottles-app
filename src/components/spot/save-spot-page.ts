import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Router } from '@vaadin/router';

import { sessionStore, uiStore } from '../../store/index.js';
import { createSpot, submitSpotRating, uploadSpotMedia, type SpotUploadResult } from '../../services/spot.service.js';
import '../ui/screen-shell.js';
import '../ui/bottom-sheet.js';

type MediaItem = {
  id: string;
  file: File;
  previewUrl: string;
  description: string;
  progress: number;
  status: 'queued' | 'uploading' | 'done' | 'error';
};

@customElement('save-spot-page')
export class SaveSpotPage extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }

    bottom-sheet::part(sheet) {
      max-height: calc(100dvh - var(--map-status-bar-height) - var(--space-8));
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .sheet-content {
      width: 100%;
      margin: 0 auto;
      padding-bottom: var(--space-3);
    }

    .content {
      display: grid;
      gap: var(--space-3);
    }

    .head {
      display: grid;
      gap: var(--space-1);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--border-radius-xl);
      background: linear-gradient(145deg, var(--color-surface) 0%, var(--color-surface-soft) 100%);
      padding: var(--space-4);
    }

    .eyebrow {
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      letter-spacing: 0.5px;
      color: var(--color-action-strong);
      text-transform: uppercase;
    }

    .title {
      margin: 0;
      font-size: var(--text-2xl);
      font-weight: var(--weight-bold);
    }

    .sub {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
    }

    .venue-meta {
      margin-top: var(--space-2);
      width: max-content;
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-pill);
      padding: 5px 10px;
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      background: var(--color-surface);
    }

    .card {
      border: 1px solid var(--color-border-strong);
      border-radius: var(--border-radius-lg);
      background: linear-gradient(150deg, var(--color-surface) 0%, var(--color-surface-muted) 100%);
      padding: var(--space-4);
      display: grid;
      gap: var(--space-3);
    }

    .card h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--weight-bold);
      line-height: var(--line-height-tight);
    }

    .hint {
      margin: 0;
      font-size: var(--text-xs);
      color: var(--color-text-muted);
    }

    .hint.strong {
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .chip {
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-pill);
      background: var(--color-surface-muted);
      color: var(--color-text-primary);
      font-size: var(--text-xs);
      font-weight: var(--weight-medium);
      padding: 8px 12px;
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out);
    }

    .chip:hover {
      transform: translateY(-1px);
      border-color: var(--color-border-strong);
    }

    .chip.active {
      border-color: var(--color-blue-mid);
      background: var(--color-blue-light);
      color: var(--color-blue-dark);
    }

    .rating-row {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      flex-wrap: wrap;
    }

    .star {
      width: 42px;
      height: 42px;
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      background: var(--color-surface);
      color: var(--color-text-muted);
      font-size: 22px;
      cursor: pointer;
      line-height: 1;
      transition: transform var(--duration-fast) var(--ease-spring), border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
    }

    .star:hover {
      transform: translateY(-1px);
    }

    .star.active {
      border-color: var(--accent-amber-500);
      color: var(--accent-amber-500);
      background: var(--color-warning-bg);
    }

    .rating-summary {
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      min-height: 18px;
    }

    textarea,
    .input {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      background: var(--color-surface);
      color: var(--color-text-primary);
      padding: 11px 12px;
      font-family: var(--font-sans);
      font-size: var(--text-sm);
      transition: border-color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
    }

    textarea:focus,
    .input:focus {
      outline: none;
      border-color: var(--color-blue-mid);
      background: var(--color-surface);
    }

    textarea {
      resize: none;
      min-height: 96px;
    }

    .upload {
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--border-radius-md);
      padding: var(--space-3);
      display: grid;
      gap: var(--space-2);
      background: var(--color-surface-muted);
    }

    .file-trigger {
      width: max-content;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--border-radius-pill);
      padding: 8px 12px;
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      color: var(--color-blue-dark);
      background: var(--color-surface);
      cursor: pointer;
      transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
    }

    .file-trigger:hover {
      background: var(--color-blue-light);
      border-color: var(--color-blue-mid);
    }

    .file-input {
      display: none;
    }

    .media-list {
      display: grid;
      gap: var(--space-2);
    }

    .media-item {
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      padding: var(--space-2);
      display: grid;
      grid-template-columns: 84px 1fr;
      gap: var(--space-2);
      align-items: start;
      background: var(--color-surface);
    }

    .thumb {
      width: 84px;
      height: 84px;
      border-radius: var(--border-radius-sm);
      object-fit: cover;
      background: var(--color-surface-soft);
    }

    .meta {
      display: grid;
      gap: var(--space-1);
    }

    .file-name {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      word-break: break-all;
    }

    .media-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--space-2);
    }

    .status-pill {
      font-size: 10px;
      font-weight: var(--weight-bold);
      border-radius: var(--border-radius-pill);
      padding: 4px 8px;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      background: var(--color-surface-muted);
    }

    .status-pill.done {
      color: var(--color-success-text);
      border-color: var(--color-success-strong);
      background: var(--color-success-bg);
    }

    .status-pill.error {
      color: var(--color-danger-text);
      border-color: var(--color-danger-text);
      background: var(--color-danger-bg);
    }

    .remove-btn {
      border: none;
      background: transparent;
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      font-weight: var(--weight-bold);
      cursor: pointer;
      padding: 0;
    }

    .remove-btn:hover {
      color: var(--color-danger-text);
    }

    .bar {
      height: 8px;
      border-radius: var(--border-radius-pill);
      background: var(--color-surface-soft);
      overflow: hidden;
    }

    .bar > span {
      display: block;
      height: 100%;
      width: var(--progress, 0%);
      background: var(--color-blue);
      transition: width var(--duration-fast) var(--ease-out);
    }

    .actions {
      position: sticky;
      bottom: 0;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0), var(--color-sheet-bg) 28%);
      border-top: 1px solid var(--glass-border);
      backdrop-filter: blur(10px) saturate(130%);
      -webkit-backdrop-filter: blur(10px) saturate(130%);
      padding-top: var(--space-4);
      display: flex;
      gap: var(--space-2);
    }

    .btn {
      flex: 1;
      border: none;
      border-radius: var(--border-radius-md);
      padding: 12px 14px;
      font-size: var(--text-md);
      font-weight: var(--weight-bold);
      font-family: var(--font-sans);
      cursor: pointer;
      transition: transform var(--duration-fast) var(--ease-spring), opacity var(--duration-fast) var(--ease-out);
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn.secondary {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      color: var(--color-text-primary);
    }

    .btn.primary {
      background: linear-gradient(125deg, var(--color-blue-dark), var(--color-blue-mid));
      color: var(--color-blue-text);
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .star:focus-visible,
    .chip:focus-visible,
    .btn:focus-visible,
    .remove-btn:focus-visible,
    .file-trigger:focus-visible {
      outline: 2px solid var(--color-blue-mid);
      outline-offset: 2px;
    }

    @media (max-width: 720px) {
      .sheet-content {
        width: 100%;
      }

      .media-item {
        grid-template-columns: 1fr;
      }

      .thumb {
        width: 100%;
        height: 160px;
      }
    }
  `;

  @state() private _rating = 0;
  @state() private _reason = '';
  @state() private _comment = '';
  @state() private _media: MediaItem[] = [];
  @state() private _saving = false;
  @state() private _sheetOpen = true;

  private _unsubUI?: () => void;

  private _reasons = [
    'Great ambience',
    'Perfect midpoint',
    'Friendly staff',
    'Good for meetings',
    'Quiet and comfy',
  ];

  private static readonly MAX_MEDIA_FILES = 6;

  override connectedCallback() {
    super.connectedCallback();
    uiStore.openSheet();
    this._sheetOpen = uiStore.sheetOpen;
    this._unsubUI = uiStore.subscribe(() => {
      this._sheetOpen = uiStore.sheetOpen;
      this.requestUpdate();
    });

    if (!sessionStore.selectedVenue) {
      uiStore.showToast('No selected venue to save yet.');
      Router.go('/create-session');
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubUI?.();
  }

  private _onFilesPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const remaining = Math.max(0, SaveSpotPage.MAX_MEDIA_FILES - this._media.length);
    const accepted = files.slice(0, remaining);

    if (!accepted.length) {
      uiStore.showToast(`You can add up to ${SaveSpotPage.MAX_MEDIA_FILES} files.`);
      input.value = '';
      return;
    }

    if (accepted.length < files.length) {
      uiStore.showToast(`Only ${SaveSpotPage.MAX_MEDIA_FILES} files are allowed.`);
    }

    const items = accepted.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      description: '',
      progress: 0,
      status: 'queued' as const,
    }));

    this._media = [...this._media, ...items];
    input.value = '';
  }

  private _setMediaDescription(id: string, value: string) {
    this._media = this._media.map((m) => (m.id === id ? { ...m, description: value } : m));
  }

  private _removeMedia(id: string) {
    const item = this._media.find((m) => m.id === id);
    if (item) URL.revokeObjectURL(item.previewUrl);
    this._media = this._media.filter((m) => m.id !== id);
  }

  private _setMediaProgress(id: string, progress: number, status?: MediaItem['status']) {
    this._media = this._media.map((m) => {
      if (m.id !== id) return m;
      return {
        ...m,
        progress,
        status: status ?? m.status,
      };
    });
  }

  private async _submit() {
    if (this._rating < 1 || this._saving) return;

    const venue = sessionStore.selectedVenue;
    if (!venue) {
      uiStore.showToast('No venue selected to save.');
      Router.go('/create-session');
      return;
    }

    this._saving = true;

    try {
      const created = await createSpot({
        venueName: venue.name,
        venueAddress: venue.address,
        category: venue.category,
        coordinates: venue.coordinates,
        reason: this._reason || undefined,
      });

      await submitSpotRating(created.spotId, {
        rating: this._rating,
        comment: this._comment.trim() || undefined,
      });

      const uploads: SpotUploadResult[] = [];
      for (const media of this._media) {
        this._setMediaProgress(media.id, 1, 'uploading');
        try {
          const upload = await uploadSpotMedia(
            created.spotId,
            media.file,
            media.description,
            (progress) => this._setMediaProgress(media.id, progress, 'uploading'),
          );
          uploads.push(upload);
          this._setMediaProgress(media.id, 100, 'done');
        } catch {
          this._setMediaProgress(media.id, media.progress, 'error');
        }
      }

      uiStore.showToast(`Spot saved${uploads.length ? ` with ${uploads.length} upload${uploads.length > 1 ? 's' : ''}` : ''}.`);
      Router.go('/ended');
    } catch (error) {
      console.error('[SaveSpotPage] save failed:', error);
      uiStore.showToast('Unable to save spot right now. Please try again.');
    } finally {
      this._saving = false;
    }
  }

  private _cancel() {
    Router.go('/ended');
  }

  private _ratingLabel(): string {
    switch (this._rating) {
      case 1: return 'Poor experience';
      case 2: return 'Below expectations';
      case 3: return 'Average experience';
      case 4: return 'Great spot';
      case 5: return 'Excellent, would revisit';
      default: return 'Tap a star to rate this place';
    }
  }

  override render() {
    const venue = sessionStore.selectedVenue;
    if (!venue) return html``;

    return html`
      <screen-shell screen="end-session">
        <bottom-sheet ?open=${this._sheetOpen} @sheet-dismiss=${() => uiStore.closeSheet()}>
          <div class="sheet-content">
            <div class="content">
            <section class="head">
              <span class="eyebrow">Save This Spot</span>
              <h1 class="title">${venue.name}</h1>
              <p class="sub">${venue.address}</p>
              <span class="venue-meta">Your feedback builds better recommendations</span>
            </section>

            <section class="card">
              <h3>Rate this spot (required)</h3>
              <p class="hint strong">How was your experience here?</p>
              <div class="rating-row" role="radiogroup" aria-label="Spot rating">
                ${[1, 2, 3, 4, 5].map((val) => html`
                  <button
                    type="button"
                    class="star ${this._rating >= val ? 'active' : ''}"
                    @click=${() => { this._rating = val; }}
                    aria-label=${`Rate ${val} out of 5`}
                  >★</button>
                `)}
              </div>
              <p class="rating-summary">${this._ratingLabel()}</p>
            </section>

            <section class="card">
              <h3>Why save this spot? (optional)</h3>
              <p class="hint strong">Choose what stood out for you.</p>
              <div class="chips">
                ${this._reasons.map((reason) => html`
                  <button type="button" class="chip ${this._reason === reason ? 'active' : ''}" @click=${() => { this._reason = this._reason === reason ? '' : reason; }}>
                    ${reason}
                  </button>
                `)}
              </div>
              <textarea
                .value=${this._comment}
                @input=${(e: InputEvent) => { this._comment = (e.target as HTMLTextAreaElement).value; }}
                placeholder="Optional notes about your experience at this place"
              ></textarea>
            </section>

            <section class="card">
              <h3>Add photos or videos (optional)</h3>
              <div class="upload">
                <label class="file-trigger">
                  Add media
                  <input class="file-input" type="file" accept="image/*,video/*" multiple @change=${this._onFilesPicked} />
                </label>
                <p class="hint">Uploads will be attached to this saved spot. Up to ${SaveSpotPage.MAX_MEDIA_FILES} files.</p>
              </div>

              ${this._media.length ? html`
                <div class="media-list">
                  ${this._media.map((m) => html`
                    <div class="media-item">
                      ${m.file.type.startsWith('video/') ? html`
                        <video class="thumb" src=${m.previewUrl} muted playsinline></video>
                      ` : html`
                        <img class="thumb" src=${m.previewUrl} alt="Spot media preview" />
                      `}
                      <div class="meta">
                        <div class="file-name">${m.file.name}</div>
                        <input
                          class="input"
                          .value=${m.description}
                          @input=${(e: InputEvent) => this._setMediaDescription(m.id, (e.target as HTMLInputElement).value)}
                          placeholder="Optional description"
                        />
                        <div class="bar" style=${`--progress:${m.progress}%`}><span></span></div>
                        <div class="media-actions">
                          <span class="status-pill ${m.status === 'done' ? 'done' : m.status === 'error' ? 'error' : ''}">
                            ${m.status === 'done' ? 'Uploaded' : m.status === 'uploading' ? `Uploading ${m.progress}%` : m.status === 'error' ? 'Upload failed' : 'Queued'}
                          </span>
                          <button type="button" class="remove-btn" @click=${() => this._removeMedia(m.id)}>Remove</button>
                        </div>
                      </div>
                    </div>
                  `)}
                </div>
              ` : ''}
            </section>

            <div class="actions">
              <button class="btn secondary" @click=${this._cancel} ?disabled=${this._saving}>Back</button>
              <button class="btn primary" @click=${this._submit} ?disabled=${this._saving || this._rating < 1}>
                ${this._saving ? 'Saving...' : 'Save Spot'}
              </button>
            </div>
            </div>
          </div>
        </bottom-sheet>
      </screen-shell>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'save-spot-page': SaveSpotPage;
  }
}
