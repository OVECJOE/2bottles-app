/**
 * <map-view> — full-screen MapLibre canvas used by every app flow.
 *
 * Responsibilities:
 *   render own/partner/destination pins and midpoint marker
 *   draw live route polylines and fit camera to active trip geometry
 *   emit lightweight map UI details (GPS badge + info card)
 */
import { LitElement, html } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { locationStore, uiStore } from '../store/index.js';
import { sessionStore } from '../store/index.js';
import type { Coordinates } from '../types/index.js';
import { reverseGeocode } from '../services/geocoding.service.js';

export const PIN_YOU = 'pin-you';
export const PIN_PARTNER = 'pin-partner';
export const PIN_DESTINATION = 'pin-destination';

const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244];
const DEFAULT_ZOOM = 13;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTING_ENDPOINT = (import.meta.env.VITE_ROUTING_ENDPOINT as string | undefined) || '/api/route';

const LAYER_YOU = 'layer-you';
const LAYER_PARTNER = 'layer-partner';
const LAYER_DESTINATION = 'layer-destination';

const SOURCE_YOU = 'source-you';
const SOURCE_PARTNER = 'source-partner';
const SOURCE_DESTINATION = 'source-destination';

const SOURCE_ROUTE_OWN = 'source-route-own';
const SOURCE_ROUTE_PARTNER = 'source-route-partner';
const SOURCE_ROUTE_SINGLE = 'source-route-single';

function readToken(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
}

function createPinImage(color: string, initials?: string): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    const surface = readToken('--color-sheet-bg-solid', '#fafcf8');
    ctx.beginPath();
    ctx.arc(32, 28, 22, 0, Math.PI * 2);
    ctx.fillStyle = surface;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.arc(32, 28, 18, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(32, 60);
    ctx.lineTo(22, 42);
    ctx.lineTo(42, 42);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // Canvas pin drawing uses simple arc + path primitives.
    // Reference: https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D
    if (initials) {
        ctx.fillStyle = surface;
        ctx.font = 'bold 18px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials.toUpperCase(), 32, 28);
    } else {
        ctx.beginPath();
        ctx.arc(32, 28, 6, 0, Math.PI * 2);
        ctx.fillStyle = surface;
        ctx.fill();
    }

    return ctx.getImageData(0, 0, 64, 64);
}

function createDestinationImage(emoji: string, color: string): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    ctx.moveTo(40, 78);
    ctx.bezierCurveTo(75, 40, 75, 10, 40, 10);
    ctx.bezierCurveTo(5, 10, 5, 40, 40, 78);
    ctx.fillStyle = color;
    ctx.fill();

    const surface = readToken('--color-sheet-bg-solid', '#fafcf8');
    ctx.strokeStyle = surface;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(40, 36, 22, 0, Math.PI * 2);
    ctx.fillStyle = surface;
    ctx.fill();

    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 40, 38);

    return ctx.getImageData(0, 0, 80, 80);
}

function makeMidpointEl(color: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
    position: relative; width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center;
  `;

    const ring = document.createElement('div');
    ring.style.cssText = `
    position: absolute; inset: 0; border-radius: 50%;
        border: 2px dashed ${color};
    animation: spin-slow 8s linear infinite;
  `;
    wrap.appendChild(ring);

    const dot = document.createElement('div');
    dot.style.cssText = `
    width: 10px; height: 10px; border-radius: 50%;
        background: ${color};
        box-shadow: 0 0 0 4px rgba(77,114,152,0.18);
  `;
    wrap.appendChild(dot);

    return wrap;
}

type InfoRow = { label: string; value: string };
type MapInfoCard = {
    title: string;
    subtitle?: string;
    rows: InfoRow[];
    loading?: boolean;
};

@customElement('map-view')
export class MapView extends LitElement {
    static createRenderRoot() { return this; }

    @state() private _infoCard: MapInfoCard | null = null;

    @query('#map-container')
    private _mapContainer!: HTMLDivElement;
    private _map: maplibregl.Map | null = null;
    private _midpointMarker: maplibregl.Marker | null = null;
    private _unsubLocation?: () => void;
    private _unsubSession?: () => void;
    private _unsubUI?: () => void;
    private _animId: number | null = null;
    private _hadPartner = false;
    private _hadDestination = false;
    private _handlers: Record<string, (e: any) => void> = {};
    private _routeCache = new Map<string, [number, number][]>();
    private _routeInflight = new Map<string, Promise<[number, number][]>>();
    private _infoRequestId = 0;
    private _followUser = false;
    private _routeMode: 'both' | 'mine' = 'both';
    private _lastFollowAt = 0;

    override connectedCallback() {
        super.connectedCallback();
        this._handlers = {
            'map-view:move-to': (e: any) => this._onMoveTo(e),
            'map-view:show-route': (e: any) => this._onShowRoute(e),
            'map-view:clear-route': () => this._onClearRoute(),
            'map-view:show-midpoint': (e: any) => this._onShowMidpoint(e),
            'map-view:clear-midpoint': () => this._onClearMidpoint(),
            'map-view:draw-tracking-routes': () => this._onDrawTracking(),
            'map-view:fit-tracking': () => this._onFitTracking(),
            'map-view:follow-user': (e: any) => this._onFollowUser(e),
            'map-view:route-mode': (e: any) => this._onRouteMode(e),
        };

        Object.entries(this._handlers).forEach(([evt, handler]) => {
            window.addEventListener(evt, handler as EventListener);
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubLocation?.();
        this._unsubSession?.();
        this._unsubUI?.();

        if (this._handlers) {
            Object.entries(this._handlers).forEach(([evt, handler]) => {
                window.removeEventListener(evt, handler as EventListener);
            });
        }

        if (this._animId) cancelAnimationFrame(this._animId);
        this._map?.remove();
        this._map = null;
    }

    override firstUpdated() {
        this._initMap();
    }

    private _initMap() {
        if (!this._mapContainer) return;

        this._map = new maplibregl.Map({
            container: this._mapContainer,
            style: MAP_STYLE,
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            attributionControl: false,
            pitchWithRotate: false,
        });

        this._map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
        this._map.once('load', () => this._onMapLoaded());
        this._map.on('error', (e) => {
            if (e.error?.message?.includes('Image') || e.error?.message?.includes('sprite')) return;
            console.warn('[MapView] Map error:', e.error);
        });
    }

    private _onMapLoaded() {
        this._applyBrandStyle();
        this._setupVectorLayers();

        this.dispatchEvent(new CustomEvent('map-view:ready', { bubbles: true, composed: true }));

        this._syncFromStore();

        if (locationStore.own) {
            this._flyTo(locationStore.own, 15, 600);
        }

        this._unsubLocation = locationStore.subscribe(() => this._syncFromStore());
        this._unsubSession = sessionStore.subscribe(() => this._syncDestinationLabel());
        this._unsubUI = uiStore.subscribe(() => {
            this._syncFromStore();
            if (uiStore.screen !== 'live-tracking' && uiStore.screen !== 'select-rendezvous' && uiStore.screen !== 'partner-agree-refuse' && uiStore.screen !== 'partner-notified') {
                this._clearRoute();
            }
        });
    }

    private _applyBrandStyle() {
        const map = this._map;
        if (!map) return;

        const p = (layer: string, prop: string, value: unknown) => {
            if (map.getLayer(layer)) { try { map.setPaintProperty(layer, prop, value); } catch { } }
        };

        p('background', 'background-color', readToken('--map-style-background', '#ede8e0'));
        p('landuse', 'fill-color', readToken('--map-style-land', '#e6e0d7'));
        p('landuse_overlay', 'fill-color', readToken('--map-style-land-overlay', '#ddd7ce'));
        p('park', 'fill-color', readToken('--map-style-park', '#cfd9c5'));
        p('landuse-park', 'fill-color', readToken('--map-style-park', '#cfd9c5'));
        p('grass', 'fill-color', readToken('--map-style-grass', '#d6dccf'));
        p('water', 'fill-color', readToken('--map-style-water', '#b8cfe0'));
        p('waterway', 'line-color', readToken('--map-style-water', '#b8cfe0'));
        p('road-motorway', 'line-color', readToken('--map-style-road-major', '#c8bfb0'));
        p('road-trunk', 'line-color', readToken('--map-style-road-major', '#c8bfb0'));
        p('road-primary', 'line-color', readToken('--map-style-road-primary', '#cdc5b8'));
        p('road-secondary', 'line-color', readToken('--map-style-road-secondary', '#d0c9bc'));
        p('road-tertiary', 'line-color', readToken('--map-style-road-tertiary', '#d5cfc4'));
        p('road-street', 'line-color', readToken('--map-style-road-street', '#dad4ca'));
        p('road-service', 'line-color', readToken('--map-style-road-service', '#dedad2'));
        p('road-path', 'line-color', readToken('--map-style-road-path', '#e2ddd6'));
        p('building', 'fill-color', readToken('--map-style-building', '#d8d2c8'));
        p('building', 'fill-opacity', 0.5);
        p('building-top', 'fill-color', readToken('--map-style-building-top', '#ddd8cf'));

        ['place-city', 'place-town', 'place-village', 'place-suburb', 'road-label', 'poi-label'].forEach(l => {
            p(l, 'text-color', readToken('--map-style-label', '#5a5248'));
            p(l, 'text-halo-color', readToken('--map-style-label-halo', 'rgba(237,232,224,0.85)'));
            p(l, 'text-halo-width', 1.2);
        });
    }

    private _syncFromStore() {
        if (!this._map) return;
        const { own, partner, destination } = locationStore;

        const hadPartner = this._hadPartner;
        const hadDestination = this._hadDestination;
        this._hadPartner = !!partner;
        this._hadDestination = !!destination;

        this._updateSource(SOURCE_YOU, own);
        this._updateSource(SOURCE_PARTNER, partner);
        this._updateSource(SOURCE_DESTINATION, destination);

        const screen = uiStore.screen;

        if ((partner && !hadPartner) || (destination && !hadDestination)) {
            this._onFitTracking();
        }

        if ((screen === 'live-tracking' || screen === 'select-rendezvous' || screen === 'partner-agree-refuse') && own && destination) {
            void this._drawTrackingRoutes(own, partner || undefined, destination);
        }

        if (screen === 'live-tracking' && own && this._followUser) {
            this._followOwnCamera(own);
        }
    }

    private _followOwnCamera(own: Coordinates) {
        if (!this._map) return;
        const now = Date.now();
        if (now - this._lastFollowAt < 1200) return;
        this._lastFollowAt = now;
        this._map.easeTo({
            center: [own.lng, own.lat],
            zoom: Math.max(this._map.getZoom(), 14),
            duration: 700,
            essential: true,
        });
    }

    private _updateSource(id: string, coords: Coordinates | null) {
        if (!this._map) return;
        const source = this._map.getSource(id) as maplibregl.GeoJSONSource;
        if (!source) return;

        if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
            source.setData({ type: 'FeatureCollection', features: [] });
            return;
        }

        source.setData({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
            properties: {}
        });
    }

    private _setupVectorLayers() {
        const map = this._map!;

        const youColor = readToken('--map-pin-you', '#4285f4');
        const partnerColor = readToken('--map-pin-partner', '#fbbc04');
        const destinationColor = readToken('--map-pin-destination', '#ea4335');

        map.addImage('pin-me', createPinImage(youColor, sessionStore.ownName?.charAt(0) || 'Y'));
        map.addImage('pin-partner', createPinImage(partnerColor, sessionStore.partnerName?.charAt(0) || 'P'));
        map.addImage('pin-destination', createDestinationImage(sessionStore.selectedVenue?.emoji || '📍', destinationColor));

        [SOURCE_YOU, SOURCE_PARTNER, SOURCE_DESTINATION].forEach(id => {
            if (!map.getSource(id)) {
                map.addSource(id, {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }
        });

        if (!map.getSource(SOURCE_ROUTE_OWN)) {
            map.addSource(SOURCE_ROUTE_OWN, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!map.getSource(SOURCE_ROUTE_PARTNER)) {
            map.addSource(SOURCE_ROUTE_PARTNER, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!map.getSource(SOURCE_ROUTE_SINGLE)) {
            map.addSource(SOURCE_ROUTE_SINGLE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }

        map.addLayer({
            id: 'pulse-you',
            type: 'circle',
            source: SOURCE_YOU,
            paint: {
                'circle-radius': 14,
                'circle-color': youColor,
                'circle-opacity': 0.4,
                'circle-stroke-width': 2,
                'circle-stroke-color': readToken('--color-sheet-bg-solid', '#fafcf8')
            }
        });

        map.addLayer({
            id: LAYER_YOU,
            type: 'symbol',
            source: SOURCE_YOU,
            layout: {
                'icon-image': 'pin-me',
                'icon-size': 0.6,
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true
            }
        });

        map.addLayer({
            id: 'pulse-partner',
            type: 'circle',
            source: SOURCE_PARTNER,
            paint: {
                'circle-radius': 14,
                'circle-color': partnerColor,
                'circle-opacity': 0.4,
                'circle-stroke-width': 2,
                'circle-stroke-color': readToken('--color-sheet-bg-solid', '#fafcf8')
            }
        });

        map.addLayer({
            id: LAYER_PARTNER,
            type: 'symbol',
            source: SOURCE_PARTNER,
            layout: {
                'icon-image': 'pin-partner',
                'icon-size': 0.6,
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true
            }
        });

        map.addLayer({
            id: LAYER_DESTINATION,
            type: 'symbol',
            source: SOURCE_DESTINATION,
            layout: {
                'icon-image': 'pin-destination',
                'icon-size': 0.6,
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true
            }
        });

        this._bindPinInteractions();
        this._syncFromStore();
        this._startPulseAnimation();
    }

    private _bindPinInteractions() {
        const map = this._map;
        if (!map) return;

        const bind = (layerId: string, onClick: () => void) => {
            map.on('click', layerId, () => onClick());
            map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        };

        bind(LAYER_YOU, () => this._openOwnInfo());
        bind(LAYER_PARTNER, () => this._openPartnerInfo());
        bind(LAYER_DESTINATION, () => this._openDestinationInfo());
    }

    private _startPulseAnimation() {
        if (this._animId) cancelAnimationFrame(this._animId);

        // The pulse is a simple sinusoidal oscillator so both radius and opacity
        // breathe smoothly instead of stepping frame-to-frame.
        // Math refresher: https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Math/sin
        const animate = () => {
            if (!this._map) return;
            const time = Date.now() / 1000;
            const radius = 12 + Math.sin(time * 3) * 4;
            const opacity = 0.4 - Math.sin(time * 3) * 0.2;

            if (this._map.getLayer('pulse-you')) {
                this._map.setPaintProperty('pulse-you', 'circle-radius', radius);
                this._map.setPaintProperty('pulse-you', 'circle-opacity', opacity);
            }
            if (this._map.getLayer('pulse-partner')) {
                this._map.setPaintProperty('pulse-partner', 'circle-radius', radius);
                this._map.setPaintProperty('pulse-partner', 'circle-opacity', opacity);
            }

            this._animId = requestAnimationFrame(animate);
        };
        animate();
    }

    private _syncDestinationLabel() {}

    private _showMidpoint(coords: Coordinates) {
        if (!this._map) return;
        if (this._midpointMarker) {
            this._midpointMarker.setLngLat([coords.lng, coords.lat]);
            return;
        }
        this._midpointMarker = new maplibregl.Marker({ element: makeMidpointEl(readToken('--map-poi-fallback', '#4D7298')), anchor: 'center' })
            .setLngLat([coords.lng, coords.lat])
            .addTo(this._map);
    }

    private _clearMidpoint() {
        this._midpointMarker?.remove();
        this._midpointMarker = null;
    }

    private _flyTo(coords: Coordinates, zoom = 15, duration = 1200) {
        this._map?.flyTo({ center: [coords.lng, coords.lat], zoom, duration, essential: true });
    }

    /**
     * Fit the viewport to show all provided points with padding.
     * Used by select-rendezvous (you+partner) and live-tracking (you+partner+dest).
      * Reference: MapLibre `cameraForBounds` behavior and padding options.
      * https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/#cameraforbounds
     */
    fitBounds(a: Coordinates, b: Coordinates, paddingPx = 100, c?: Coordinates) {
        if (!this._map) return;

        const lngs = [a.lng, b.lng];
        const lats = [a.lat, b.lat];
        if (c) {
            lngs.push(c.lng);
            lats.push(c.lat);
        }

        const validLngs = lngs.filter(l => typeof l === 'number' && !isNaN(l));
        const validLats = lats.filter(l => typeof l === 'number' && !isNaN(l));

        if (validLngs.length < 2 || validLats.length < 2) return;

        const bounds = new maplibregl.LngLatBounds(
            [Math.min(...validLngs), Math.min(...validLats)],
            [Math.max(...validLngs), Math.max(...validLats)]
        );

        const camera = this._map.cameraForBounds(bounds, { padding: paddingPx });

        const applyFit = () => {
            if (camera) {
                this._map?.flyTo({ ...camera, duration: 1500, essential: true });
            }
        };

        if (this._map.loaded()) {
            applyFit();
        } else {
            this._map.once('load', applyFit);
            applyFit();
        }
    }

    private _routeKey(a: Coordinates, b: Coordinates): string {
        return `${a.lat.toFixed(3)},${a.lng.toFixed(3)}->${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;
    }

    private _formatDistanceKm(meters: number | null): string {
        if (meters === null || meters < 0) return '--';
        return `${(meters / 1000).toFixed(1)} km`;
    }

    private _formatEta(minutes: number | null): string {
        if (minutes === null || minutes < 0) return '--';
        return `${Math.round(minutes)} min`;
    }

    private _formatArrival(minutes: number | null): string {
        if (minutes === null || minutes < 0) return '--';
        const at = new Date(Date.now() + minutes * 60_000);
        return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    private _setInfoCardWithPlace(
        title: string,
        coords: Coordinates | null,
        rows: InfoRow[],
        subtitle?: string,
    ) {
        const requestId = ++this._infoRequestId;
        this._infoCard = { title, subtitle, rows, loading: !!coords };

        if (!coords) return;

        reverseGeocode(coords.lat, coords.lng)
            .then((label) => {
                if (requestId !== this._infoRequestId || !this._infoCard) return;
                this._infoCard = {
                    ...this._infoCard,
                    rows: [...this._infoCard.rows, { label: 'Area', value: label }],
                    loading: false,
                };
            })
            .catch(() => {
                if (requestId !== this._infoRequestId || !this._infoCard) return;
                this._infoCard = {
                    ...this._infoCard,
                    loading: false,
                };
            });
    }

    private _openOwnInfo() {
        const own = locationStore.own;
        if (!own) return;
        this._setInfoCardWithPlace(
            'You',
            own,
            [
                { label: 'ETA to meetup', value: this._formatEta(locationStore.ownEtaMinutes) },
                { label: 'Distance', value: this._formatDistanceKm(locationStore.ownDistanceM) },
                { label: 'GPS accuracy', value: locationStore.accuracy ? `±${Math.round(locationStore.accuracy)} m` : '--' },
            ],
            'Live location',
        );
    }

    private _openPartnerInfo() {
        const partner = locationStore.partner;
        if (!partner) return;
        this._setInfoCardWithPlace(
            sessionStore.partnerName || 'Partner',
            partner,
            [
                { label: 'ETA to meetup', value: this._formatEta(locationStore.partnerEtaMinutes) },
                { label: 'Distance', value: this._formatDistanceKm(locationStore.partnerDistanceM) },
                { label: 'Status', value: sessionStore.partner?.status || 'en route' },
            ],
            'Shared location',
        );
    }

    private _openDestinationInfo() {
        const destination = locationStore.destination;
        if (!destination) return;

        const venue = sessionStore.selectedVenue;
        this._setInfoCardWithPlace(
            venue?.name || 'Meetup spot',
            destination,
            [
                { label: 'Type', value: venue?.category || 'place' },
                { label: 'Address', value: venue?.address || 'Loading area...' },
                { label: 'You arrive', value: this._formatArrival(locationStore.ownEtaMinutes) },
            ],
            'Destination',
        );
    }

    private async _fetchRoute(a: Coordinates, b: Coordinates): Promise<[number, number][]> {
        const key = this._routeKey(a, b);
        const cached = this._routeCache.get(key);
        if (cached && cached.length > 1) return cached;

        if (this._routeInflight.has(key)) {
            return this._routeInflight.get(key)!;
        }

        // Route requests are memoized by rounded coordinate key and de-duplicated
        // while in flight to avoid duplicate network calls during rapid GPS updates.
        // See fetch + Promise patterns: https://developer.mozilla.org/docs/Web/API/Fetch_API
        const promise = (async () => {
            const params = new URLSearchParams({
                overview: 'full',
                geometries: 'geojson',
                steps: 'false',
            });
            const from = `${a.lng},${a.lat}`;
            const to = `${b.lng},${b.lat}`;
            const url = `${ROUTING_ENDPOINT}/route/v1/driving/${from};${to}?${params}`;

            const res = await fetch(url);
            if (!res.ok) throw new Error(`route ${res.status}`);
            const data = await res.json() as {
                routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
            };
            const coords = data.routes?.[0]?.geometry?.coordinates;
            if (!coords || coords.length < 2) throw new Error('route-missing-geometry');

            this._routeCache.set(key, coords);
            return coords;
        })().finally(() => {
            this._routeInflight.delete(key);
        });

        this._routeInflight.set(key, promise);
        return promise;
    }

    private async _drawTrackingRoutes(you: Coordinates, partner: Coordinates | undefined, dest: Coordinates) {
        const map = this._map;
        if (!map) return;

        let youLine: [number, number][] = [[you.lng, you.lat], [dest.lng, dest.lat]];
        try {
            youLine = await this._fetchRoute(you, dest);
        } catch {
        }
        this._setLineSource(SOURCE_ROUTE_OWN, youLine, readToken('--map-pin-you', '#4285f4'), true);

        if (partner && this._routeMode === 'both') {
            let partnerLine: [number, number][] = [[partner.lng, partner.lat], [dest.lng, dest.lat]];
            try {
                partnerLine = await this._fetchRoute(partner, dest);
            } catch {
            }
            this._setLineSource(SOURCE_ROUTE_PARTNER, partnerLine, readToken('--map-pin-partner', '#fbbc04'), true);
        } else {
            this._removeLineSource(SOURCE_ROUTE_PARTNER);
        }
    }

    private _removeLineSource(id: string) {
        const map = this._map;
        if (!map) return;
        const casingLyr = `${id}-casing-layer`;
        const lyr = `${id}-layer`;
        if (map.getLayer(lyr)) map.removeLayer(lyr);
        if (map.getLayer(casingLyr)) map.removeLayer(casingLyr);
        if (map.getSource(id)) map.removeSource(id);
    }

    private _setLineSource(id: string, coords: [number, number][], color: string, dashed: boolean) {
        const map = this._map;
        if (!map) return;

        const data: GeoJSON.Feature<GeoJSON.LineString> = {
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: coords },
        };

        const casingLyr = `${id}-casing-layer`;
        const lyr = `${id}-layer`;

        if (map.getSource(id)) {
            (map.getSource(id) as maplibregl.GeoJSONSource).setData(data);
        } else {
            map.addSource(id, { type: 'geojson', data });
        }

        if (!map.getLayer(casingLyr)) {
            map.addLayer({
                id: casingLyr, type: 'line', source: id,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': readToken('--color-sheet-bg-solid', '#fafcf8'), 'line-width': 6, 'line-opacity': 0.55 },
            });
        }

        if (!map.getLayer(lyr)) {
            map.addLayer({
                id: lyr, type: 'line', source: id,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': color,
                    'line-width': 3,
                    ...(dashed ? { 'line-dasharray': [2, 2] } : {}),
                    'line-opacity': 0.9,
                },
            });
        }
    }

    private _drawRoute(coordinates: [number, number][]) {
        this._setLineSource(SOURCE_ROUTE_SINGLE, coordinates, readToken('--map-poi-fallback', '#4D7298'), true);
    }

    private _clearRoute() {
        const map = this._map;
        if (!map) return;

        [SOURCE_ROUTE_OWN, SOURCE_ROUTE_PARTNER, SOURCE_ROUTE_SINGLE].forEach(s => {
            this._removeLineSource(s);
        });
    }

    private _onMoveTo = (e: CustomEvent<{ coords: Coordinates; zoom?: number }>) => {
        this._flyTo(e.detail.coords, e.detail.zoom ?? 15);
    };

    private _onShowRoute = (e: CustomEvent<{ coordinates: [number, number][] }>) => {
        this._drawRoute(e.detail.coordinates);
    };

    private _onClearRoute = () => { this._clearRoute(); };

    private _onShowMidpoint = (e: CustomEvent<{ coords: Coordinates }>) => {
        this._showMidpoint(e.detail.coords);
    };

    private _onClearMidpoint = () => { this._clearMidpoint(); };

    private _onDrawTracking = () => {
        const { own, partner, destination } = locationStore;
        if (own && destination) {
            void this._drawTrackingRoutes(own, partner || undefined, destination);
        }
    };

    private _onFitTracking = () => {
        const { own, partner, destination } = locationStore;
        if (own && destination) {
            this.fitBounds(own, destination, 100, this._routeMode === 'both' ? (partner ?? undefined) : undefined);
        }
    };

    private _onFollowUser = (e: CustomEvent<{ enabled: boolean }>) => {
        this._followUser = !!e.detail?.enabled;
        const own = locationStore.own;
        if (this._followUser && own) {
            this._followOwnCamera(own);
        }
    };

    private _onRouteMode = (e: CustomEvent<{ mode: 'both' | 'mine' }>) => {
        const mode = e.detail?.mode;
        this._routeMode = mode === 'mine' ? 'mine' : 'both';
        const { own, partner, destination } = locationStore;
        if (own && destination) {
            void this._drawTrackingRoutes(own, partner ?? undefined, destination);
            this._onFitTracking();
        }
    };

    override render() {
        const acc = locationStore.accuracy;
        const watching = locationStore.isWatching;
        const screen = uiStore.screen;

        const showStatus = [
            'select-rendezvous',
            'partner-agree-refuse',
            'live-tracking',
            'partner-notified'
        ].includes(screen);

        return html`
            <div id="map-container" style="width:100%;height:100%;"></div>
            
            ${showStatus ? html`
                <div class="map-overlay-top">
                    ${watching ? html`
                        <div class="gps-status ${!acc ? 'locating' : acc > 50 ? 'poor' : 'good'}">
                            <span class="gps-dot"></span>
                            ${acc ? `GPS ±${Math.round(acc)}m` : 'Locating...'}
                        </div>
                    ` : locationStore.isCoolingOff ? html`
                        <div class="gps-status error retry">
                            <span class="gps-dot"></span> Signal Lost. Retrying soon...
                        </div>
                    ` : locationStore.lastErrorCode ? html`
                        <div class="gps-status error">
                            <span class="gps-dot"></span> GPS: ${locationStore.getErrorExplanation()}
                        </div>
                    ` : html`
                        <div class="gps-status offline">
                            <span class="gps-dot"></span> GPS Offline
                        </div>
                    `}
                </div>
            ` : ''}

            ${this._infoCard ? html`
                <div class="map-info-sheet" role="region" aria-label="Map details" aria-live="polite">
                    <div class="map-info-head">
                        <div>
                            <div class="map-info-title">${this._infoCard.title}</div>
                            ${this._infoCard.subtitle ? html`<div class="map-info-sub">${this._infoCard.subtitle}</div>` : ''}
                        </div>
                        <button class="map-info-close" @click=${() => { this._infoCard = null; }} aria-label="Close">✕</button>
                    </div>
                    <div class="map-info-body">
                        ${this._infoCard.rows.map((row) => html`
                            <div class="map-info-row">
                                <span>${row.label}</span>
                                <strong>${row.value}</strong>
                            </div>
                        `)}
                        ${this._infoCard.loading ? html`<div class="map-info-loading">Loading area details...</div>` : ''}
                    </div>
                </div>
            ` : ''}

            <style>
                .map-overlay-top {
                    position: absolute; top: var(--space-2); left: var(--space-4);
                    z-index: var(--z-topbar); pointer-events: none;
                }
                .gps-status {
                    display: flex; align-items: center; gap: var(--space-2);
                    background: var(--color-surface); padding: 4px 12px;
                    border-radius: var(--border-radius-pill); font-size: 11px;
                    font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    color: var(--color-text-primary);
                    border: 1px solid var(--glass-border);
                    backdrop-filter: blur(10px) saturate(130%);
                    -webkit-backdrop-filter: blur(10px) saturate(130%);
                }
                .gps-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-disabled-bg); }
                .gps-status.good .gps-dot { background: var(--color-online); }
                .gps-status.poor .gps-dot { background: var(--map-pin-partner); }
                .gps-status.offline .gps-dot { background: var(--color-offline); }
                .gps-status.error .gps-dot { background: var(--danger-500); }
                .gps-status.retry .gps-dot { 
                    background: var(--map-pin-partner);
                    animation: pulse-signal 1.5s ease-in-out infinite;
                }

                .map-info-sheet {
                    position: absolute;
                    top: calc(var(--map-status-bar-height) + var(--space-3));
                    left: var(--space-3);
                    right: auto;
                    width: min(360px, calc(100vw - (2 * var(--space-3))));
                    z-index: var(--z-modal);
                    background: var(--color-sheet-bg);
                    border-radius: var(--border-radius-lg);
                    box-shadow: var(--shadow-lg), var(--glass-shadow);
                    border: 1px solid var(--glass-border);
                    backdrop-filter: blur(14px) saturate(135%);
                    -webkit-backdrop-filter: blur(14px) saturate(135%);
                    padding: var(--space-3);
                    transform-origin: top left;
                    animation: map-info-pop 180ms var(--ease-out) both;
                }

                .map-info-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: var(--space-3);
                }

                .map-info-title {
                    font-size: var(--text-md);
                    font-weight: var(--weight-bold);
                    color: var(--color-text-primary);
                }

                .map-info-sub {
                    margin-top: 2px;
                    font-size: var(--text-xs);
                    color: var(--color-text-muted);
                }

                .map-info-close {
                    border: none;
                    background: transparent;
                    color: var(--color-text-muted);
                    font-size: 14px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }

                .map-info-body {
                    margin-top: var(--space-2);
                    display: flex;
                    flex-direction: column;
                    gap: var(--space-1);
                }

                .map-info-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: var(--space-3);
                    font-size: var(--text-sm);
                    color: var(--color-text-secondary);
                }

                .map-info-row strong {
                    color: var(--color-text-primary);
                    font-weight: var(--weight-medium);
                }

                .map-info-loading {
                    font-size: var(--text-xs);
                    color: var(--color-text-muted);
                    margin-top: var(--space-1);
                }

                @media (max-width: 760px) {
                    .map-info-sheet {
                        top: calc(var(--map-status-bar-height) + var(--space-2));
                        left: var(--space-2);
                        right: var(--space-2);
                        width: auto;
                        border-radius: var(--border-radius-md);
                    }
                }

                @media (min-width: 1024px) {
                    .map-info-sheet {
                        width: min(380px, calc(100vw - (2 * var(--space-4))));
                        top: calc(var(--map-status-bar-height) + var(--space-4));
                        left: var(--space-4);
                    }
                }

                @keyframes map-info-pop {
                    from {
                        opacity: 0;
                        transform: translateY(-6px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                @keyframes pulse-ring-premium {
                    0% { transform: scale(0.6); opacity: 0; }
                    50% { opacity: 0.4; }
                    100% { transform: scale(1.6); opacity: 0; }
                }

                @keyframes pulse-signal {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }

                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'map-view': MapView; }
}