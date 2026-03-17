const NOMINATIM_ENDPOINT = (import.meta.env.VITE_NOMINATIM_ENDPOINT as string | undefined) || 'https://nominatim.openstreetmap.org';
const NOMINATIM_MIN_INTERVAL_MS = Number(import.meta.env.VITE_NOMINATIM_MIN_INTERVAL_MS ?? 1200);
const NOMINATIM_CACHE_TTL_MS = 2 * 60 * 1000;
const REVERSE_CACHE_TTL_MS = 5 * 60 * 1000;
const VENUE_QUERY_COOLDOWN_MS = 60 * 1000;
const NOMINATIM_HARD_COOLDOWN_MS = 3 * 60 * 1000;

import type { Venue } from '../types/venue.types.js';
import type { Coordinates } from '../types/location.types.js';

export interface GeocodeSuggestion {
    placeId: string;
    displayName: string;
    shortName: string;
    lat: number;
    lng: number;
    type: string;
}

export interface MeetupSuggestionInput {
    own: Coordinates;
    partner: Coordinates;
    midpoint: Coordinates;
    maxResults?: number;
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _nextNominatimAt = 0;
let _nominatimQueue: Promise<unknown> = Promise.resolve();
const _nominatimCache = new Map<string, { expiry: number; data: NominatimResult[] }>();
const _reverseCache = new Map<string, { expiry: number; label: string }>();
const _reverseInflight = new Map<string, Promise<string>>();
let _reverseCooldownUntil = 0;
let _venueQueryCooldownUntil = 0;
let _nominatimHardCooldownUntil = 0;

async function fetchOrThrow(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, init);
    if (!res.ok) {
        throw new Error(`${url} ${res.status}`);
    }
    return res;
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scheduleNominatim<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
        const now = Date.now();
        const delay = Math.max(0, _nextNominatimAt - now);
        if (delay > 0) await wait(delay);
        _nextNominatimAt = Date.now() + NOMINATIM_MIN_INTERVAL_MS;
        return task();
    };

    const chained = _nominatimQueue.then(run, run);
    _nominatimQueue = chained.then(() => undefined, () => undefined);
    return chained;
}

async function fetchNominatimJson(pathAndQuery: string): Promise<NominatimResult[]> {
    const nowStart = Date.now();
    if (nowStart < _nominatimHardCooldownUntil) {
        throw new Error('nominatim-hard-cooldown');
    }

    const url = `${NOMINATIM_ENDPOINT}${pathAndQuery}`;
    const cached = _nominatimCache.get(url);
    if (cached && cached.expiry > nowStart) return cached.data;

    let lastError: unknown;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await scheduleNominatim(() =>
                fetchOrThrow(url, { headers: { 'Accept-Language': getPreferredLanguage() } })
            );
            const data = (await res.json()) as NominatimResult[];
            _nominatimCache.set(url, { expiry: Date.now() + NOMINATIM_CACHE_TTL_MS, data });
            return data;
        } catch (err) {
            lastError = err;
            const message = err instanceof Error ? err.message : String(err);
            const isRateLimited = message.includes(' 429') || message.includes('429');
            const isCorsOrNetworkBlocked = err instanceof TypeError || /Failed to fetch|NetworkError|CORS/i.test(message);

            if (isRateLimited || isCorsOrNetworkBlocked) {
                // Public endpoint is throttling/blocking: stop retry storm globally for a while.
                _nominatimHardCooldownUntil = Date.now() + NOMINATIM_HARD_COOLDOWN_MS;
                _venueQueryCooldownUntil = Math.max(_venueQueryCooldownUntil, Date.now() + NOMINATIM_HARD_COOLDOWN_MS);
                break;
            }

            if (attempt < maxAttempts) {
                // Back off aggressively on public endpoints to avoid 429 loops.
                await wait(attempt * 1800);
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error('Nominatim request failed');
}

function nominatimToSuggestion(r: NominatimResult): GeocodeSuggestion {
    const parts = r.display_name.split(', ');
    const shortName = parts.slice(0, 2).join(', ');
    return {
        placeId: String(r.place_id),
        displayName: r.display_name,
        shortName,
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        type: r.type ?? r.class ?? 'place',
    };
}

interface NominatimResult {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
    type?: string;
    class?: string;
}

function getPreferredLanguage() {
    if (typeof navigator !== 'undefined' && Array.isArray(navigator.languages) && navigator.languages.length > 0) {
        return navigator.languages[0];
    }
    return 'en';
}

function buildViewBox(center: { lat: number; lng: number }, radiusKm: number): string {
    const safeLat = Math.max(-85, Math.min(85, center.lat));
    const latRad = (safeLat * Math.PI) / 180;
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.max(0.2, Math.cos(latRad)));

    const west = center.lng - lngDelta;
    const east = center.lng + lngDelta;
    const south = center.lat - latDelta;
    const north = center.lat + latDelta;
    return `${west},${north},${east},${south}`;
}

async function runNominatimSearch(
    query: string,
    countrycodes?: string,
    limit = 8,
    bias?: { center: { lat: number; lng: number }; radiusKm?: number }
) {
    const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: String(limit),
        dedupe: '1',
        ...(countrycodes ? { countrycodes } : {}),
    });

    if (bias?.center) {
        params.set('viewbox', buildViewBox(bias.center, Math.max(3, Math.min(150, bias.radiusKm ?? 25))));
        // With bounded=0, Nominatim prefers this area but can still return global matches.
        params.set('bounded', '0');
    }

    return fetchNominatimJson(`/search?${params}`);
}

/**
 * Autocomplete suggestions for a query string, debounced by default.
 * Pass `immediate: true` to skip debounce.
 */
export function geocodeAutocomplete(
    query: string,
    options: {
        debounceMs?: number;
        immediate?: boolean;
        countrycodes?: string;
        biasCenter?: { lat: number; lng: number };
        biasRadiusKm?: number;
    } = {}
): Promise<GeocodeSuggestion[]> {
    return new Promise((resolve, reject) => {
        const run = async () => {
            const q = query.trim();
            if (!q || q.length < 2) { resolve([]); return; }

            try {
                const bias = options.biasCenter ? { center: options.biasCenter, radiusKm: options.biasRadiusKm } : undefined;
                const primary = await runNominatimSearch(q, options.countrycodes, 10, bias);
                if (primary.length > 0 || !options.countrycodes) {
                    resolve(primary.map(nominatimToSuggestion));
                    return;
                }

                // If a country-restricted search returns nothing, retry globally.
                const fallback = await runNominatimSearch(q, undefined, 10, bias);
                resolve(fallback.map(nominatimToSuggestion));
            } catch (err) {
                reject(err);
            }
        };

        if (options.immediate) {
            run();
        } else {
            if (_debounceTimer) clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(run, options.debounceMs ?? 400);
        }
    });
}

/**
 * Reverse geocode a coordinate pair to a human-readable address.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    // Quantize to avoid hammering reverse geocode for tiny GPS jitter.
    const qLat = lat.toFixed(4);
    const qLng = lng.toFixed(4);
    const cacheKey = `${qLat},${qLng}`;
    const now = Date.now();

    const cached = _reverseCache.get(cacheKey);
    if (cached && cached.expiry > now) return cached.label;
    if (_reverseInflight.has(cacheKey)) return _reverseInflight.get(cacheKey)!;

    if (now < _reverseCooldownUntil) {
        throw new Error('reverse-geocode-cooling-off');
    }

    const run = async () => {
    const params = new URLSearchParams({
        lat: qLat, lon: qLng,
        format: 'json', zoom: '16',
    });

        try {
            const res = await scheduleNominatim(() =>
                fetchOrThrow(`${NOMINATIM_ENDPOINT}/reverse?${params}`, {
                    headers: { 'Accept-Language': getPreferredLanguage() },
                })
            );
            const data = await res.json();
            const parts = (data.display_name as string).split(', ');
            const label = parts.slice(0, 3).join(', ');
            _reverseCache.set(cacheKey, { expiry: Date.now() + REVERSE_CACHE_TTL_MS, label });
            _reverseCooldownUntil = 0;
            return label;
        } catch (err) {
            // Prevent immediate re-hammering after 429/CORS-blocked response.
            _reverseCooldownUntil = Date.now() + 30_000;
            throw err;
        } finally {
            _reverseInflight.delete(cacheKey);
        }
    };

    const promise = run();
    _reverseInflight.set(cacheKey, promise);
    return promise;
}

/**
 * Fetch venues (cafes, parks, etc.) near a coordinate using Nominatim only.
 */
export async function fetchVenues(lat: number, lng: number, radius = 3000): Promise<Venue[]> {
    try {
        if (Date.now() < _venueQueryCooldownUntil) return [];

        const center = { lat, lng };
        const radiusKm = Math.max(1, Math.round(radius / 1000));
        const viewbox = buildViewBox(center, radiusKm);
        const searchTermsPrimary: Array<{ q: string; category: string }> = [
            { q: 'cafe', category: 'cafe' },
            { q: 'restaurant', category: 'restaurant' },
            { q: 'park', category: 'park' },
            { q: 'bar', category: 'bar' },
        ];
        const searchTermsSecondary: Array<{ q: string; category: string }> = [
            { q: 'hotel', category: 'hotel' },
            { q: 'mall', category: 'mall' },
            { q: 'supermarket', category: 'supermarket' },
            { q: 'pharmacy', category: 'pharmacy' },
        ];

        const mapped: Venue[] = [];
        const seen = new Set<string>();
        let hadQueryFailure = false;

        const collectFromTerm = async (term: { q: string; category: string }, limit: string) => {
            const params = new URLSearchParams({
                q: term.q,
                format: 'json',
                addressdetails: '1',
                dedupe: '1',
                limit,
                viewbox,
                bounded: '1',
            });

            let rows: NominatimResult[] = [];
            try {
                rows = await fetchNominatimJson(`/search?${params}`);
            } catch {
                hadQueryFailure = true;
                _venueQueryCooldownUntil = Date.now() + VENUE_QUERY_COOLDOWN_MS;
                return;
            }

            for (const r of rows) {
                const name = r.display_name.split(', ')[0]?.trim();
                const venueLat = parseFloat(r.lat);
                const venueLng = parseFloat(r.lon);
                if (!name || Number.isNaN(venueLat) || Number.isNaN(venueLng)) continue;

                const dedupeKey = `${name.toLowerCase()}_${venueLat.toFixed(5)}_${venueLng.toFixed(5)}`;
                if (seen.has(dedupeKey)) continue;
                seen.add(dedupeKey);

                const parts = r.display_name.split(', ');
                mapped.push({
                    id: `${r.place_id}`,
                    name,
                    category: term.category,
                    emoji: _getEmojiForAmenity(term.category),
                    address: parts.slice(1, 4).join(', ') || 'Nearby Spot',
                    coordinates: { lat: venueLat, lng: venueLng },
                    distanceKm: 0,
                    etaMinutesFromYou: 0,
                    etaMinutesFromPartner: 0,
                });
            }
        };

        for (const term of searchTermsPrimary) {
            if (hadQueryFailure) break;
            await collectFromTerm(term, '5');
        }

        // Expand categories while keeping strict midpoint bounds.
        if (mapped.length < 4 && !hadQueryFailure) {
            for (const term of searchTermsSecondary) {
                if (hadQueryFailure) break;
                await collectFromTerm(term, '4');
            }
        }

        return mapped;
    } catch (err) {
        console.error('[GeocodingService] fetchVenues failed:', err);
        return [];
    }
}

export async function suggestMeetupVenues(input: MeetupSuggestionInput): Promise<Venue[]> {
    const { own, partner, midpoint } = input;
    const maxResults = Math.max(3, Math.min(input.maxResults ?? 10, 10));
    const radii = [1800, 2800, 3800];
    const merged: Venue[] = [];
    const seen = new Set<string>();

    const pairDistanceKm = getDistance(own.lat, own.lng, partner.lat, partner.lng);
    const maxMidpointDetourKm = Math.max(0.9, Math.min(3.8, pairDistanceKm * 0.35));
    const maxFairnessGapMinutes = Math.max(4, Math.min(12, Math.round(pairDistanceKm * 1.2)));

    for (const radius of radii) {
        const batch = await fetchVenues(midpoint.lat, midpoint.lng, radius);
        for (const v of batch) {
            const key = `${v.name.toLowerCase()}_${v.coordinates.lat.toFixed(5)}_${v.coordinates.lng.toFixed(5)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(v);
        }
        if (merged.length >= maxResults * 2) break;
    }

    const scored = merged
        .map((v) => {
            const dYou = getDistance(own.lat, own.lng, v.coordinates.lat, v.coordinates.lng);
            const dPartner = getDistance(partner.lat, partner.lng, v.coordinates.lat, v.coordinates.lng);
            const dMid = getDistance(midpoint.lat, midpoint.lng, v.coordinates.lat, v.coordinates.lng);

            const etaYou = Math.max(1, Math.round((dYou / 18) * 60));
            const etaPartner = Math.max(1, Math.round((dPartner / 18) * 60));

            const fairnessGap = Math.abs(etaYou - etaPartner);
            const fairnessPenalty = Math.min(50, fairnessGap * 3);
            const midpointPenalty = Math.min(40, dMid * 7);
            const travelPenalty = Math.min(22, (etaYou + etaPartner) * 0.35);
            const addressBonus = v.address && v.address !== 'Nearby Spot' ? 4 : 0;
            const categoryBonus = /cafe|restaurant|park|garden|pub|bar/.test(v.category || '') ? 8 : 0;
            const genericNamePenalty = /unknown|unnamed|place/i.test(v.name) ? 18 : 0;
            const score = 100 - fairnessPenalty - midpointPenalty - travelPenalty + addressBonus + categoryBonus - genericNamePenalty;

            return {
                venue: {
                    ...v,
                    distanceKm: parseFloat(dYou.toFixed(1)),
                    etaMinutesFromYou: etaYou,
                    etaMinutesFromPartner: etaPartner,
                },
                score,
                fairnessGap,
                dMid,
            };
        })
        // Keep places close to midpoint and balanced for both parties.
        .filter((x) => x.dMid <= maxMidpointDetourKm && x.fairnessGap <= maxFairnessGapMinutes)
        .sort((a, b) => b.score - a.score);

    const candidatePool = scored.length > 0
        ? scored
        : merged
            .map((v) => {
                const dMid = getDistance(midpoint.lat, midpoint.lng, v.coordinates.lat, v.coordinates.lng);
                const dYou = getDistance(own.lat, own.lng, v.coordinates.lat, v.coordinates.lng);
                const dPartner = getDistance(partner.lat, partner.lng, v.coordinates.lat, v.coordinates.lng);
                return {
                    venue: {
                        ...v,
                        distanceKm: parseFloat(dYou.toFixed(1)),
                        etaMinutesFromYou: Math.max(1, Math.round((dYou / 18) * 60)),
                        etaMinutesFromPartner: Math.max(1, Math.round((dPartner / 18) * 60)),
                    },
                    score: 100 - Math.min(60, dMid * 10),
                };
            })
            .sort((a, b) => b.score - a.score);

    const diversified: Venue[] = [];
    const categoryCount = new Map<string, number>();
    for (const item of candidatePool) {
        const cat = item.venue.category || 'other';
        const count = categoryCount.get(cat) ?? 0;
        if (count >= 2 && diversified.length < Math.floor(maxResults * 0.7)) continue;
        diversified.push(item.venue);
        categoryCount.set(cat, count + 1);
        if (diversified.length >= maxResults) break;
    }

    return diversified;
}

function _getEmojiForAmenity(amenity: string): string {
    switch (amenity) {
        case 'cafe': return '☕';
        case 'bar': return '🍺';
        case 'pub': return '🍷';
        case 'restaurant': return '🍽';
        case 'park':
        case 'garden':
        case 'playground':
        case 'recreation_ground': return '🌳';
        case 'beach_resort': return '🏖';
        default: return '📍';
    }
}

/**
 * Haversine formula to calculate distance between two points in km.
 */
export function getDistance(lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return 0;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Distance in meters between two points
 */
export function haversineMeters(a: { lat: number; lng: number } | null, b: { lat: number; lng: number } | null): number {
    if (!a || !b) return 0;
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}