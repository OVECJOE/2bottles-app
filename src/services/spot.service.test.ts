import { describe, expect, it, vi } from 'vitest';
import { createSpot, submitSpotRating, suggestSpots, uploadSpotMedia } from './spot.service.js';

describe('spot service API contracts', () => {
    it('creates a spot via POST /spot and returns spot id', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ spotId: 'spot-1' }), {
                status: 201,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        const created = await createSpot({
            venueName: 'Museum Cafe',
            category: 'cafe',
            reason: 'quiet meetup',
            coordinates: { lat: 6.5, lng: 3.3 },
        });

        expect(created.spotId).toBe('spot-1');
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/spot'), expect.any(Object));
    });

    it('submits rating and returns backend aggregates', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({ ok: true, averageRating: 4.7, ratingsCount: 12 }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        const rated = await submitSpotRating('spot-1', {
            rating: 5,
            comment: 'Excellent place',
        });

        expect(rated.ok).toBe(true);
        expect(rated.averageRating).toBe(4.7);
        expect(rated.ratingsCount).toBe(12);
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/spot/spot-1/rating'), expect.any(Object));
    });

    it('uploads media through POST /spot/media with progress tracking', async () => {
        class FakeUploadTarget {
            onprogress: ((event: ProgressEvent<EventTarget>) => void) | null = null;
        }

        class FakeXhr {
            status = 201;
            responseText = JSON.stringify({
                url: 'https://cdn.example.com/spot/image.jpg',
                completedAt: '2026-04-04T00:00:00.000Z',
                type: 'image',
            });
            upload = new FakeUploadTarget();
            onerror: (() => void) | null = null;
            onload: (() => void) | null = null;
            method = '';
            url = '';

            open(method: string, url: string) {
                this.method = method;
                this.url = url;
            }

            send(_formData: FormData) {
                if (this.upload.onprogress) {
                    this.upload.onprogress({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent<EventTarget>);
                    this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 } as ProgressEvent<EventTarget>);
                }
                if (this.onload) this.onload();
            }
        }

        const originalXhr = globalThis.XMLHttpRequest;
        Object.defineProperty(globalThis, 'XMLHttpRequest', {
            configurable: true,
            value: FakeXhr,
        });

        const progress: number[] = [];
        const file = new File(['abc'], 'pic.png', { type: 'image/png' });
        const uploaded = await uploadSpotMedia('spot-1', file, 'sunset', (pct) => {
            progress.push(pct);
        });

        Object.defineProperty(globalThis, 'XMLHttpRequest', {
            configurable: true,
            value: originalXhr,
        });

        expect(uploaded.url).toBe('https://cdn.example.com/spot/image.jpg');
        expect(uploaded.type).toBe('image');
        expect(progress[0]).toBe(50);
        expect(progress[progress.length - 1]).toBe(100);
    });

    it('fetches spot suggestions from GET /spot with query params', async () => {
        const fetchSpy = vi.fn(async () =>
            new Response(JSON.stringify({
                spots: [
                    {
                        id: 's1',
                        name: 'River Park',
                        address: 'Main Ave',
                        category: 'park',
                        score: 0.92,
                        coordinates: { lat: 6.52, lng: 3.37 },
                        averageRating: 4.5,
                        ratingsCount: 27,
                    },
                ],
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        vi.stubGlobal('fetch', fetchSpy);

        const spots = await suggestSpots({
            lat: 6.52,
            lng: 3.37,
            partnerLat: 6.6,
            partnerLng: 3.42,
            limit: 5,
            categories: ['park'],
            includeUserSaved: true,
        });

        expect(spots).toHaveLength(1);
        expect(spots[0].id).toBe('s1');
        expect(spots[0].score).toBe(0.92);

        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/spot?'), expect.any(Object));
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('lat=6.52'), expect.any(Object));
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('category=park'), expect.any(Object));
    });
});
