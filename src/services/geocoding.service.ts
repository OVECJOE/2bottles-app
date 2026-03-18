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
const _photonCache = new Map<string, { expiry: number; data: PhotonResult[] }>();
const _reverseCache = new Map<string, { expiry: number; label: string }>();
const _reverseInflight = new Map<string, Promise<string>>();
let _reverseCooldownUntil = 0;
let _nominatimHardCooldownUntil = 0;
const _venueSuggestionCache = new Map<string, { expiry: number; data: Venue[] }>();
const _geoapifyCandidateCache = new Map<string, { expiry: number; data: Venue[] }>();
let _geoapifyCooldownUntil = 0;
const _routeMetricsCache = new Map<string, { expiry: number; data: RouteMetrics }>();

interface RouteMetrics {
    minutes: number;
    distanceKm: number;
}

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
 * Fetch venues near a coordinate using progressive multi-source discovery.
 */
export async function fetchVenues(lat: number, lng: number, radius = 3000): Promise<Venue[]> {
    const center = { lat, lng };
    const radiusM = Math.max(900, Math.min(12000, Math.round(radius)));
    const result = await collectVenueCandidatesProgressive(center, [radiusM]);
    return result.venues.filter((v) => getDistance(lat, lng, v.coordinates.lat, v.coordinates.lng) <= radiusM / 1000);
}

export async function suggestMeetupVenues(input: MeetupSuggestionInput): Promise<Venue[]> {
    const { own, partner, midpoint } = input;
    const maxResults = Math.max(3, Math.min(input.maxResults ?? 10, 10));
    const cacheKey = makeSuggestionCacheKey(input, maxResults);
    const now = Date.now();
    const cached = _venueSuggestionCache.get(cacheKey);
    if (cached && cached.expiry > now) return cached.data;

    const candidateRadiiM = [1200, 2500, 4500, 7000];
    const candidateResult = await collectVenueCandidatesProgressive(midpoint, candidateRadiiM);
    if (!candidateResult.sourceHealthy) {
        throw new Error('Venue providers are currently unavailable. Please retry.');
    }
    const candidates = candidateResult.venues;
    if (candidates.length === 0) return [];

    const coarse = candidates
        .map((venue) => {
            const dYouKm = getDistance(own.lat, own.lng, venue.coordinates.lat, venue.coordinates.lng);
            const dPartnerKm = getDistance(partner.lat, partner.lng, venue.coordinates.lat, venue.coordinates.lng);
            const dMidKm = getDistance(midpoint.lat, midpoint.lng, venue.coordinates.lat, venue.coordinates.lng);
            const etaYou = etaFromDistanceKm(dYouKm);
            const etaPartner = etaFromDistanceKm(dPartnerKm);
            const fairnessGap = Math.abs(etaYou - etaPartner);

            const score =
                120
                - fairnessGap * 2.9
                - (etaYou + etaPartner) * 0.35
                - Math.min(60, dMidKm * 7)
                + (/cafe|restaurant|park|garden|pub|bar/.test(venue.category || '') ? 6 : 0)
                + (venue.address && venue.address !== 'Nearby Spot' ? 3 : 0);

            return {
                venue,
                dYouKm,
                dPartnerKm,
                dMidKm,
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
            - Math.min(65, entry.dMidKm * 7.2)
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
            dMidKm: entry.dMidKm,
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
        dMidKm: entry.dMidKm,
    }));

    const allScored = [...refined, ...roughTail].sort((a, b) => b.score - a.score);
    const balanced = allScored.filter((x) => x.fairnessGap <= 16 && x.dMidKm <= 12);
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

    _venueSuggestionCache.set(cacheKey, {
        expiry: Date.now() + VENUE_SUGGESTION_CACHE_TTL_MS,
        data: finalList,
    });

    return finalList;
}

function quantizeCoord(value: number, precision = 3): string {
    return value.toFixed(precision);
}

function makeSuggestionCacheKey(input: MeetupSuggestionInput, maxResults: number): string {
    return [
        quantizeCoord(input.midpoint.lat),
        quantizeCoord(input.midpoint.lng),
        String(maxResults),
    ].join('|');
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
        if (!route?.duration || !route?.distance) return null;

        const metrics: RouteMetrics = {
            minutes: route.duration / 60,
            distanceKm: route.distance / 1000,
        };

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
    center: { lat: number; lng: number },
    radiusM: number,
): Promise<Venue[]> {
    if (!GEOAPIFY_API_KEY) {
        throw new Error('Missing VITE_GEOAPIFY_API_KEY');
    }

    if (Date.now() < _geoapifyCooldownUntil) {
        throw new Error('geoapify-cooldown');
    }

    const radius = Math.max(800, Math.min(20000, Math.round(radiusM)));
    const cacheKey = `${center.lat.toFixed(3)}|${center.lng.toFixed(3)}|${radius}`;
    const cached = _geoapifyCandidateCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) return cached.data;

    const params = new URLSearchParams({
        categories: [
            'catering.cafe',
            'catering.restaurant',
            'catering.bar',
            'leisure.park',
            'leisure.garden',
            'commercial.supermarket',
            'commercial.shopping_mall',
            'accommodation.hotel',
        ].join(','),
        filter: `circle:${center.lng},${center.lat},${radius}`,
        bias: `proximity:${center.lng},${center.lat}`,
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

    _geoapifyCandidateCache.set(cacheKey, {
        expiry: Date.now() + GEOAPIFY_CANDIDATE_CACHE_TTL_MS,
        data: mapped,
    });

    return mapped;
}

async function collectVenueCandidatesProgressive(
    center: { lat: number; lng: number },
    radiiMeters: number[],
): Promise<{ venues: Venue[]; sourceHealthy: boolean }> {
    const merged: Venue[] = [];
    const seen = new Set<string>();
    let sourceHealthy = false;

    for (const radiusM of radiiMeters) {
        try {
            const group = await fetchGeoapifyCandidates(center, radiusM);
            sourceHealthy = true;
            for (const venue of group) {
                if (!venue.name || !Number.isFinite(venue.coordinates.lat) || !Number.isFinite(venue.coordinates.lng)) continue;
                const key = makeVenueDedupeKey(venue.name, venue.coordinates.lat, venue.coordinates.lng);
                if (seen.has(key)) continue;

                const dMidKm = getDistance(center.lat, center.lng, venue.coordinates.lat, venue.coordinates.lng);
                if (dMidKm > Math.max(3.5, (radiusM / 1000) * 1.85)) continue;

                seen.add(key);
                merged.push(venue);
            }
        } catch {
            // Progressive widening continues; source health controls hard error upstream.
        }

        if (merged.length >= 28) break;
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