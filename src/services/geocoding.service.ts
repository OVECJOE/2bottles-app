const NOMINATIM_ENDPOINT = (import.meta.env.VITE_NOMINATIM_ENDPOINT as string | undefined) || '/api/nominatim';
const PHOTON_ENDPOINT = (import.meta.env.VITE_PHOTON_ENDPOINT as string | undefined) || '/api/photon';
const GEOAPIFY_ENDPOINT = (import.meta.env.VITE_GEOAPIFY_ENDPOINT as string | undefined) || 'https://api.geoapify.com/v2/places';
const GEOAPIFY_API_KEY = (import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined) || '';
const ROUTING_ENDPOINT = (import.meta.env.VITE_ROUTING_ENDPOINT as string | undefined) || '/api/route';
const NOMINATIM_MIN_INTERVAL_MS = Number(import.meta.env.VITE_NOMINATIM_MIN_INTERVAL_MS ?? 1200);
const NOMINATIM_CACHE_TTL_MS = 2 * 60 * 1000;
const PHOTON_CACHE_TTL_MS = 2 * 60 * 1000;
const REVERSE_CACHE_TTL_MS = 5 * 60 * 1000;
const NOMINATIM_HARD_COOLDOWN_MS = 45 * 1000;
const VENUE_SUGGESTION_CACHE_TTL_MS = 2 * 60 * 1000;
const GEOAPIFY_CANDIDATE_CACHE_TTL_MS = 2 * 60 * 1000;
const ROUTE_METRICS_CACHE_TTL_MS = 5 * 60 * 1000;
const NOMINATIM_CACHE_MAX = 220;
const PHOTON_CACHE_MAX = 220;
const REVERSE_CACHE_MAX = 320;
const VENUE_SUGGESTION_CACHE_MAX = 140;
const GEOAPIFY_CANDIDATE_CACHE_MAX = 220;
const ROUTE_METRICS_CACHE_MAX = 320;

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
    maxResults?: number;
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;
let _debouncedResolve: ((value: GeocodeSuggestion[]) => void) | null = null;
let _nextNominatimAt = 0;
let _nominatimQueue: Promise<unknown> = Promise.resolve();
const _nominatimCache = new Map<string, { expiry: number; data: NominatimResult[] }>();
const _photonCache = new Map<string, { expiry: number; data: PhotonResult[] }>();
const _reverseCache = new Map<string, { expiry: number; label: string }>();
const _reverseInflight = new Map<string, Promise<string>>();
let _reverseCooldownUntil = 0;
let _nominatimHardCooldownUntil = 0;
const _venueSuggestionCache = new Map<string, { expiry: number; data: Venue[] }>();
const _venueSuggestionInflight = new Map<string, Promise<Venue[]>>();
const _geoapifyCandidateCache = new Map<string, { expiry: number; data: Venue[] }>();
const _geoapifyCandidateInflight = new Map<string, Promise<Venue[]>>();
let _geoapifyCooldownUntil = 0;
const _routeMetricsCache = new Map<string, { expiry: number; data: RouteMetrics }>();

interface RouteMetrics {
    minutes: number;
    distanceKm: number;
}

class HttpError extends Error {
    status: number;

    constructor(url: string, status: number) {
        super(`${url} ${status}`);
        this.name = 'HttpError';
        this.status = status;
    }
}

async function fetchOrThrow(url: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(url, init);
    if (!res.ok) {
        throw new HttpError(url, res.status);
    }
    return res;
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label}-timeout`)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

function pruneCache<K, V extends { expiry: number }>(map: Map<K, V>, maxEntries: number) {
    const now = Date.now();
    for (const [key, value] of map) {
        if (value.expiry <= now) map.delete(key);
    }

    if (map.size <= maxEntries) return;
    const overflow = map.size - maxEntries;
    let removed = 0;
    for (const key of map.keys()) {
        map.delete(key);
        removed += 1;
        if (removed >= overflow) break;
    }
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
            pruneCache(_nominatimCache, NOMINATIM_CACHE_MAX);
            _nominatimCache.set(url, { expiry: Date.now() + NOMINATIM_CACHE_TTL_MS, data });
            return data;
        } catch (err) {
            lastError = err;
            const isRateLimited = err instanceof HttpError && err.status === 429;

            if (isRateLimited) {
                // Public endpoint is throttling: stop retry storm briefly.
                _nominatimHardCooldownUntil = Date.now() + NOMINATIM_HARD_COOLDOWN_MS;
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

interface PhotonResponse {
    features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
            osm_id?: string | number;
            name?: string;
            city?: string;
            district?: string;
            county?: string;
            state?: string;
            country?: string;
            street?: string;
            housenumber?: string;
            type?: string;
            osm_value?: string;
        };
    }>;
}

interface PhotonResult {
    place_id: string;
    display_name: string;
    lat: number;
    lon: number;
    type: string;
}

function getPreferredLanguage() {
    if (typeof navigator !== 'undefined' && Array.isArray(navigator.languages) && navigator.languages.length > 0) {
        return navigator.languages[0];
    }
    return 'en';
}

const GEOAPIFY_LANGS = new Set([
    'ab', 'aa', 'af', 'ak', 'sq', 'am', 'ar', 'an', 'hy', 'as', 'av', 'ae', 'ay', 'az', 'bm', 'ba', 'eu', 'be', 'bn', 'bh',
    'bi', 'bs', 'br', 'bg', 'my', 'ca', 'ch', 'ce', 'ny', 'zh', 'cv', 'kw', 'co', 'cr', 'hr', 'cs', 'da', 'dv', 'nl', 'en',
    'eo', 'et', 'ee', 'fo', 'fj', 'fi', 'fr', 'ff', 'gl', 'ka', 'de', 'el', 'gn', 'gu', 'ht', 'ha', 'he', 'hz', 'hi', 'ho',
    'hu', 'ia', 'id', 'ie', 'ga', 'ig', 'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'kl', 'kn', 'kr', 'ks', 'kk', 'km', 'ki',
    'rw', 'ky', 'kv', 'kg', 'ko', 'ku', 'kj', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv', 'gv', 'mk', 'mg', 'ms',
    'ml', 'mt', 'mi', 'mr', 'mh', 'mn', 'na', 'nv', 'nb', 'nd', 'ne', 'ng', 'nn', 'no', 'ii', 'nr', 'oc', 'oj', 'cu', 'om',
    'or', 'os', 'pa', 'pi', 'fa', 'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'sa', 'sc', 'sd', 'se', 'sm', 'sg', 'sr',
    'gd', 'sn', 'si', 'sk', 'sl', 'so', 'st', 'es', 'su', 'sw', 'ss', 'sv', 'ta', 'te', 'tg', 'th', 'ti', 'bo', 'tk', 'tl',
    'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'cy', 'wo', 'fy', 'xh', 'yi',
    'yo', 'za',
]);

function getGeoapifyLanguage(): string {
    const preferred = getPreferredLanguage().toLowerCase();
    const base = preferred.split('-')[0];
    if (GEOAPIFY_LANGS.has(base)) return base;
    if (GEOAPIFY_LANGS.has(preferred)) return preferred;
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

async function fetchPhotonJson(pathAndQuery: string): Promise<PhotonResult[]> {
    const url = `${PHOTON_ENDPOINT}${pathAndQuery}`;
    const now = Date.now();
    const cached = _photonCache.get(url);
    if (cached && cached.expiry > now) return cached.data;

    const res = await fetchOrThrow(url, { headers: { 'Accept-Language': getPreferredLanguage() } });
    const body = (await res.json()) as PhotonResponse;
    const mapped: PhotonResult[] = [];
    for (const f of (body.features ?? [])) {
            const coords = f.geometry?.coordinates;
            const props = f.properties;
            if (!coords || coords.length < 2 || !props) continue;

            const lon = Number(coords[0]);
            const lat = Number(coords[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

            const title = props.name || props.street || props.city || props.county || props.state || props.country || 'Place';
            const addressParts = [
                [props.street, props.housenumber].filter(Boolean).join(' ').trim(),
                props.city || props.district || props.county,
                props.state,
                props.country,
            ].filter(Boolean);
            const displayName = [title, ...addressParts].filter(Boolean).join(', ');

            mapped.push({
                place_id: String(props.osm_id ?? `${lat.toFixed(5)}_${lon.toFixed(5)}`),
                display_name: displayName,
                lat,
                lon,
                type: props.osm_value || props.type || 'place',
            });
    }

    pruneCache(_photonCache, PHOTON_CACHE_MAX);
    _photonCache.set(url, { expiry: now + PHOTON_CACHE_TTL_MS, data: mapped });
    return mapped;
}

async function runPhotonSearch(
    query: string,
    limit = 8,
    bias?: { center: { lat: number; lng: number } }
) {
    const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        lang: getPreferredLanguage(),
    });

    if (bias?.center) {
        params.set('lat', String(bias.center.lat));
        params.set('lon', String(bias.center.lng));
    }

    return fetchPhotonJson(`/?${params}`);
}

function photonToSuggestion(r: PhotonResult): GeocodeSuggestion {
    const parts = r.display_name.split(', ');
    const shortName = parts.slice(0, 2).join(', ');
    return {
        placeId: r.place_id,
        displayName: r.display_name,
        shortName,
        lat: r.lat,
        lng: r.lon,
        type: r.type ?? 'place',
    };
}

interface GeoapifyResponse {
    features?: Array<{
        properties?: {
            place_id?: string;
            name?: string;
            formatted?: string;
            categories?: string[];
            datasource?: { raw?: Record<string, string> };
        };
        geometry?: {
            coordinates?: [number, number];
        };
    }>;
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
        const clearPendingDebounce = () => {
            if (_debounceTimer) {
                clearTimeout(_debounceTimer);
                _debounceTimer = null;
            }
            if (_debouncedResolve) {
                // Resolve superseded callers instead of leaving hanging promises.
                _debouncedResolve([]);
                _debouncedResolve = null;
            }
        };

        const run = async () => {
            const q = query.trim();
            if (!q || q.length < 2) { resolve([]); return; }

            try {
                const bias = options.biasCenter ? { center: options.biasCenter, radiusKm: options.biasRadiusKm } : undefined;
                const primary = await runNominatimSearch(q, options.countrycodes, 10, bias);
                if (primary.length > 0 || !options.countrycodes) {
                    if (primary.length > 0) {
                        resolve(primary.map(nominatimToSuggestion));
                        return;
                    }

                    const photonResults = await runPhotonSearch(q, 10, bias ? { center: bias.center } : undefined);
                    resolve(photonResults.map(photonToSuggestion));
                    return;
                }

                const fallback = await runNominatimSearch(q, undefined, 10, bias);
                if (fallback.length > 0) {
                    resolve(fallback.map(nominatimToSuggestion));
                    return;
                }

                const photonResults = await runPhotonSearch(q, 10, bias ? { center: bias.center } : undefined);
                resolve(photonResults.map(photonToSuggestion));
            } catch (err) {
                try {
                    const photonResults = await runPhotonSearch(
                        q,
                        10,
                        options.biasCenter ? { center: options.biasCenter } : undefined,
                    );
                    resolve(photonResults.map(photonToSuggestion));
                } catch {
                    reject(err);
                }
            }
        };

        if (options.immediate) {
            clearPendingDebounce();
            run();
        } else {
            clearPendingDebounce();
            _debouncedResolve = resolve;
            _debounceTimer = setTimeout(() => {
                _debounceTimer = null;
                _debouncedResolve = null;
                run();
            }, options.debounceMs ?? 400);
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
            const data = await res.json() as { display_name?: string };
            const displayName = typeof data.display_name === 'string' && data.display_name.trim().length > 0
                ? data.display_name
                : 'Pinned location';
            const parts = displayName.split(', ');
            const label = parts.slice(0, 3).join(', ');
            pruneCache(_reverseCache, REVERSE_CACHE_MAX);
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
 * Fetch venues near a coordinate using progressive multi-source discovery.
 */
export async function fetchVenues(lat: number, lng: number, radius = 3000): Promise<Venue[]> {
    const center = { lat, lng };
    const radiusM = Math.max(900, Math.min(12000, Math.round(radius)));
    const paddingKm = Math.max(0.9, radiusM / 1000);
    const base = buildRectFromCoordinates(center, center, paddingKm);
    const result = await collectVenueCandidatesProgressive(
        [base, expandRect(base, 1.5), expandRect(base, 2.1)],
        center,
        center,
        24,
    );
    return result.venues.filter((v) => getDistance(lat, lng, v.coordinates.lat, v.coordinates.lng) <= radiusM / 1000);
}

export async function suggestMeetupVenues(input: MeetupSuggestionInput): Promise<Venue[]> {
    const { own, partner } = input;
    if (!hasFiniteCoordinates(own) || !hasFiniteCoordinates(partner)) return [];

    const maxResults = Math.max(3, Math.min(input.maxResults ?? 10, 10));
    const cacheKey = makeSuggestionCacheKey(input, maxResults);
    const now = Date.now();
    const cached = _venueSuggestionCache.get(cacheKey);
    if (cached && cached.expiry > now) return cached.data;

    const inflight = _venueSuggestionInflight.get(cacheKey);
    if (inflight) return inflight;

    const job = (async (): Promise<Venue[]> => {
        const candidateRectangles = buildCandidateRectangles(own, partner);
        const candidateResult = await collectVenueCandidatesProgressive(
            candidateRectangles,
            own,
            partner,
            Math.max(12, maxResults + 6),
        );
        if (!candidateResult.sourceHealthy) {
            throw new Error('Venue providers are currently unavailable. Please retry.');
        }
        const candidates = candidateResult.venues;
        if (candidates.length === 0) return [];

        const coarse = candidates
            .map((venue) => {
                const dYouKm = getDistance(own.lat, own.lng, venue.coordinates.lat, venue.coordinates.lng);
                const dPartnerKm = getDistance(partner.lat, partner.lng, venue.coordinates.lat, venue.coordinates.lng);
                const etaYou = etaFromDistanceKm(dYouKm);
                const etaPartner = etaFromDistanceKm(dPartnerKm);
                const fairnessGap = Math.abs(etaYou - etaPartner);

                const score =
                    120
                    - fairnessGap * 2.9
                    - (etaYou + etaPartner) * 0.35
                    + (/cafe|restaurant|park|garden|pub|bar/.test(venue.category || '') ? 6 : 0)
                    + (venue.address && venue.address !== 'Nearby Spot' ? 3 : 0);

                return {
                    venue,
                    dYouKm,
                    dPartnerKm,
                    etaYou,
                    etaPartner,
                    score,
                };
            })
            .sort((a, b) => b.score - a.score);

        const routeRefineCount = Math.min(10, Math.max(4, maxResults + 2));
        const toRefine = coarse.slice(0, routeRefineCount);
        const remaining = coarse.slice(routeRefineCount);

        const refined = await Promise.all(toRefine.map(async (entry) => {
            const [youRoute, partnerRoute] = await Promise.all([
                fetchRouteMetrics(own, entry.venue.coordinates),
                fetchRouteMetrics(partner, entry.venue.coordinates),
            ]);

            const etaYou = youRoute?.minutes ?? entry.etaYou;
            const etaPartner = partnerRoute?.minutes ?? entry.etaPartner;
            const dYouKm = youRoute?.distanceKm ?? entry.dYouKm;
            const fairnessGap = Math.abs(etaYou - etaPartner);

            const routeScore =
                135
                - fairnessGap * 3.4
                - (etaYou + etaPartner) * 0.42
                + (/cafe|restaurant|park|garden|pub|bar/.test(entry.venue.category || '') ? 8 : 0)
                + (entry.venue.address && entry.venue.address !== 'Nearby Spot' ? 4 : 0);

            return {
                venue: {
                    ...entry.venue,
                    distanceKm: parseFloat(dYouKm.toFixed(1)),
                    etaMinutesFromYou: Math.max(1, Math.round(etaYou)),
                    etaMinutesFromPartner: Math.max(1, Math.round(etaPartner)),
                },
                score: routeScore,
                fairnessGap,
            };
        }));

        const roughTail = remaining.map((entry) => ({
            venue: {
                ...entry.venue,
                distanceKm: parseFloat(entry.dYouKm.toFixed(1)),
                etaMinutesFromYou: entry.etaYou,
                etaMinutesFromPartner: entry.etaPartner,
            },
            score: entry.score,
            fairnessGap: Math.abs(entry.etaYou - entry.etaPartner),
        }));

        const allScored = [...refined, ...roughTail].sort((a, b) => b.score - a.score);
        const balanced = allScored.filter((x) => x.fairnessGap <= 16);
        const pool = balanced.length >= maxResults ? balanced : allScored;

        const diversified: Venue[] = [];
        const categoryCount = new Map<string, number>();
        for (const item of pool) {
            const cat = item.venue.category || 'other';
            const count = categoryCount.get(cat) ?? 0;
            if (count >= 2 && diversified.length < Math.max(4, Math.floor(maxResults * 0.8))) continue;
            diversified.push(item.venue);
            categoryCount.set(cat, count + 1);
            if (diversified.length >= maxResults) break;
        }

        const finalList = diversified.length > 0
            ? diversified
            : pool.slice(0, maxResults).map((x) => x.venue);

        pruneCache(_venueSuggestionCache, VENUE_SUGGESTION_CACHE_MAX);
        _venueSuggestionCache.set(cacheKey, {
            expiry: Date.now() + VENUE_SUGGESTION_CACHE_TTL_MS,
            data: finalList,
        });

        return finalList;
    })();

    _venueSuggestionInflight.set(cacheKey, job);
    try {
        return await job;
    } finally {
        _venueSuggestionInflight.delete(cacheKey);
    }
}

function quantizeCoord(value: number, precision = 3): string {
    return value.toFixed(precision);
}

function makeSuggestionCacheKey(input: MeetupSuggestionInput, maxResults: number): string {
    const a = `${quantizeCoord(input.own.lat)}|${quantizeCoord(input.own.lng)}`;
    const b = `${quantizeCoord(input.partner.lat)}|${quantizeCoord(input.partner.lng)}`;
    const pair = a < b ? `${a}~${b}` : `${b}~${a}`;
    return [
        pair,
        String(maxResults),
    ].join('|');
}

interface GeoRect {
    west: number;
    south: number;
    east: number;
    north: number;
}

function hasFiniteCoordinates(coords: Coordinates | null | undefined): coords is Coordinates {
    return !!coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng);
}

function clampLat(value: number): number {
    return Math.max(-85, Math.min(85, value));
}

function normalizeLng(value: number): number {
    const normalized = ((value + 180) % 360 + 360) % 360 - 180;
    return Number.isFinite(normalized) ? normalized : value;
}

function buildRectFromCoordinates(own: Coordinates, partner: Coordinates, paddingKm: number): GeoRect {
    const ownLng = normalizeLng(own.lng);
    const partnerLng = normalizeLng(partner.lng);
    const latMin = Math.min(clampLat(own.lat), clampLat(partner.lat));
    const latMax = Math.max(clampLat(own.lat), clampLat(partner.lat));

    const directSpan = Math.abs(ownLng - partnerLng);
    let west = Math.min(ownLng, partnerLng);
    let east = Math.max(ownLng, partnerLng);
    if (directSpan > 180) {
        west = -180;
        east = 180;
    }

    const midLat = (latMin + latMax) / 2;
    const latDelta = paddingKm / 111.32;
    const lngDelta = paddingKm / (111.32 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));

    return normalizeRect({
        west: Math.max(-180, west - lngDelta),
        south: clampLat(latMin - latDelta),
        east: Math.min(180, east + lngDelta),
        north: clampLat(latMax + latDelta),
    });
}

function expandRect(rect: GeoRect, factor: number): GeoRect {
    const latSpan = Math.max(0.0005, rect.north - rect.south);
    const lngSpan = Math.max(0.0005, rect.east - rect.west);
    const latPad = ((latSpan * factor) - latSpan) / 2;
    const lngPad = ((lngSpan * factor) - lngSpan) / 2;

    return normalizeRect({
        west: Math.max(-180, rect.west - lngPad),
        south: clampLat(rect.south - latPad),
        east: Math.min(180, rect.east + lngPad),
        north: clampLat(rect.north + latPad),
    });
}

function normalizeRect(rect: GeoRect): GeoRect {
    const west = Math.max(-180, Math.min(180, rect.west));
    const east = Math.max(-180, Math.min(180, rect.east));
    const south = clampLat(rect.south);
    const north = clampLat(rect.north);

    const minLatSpan = 0.0005;
    const minLngSpan = 0.0005;

    const fixedSouth = Math.min(south, north - minLatSpan);
    const fixedNorth = Math.max(north, fixedSouth + minLatSpan);
    const fixedWest = Math.min(west, east - minLngSpan);
    const fixedEast = Math.max(east, fixedWest + minLngSpan);

    return {
        west: Math.max(-180, fixedWest),
        south: clampLat(fixedSouth),
        east: Math.min(180, fixedEast),
        north: clampLat(fixedNorth),
    };
}

function rectCacheKey(rect: GeoRect): string {
    return [rect.west, rect.south, rect.east, rect.north].map((n) => n.toFixed(4)).join('|');
}

function buildCandidateRectangles(own: Coordinates, partner: Coordinates): GeoRect[] {
    const ownLng = normalizeLng(own.lng);
    const partnerLng = normalizeLng(partner.lng);
    const ownPartnerDistanceKm = getDistance(own.lat, own.lng, partner.lat, partner.lng);
    const basePaddingKm = Math.max(1.1, Math.min(6.5, ownPartnerDistanceKm * 0.22));
    const latMin = Math.min(clampLat(own.lat), clampLat(partner.lat));
    const latMax = Math.max(clampLat(own.lat), clampLat(partner.lat));
    const midLat = (latMin + latMax) / 2;
    const latDelta = basePaddingKm / 111.32;
    const lngDelta = basePaddingKm / (111.32 * Math.max(0.2, Math.cos((midLat * Math.PI) / 180)));

    const directSpan = Math.abs(ownLng - partnerLng);
    if (directSpan > 180) {
        const eastSideBase = normalizeRect({
            west: Math.max(ownLng, partnerLng) - lngDelta,
            south: clampLat(latMin - latDelta),
            east: 180,
            north: clampLat(latMax + latDelta),
        });
        const westSideBase = normalizeRect({
            west: -180,
            south: clampLat(latMin - latDelta),
            east: Math.min(ownLng, partnerLng) + lngDelta,
            north: clampLat(latMax + latDelta),
        });

        return [
            eastSideBase,
            expandRect(eastSideBase, 1.45),
            expandRect(eastSideBase, 1.95),
            westSideBase,
            expandRect(westSideBase, 1.45),
            expandRect(westSideBase, 1.95),
        ];
    }

    const base = buildRectFromCoordinates(own, partner, basePaddingKm);
    return [
        base,
        expandRect(base, 1.45),
        expandRect(base, 1.95),
        expandRect(base, 2.55),
    ];
}

function etaFromDistanceKm(distanceKm: number): number {
    // Baseline city driving average (conservative) when live route time is unavailable.
    return Math.max(2, Math.round((distanceKm / 22) * 60));
}

function normalizeVenueName(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^a-z0-9 ]/g, '')
        .trim();
}

function makeVenueDedupeKey(name: string, lat: number, lng: number): string {
    return `${normalizeVenueName(name)}_${lat.toFixed(4)}_${lng.toFixed(4)}`;
}

async function fetchRouteMetrics(from: Coordinates, to: Coordinates): Promise<RouteMetrics | null> {
    const key = `${from.lat.toFixed(5)},${from.lng.toFixed(5)}|${to.lat.toFixed(5)},${to.lng.toFixed(5)}`;
    const cached = _routeMetricsCache.get(key);
    if (cached && cached.expiry > Date.now()) return cached.data;

    try {
        const params = new URLSearchParams({
            overview: 'false',
            steps: 'false',
        });
        const fromPoint = `${from.lng},${from.lat}`;
        const toPoint = `${to.lng},${to.lat}`;
        const url = `${ROUTING_ENDPOINT}/route/v1/driving/${fromPoint};${toPoint}?${params}`;

        const res = await withTimeout(fetchOrThrow(url), 7000, 'route-metrics');
        const data = await res.json() as {
            routes?: Array<{ duration?: number; distance?: number }>;
        };
        const route = data.routes?.[0];
        if (route?.duration == null || route?.distance == null) return null;

        const metrics: RouteMetrics = {
            minutes: route.duration / 60,
            distanceKm: route.distance / 1000,
        };

        pruneCache(_routeMetricsCache, ROUTE_METRICS_CACHE_MAX);
        _routeMetricsCache.set(key, {
            expiry: Date.now() + ROUTE_METRICS_CACHE_TTL_MS,
            data: metrics,
        });
        return metrics;
    } catch {
        return null;
    }
}

function categoryFromGeoapify(categories: string[] | undefined): string {
    if (!categories || categories.length === 0) return 'place';
    const joined = categories.join(',');
    if (joined.includes('catering.cafe')) return 'cafe';
    if (joined.includes('catering.restaurant')) return 'restaurant';
    if (joined.includes('catering.bar')) return 'bar';
    if (joined.includes('leisure.park')) return 'park';
    if (joined.includes('leisure.garden')) return 'garden';
    if (joined.includes('commercial.supermarket')) return 'supermarket';
    if (joined.includes('commercial.shopping_mall')) return 'mall';
    if (joined.includes('accommodation.')) return 'hotel';
    return categories[0].split('.').pop() || 'place';
}

async function fetchGeoapifyCandidates(
    rect: GeoRect,
): Promise<Venue[]> {
    if (!GEOAPIFY_API_KEY) {
        throw new Error('Missing VITE_GEOAPIFY_API_KEY');
    }

    if (Date.now() < _geoapifyCooldownUntil) {
        throw new Error('geoapify-cooldown');
    }

    const safeRect = normalizeRect(rect);
    const cacheKey = rectCacheKey(safeRect);
    const cached = _geoapifyCandidateCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const inflight = _geoapifyCandidateInflight.get(cacheKey);
    if (inflight) return inflight;

    const job = (async (): Promise<Venue[]> => {
        const params = new URLSearchParams({
            categories: [
                'catering.cafe',
                'catering.restaurant',
                'catering.bar',
                'leisure',
                'commercial.supermarket',
                'commercial.shopping_mall',
                'accommodation.hotel',
            ].join(','),
            filter: `rect:${safeRect.west.toFixed(6)},${safeRect.south.toFixed(6)},${safeRect.east.toFixed(6)},${safeRect.north.toFixed(6)}`,
            limit: '60',
            lang: getGeoapifyLanguage(),
            apiKey: GEOAPIFY_API_KEY,
        });

        const url = `${GEOAPIFY_ENDPOINT}?${params}`;
        const res = await withTimeout(fetch(url), 9000, 'geoapify');

        if (res.status === 429) {
            _geoapifyCooldownUntil = Date.now() + 20_000;
            throw new Error('geoapify-rate-limited');
        }
        if (res.status >= 500) {
            _geoapifyCooldownUntil = Date.now() + 12_000;
            throw new Error(`geoapify-${res.status}`);
        }
        if (!res.ok) {
            throw new Error(`geoapify-${res.status}`);
        }

        const payload = await res.json() as GeoapifyResponse;
        const mapped: Venue[] = [];

        for (const feature of payload.features ?? []) {
            const coords = feature.geometry?.coordinates;
            const props = feature.properties;
            if (!coords || coords.length < 2 || !props) continue;

            const lng = Number(coords[0]);
            const lat = Number(coords[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

            const category = categoryFromGeoapify(props.categories);
            const name = (props.name || props.datasource?.raw?.name || '').trim();
            if (!name) continue;

            mapped.push({
                id: `geo_${props.place_id || `${lat.toFixed(5)}_${lng.toFixed(5)}`}`,
                name,
                category,
                emoji: _getEmojiForAmenity(category),
                address: props.formatted || 'Nearby Spot',
                coordinates: { lat, lng },
                distanceKm: 0,
                etaMinutesFromYou: 0,
                etaMinutesFromPartner: 0,
            });
        }

        pruneCache(_geoapifyCandidateCache, GEOAPIFY_CANDIDATE_CACHE_MAX);
        _geoapifyCandidateCache.set(cacheKey, {
            expiry: Date.now() + GEOAPIFY_CANDIDATE_CACHE_TTL_MS,
            data: mapped,
        });

        return mapped;
    })();

    _geoapifyCandidateInflight.set(cacheKey, job);
    try {
        return await job;
    } finally {
        _geoapifyCandidateInflight.delete(cacheKey);
    }
}

async function collectVenueCandidatesProgressive(
    rectangles: GeoRect[],
    own: Coordinates,
    partner: Coordinates,
    targetCount = 18,
): Promise<{ venues: Venue[]; sourceHealthy: boolean }> {
    const merged: Venue[] = [];
    const seen = new Set<string>();
    let sourceHealthy = false;
    const ownPartnerDistanceKm = getDistance(own.lat, own.lng, partner.lat, partner.lng);
    const maxPerUserKm = Math.max(18, Math.min(80, ownPartnerDistanceKm * 0.9 + 10));

    for (const rect of rectangles) {
        try {
            const group = await fetchGeoapifyCandidates(rect);
            sourceHealthy = true;
            for (const venue of group) {
                if (!venue.name || !Number.isFinite(venue.coordinates.lat) || !Number.isFinite(venue.coordinates.lng)) continue;
                const key = makeVenueDedupeKey(venue.name, venue.coordinates.lat, venue.coordinates.lng);
                if (seen.has(key)) continue;

                const dYouKm = getDistance(own.lat, own.lng, venue.coordinates.lat, venue.coordinates.lng);
                const dPartnerKm = getDistance(partner.lat, partner.lng, venue.coordinates.lat, venue.coordinates.lng);
                if (Math.max(dYouKm, dPartnerKm) > maxPerUserKm) continue;

                seen.add(key);
                merged.push(venue);
            }
        } catch {
            // Progressive widening continues; source health controls hard error upstream.
        }

        if (merged.length >= targetCount) break;
    }

    return { venues: merged, sourceHealthy };
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