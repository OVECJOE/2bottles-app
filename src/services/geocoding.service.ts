/**
 * Geocoding service backed by Nominatim (OpenStreetMap).
 * No API key required. Rate-limited to 1 req/s per OSM policy.
 *
 * For production, swap the ENDPOINT to a self-hosted Nominatim
 * instance or a commercial provider (Geoapify, Maptiler, etc.)
 * to get higher rate limits and better coverage.
 */

const ENDPOINT = 'https://nominatim.openstreetmap.org';
const USER_AGENT = '2bottles-app/1.0';

import type { Venue } from '../types/venue.types.js';

export interface GeocodeSuggestion {
    placeId: string;
    displayName: string;
    shortName: string;
    lat: number;
    lng: number;
    type: string;
}

let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

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

/**
 * Autocomplete suggestions for a query string, debounced by default.
 * Pass `immediate: true` to skip debounce.
 */
export function geocodeAutocomplete(
    query: string,
    options: { debounceMs?: number; immediate?: boolean; countrycodes?: string } = {}
): Promise<GeocodeSuggestion[]> {
    return new Promise((resolve, reject) => {
        const run = async () => {
            if (!query.trim() || query.trim().length < 3) { resolve([]); return; }

            try {
                const params = new URLSearchParams({
                    q: query,
                    format: 'json',
                    addressdetails: '1',
                    limit: '6',
                    dedupe: '1',
                    ...(options.countrycodes ? { countrycodes: options.countrycodes } : {}),
                });

                const res = await fetch(`${ENDPOINT}/search?${params}`, {
                    headers: { 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
                });

                if (!res.ok) throw new Error(`Nominatim ${res.status}`);
                const data: NominatimResult[] = await res.json();
                resolve(data.map(nominatimToSuggestion));
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
    const params = new URLSearchParams({
        lat: String(lat), lon: String(lng),
        format: 'json', zoom: '16',
    });

    const res = await fetch(`${ENDPOINT}/reverse?${params}`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': USER_AGENT },
    });

    if (!res.ok) throw new Error(`Nominatim reverse ${res.status}`);
    const data = await res.json();
    const parts = (data.display_name as string).split(', ');
    return parts.slice(0, 3).join(', ');
}

/**
 * Fetch venues (cafes, bars, etc.) near a coordinate using Overpass API.
 */
export async function fetchVenues(lat: number, lng: number, radius = 1000): Promise<Venue[]> {
    const query = `
        [out:json][timeout:25];
        (
          node["amenity"~"cafe|bar|pub|restaurant"](around:${radius},${lat},${lng});
          way["amenity"~"cafe|bar|pub|restaurant"](around:${radius},${lat},${lng});
        );
        out body;
        >;
        out skel qt;
    `;

    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const data = await res.json();
        
        return data.elements
            .filter((el: any) => el.tags && el.tags.name)
            .map((el: any) => ({
                id: String(el.id),
                name: el.tags.name,
                category: el.tags.amenity,
                emoji: _getEmojiForAmenity(el.tags.amenity),
                address: el.tags['addr:street'] ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}` : 'Nearby',
                coordinates: { lat: el.lat || el.center?.lat, lng: el.lon || el.center?.lon },
                distanceKm: 0, // To be filled by store/component
                etaMinutesFromYou: 0,
                etaMinutesFromPartner: 0,
            }));
    } catch (err) {
        console.error('[GeocodingService] fetchVenues failed:', err);
        return [];
    }
}

function _getEmojiForAmenity(amenity: string): string {
    switch (amenity) {
        case 'cafe': return '☕';
        case 'bar': return '🍺';
        case 'pub': return '🍷';
        case 'restaurant': return '🍽';
        default: return '📍';
    }
}

/**
 * Haversine formula to calculate distance between two points in km.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}