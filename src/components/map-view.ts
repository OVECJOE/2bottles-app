import { LitElement, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { locationStore, uiStore } from '../store/index.js';
import { sessionStore } from '../store/index.js';
import type { Coordinates } from '../types/index.js';

export const PIN_YOU = 'pin-you';
export const PIN_PARTNER = 'pin-partner';
export const PIN_DESTINATION = 'pin-destination';

const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244];
const DEFAULT_ZOOM = 13;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTING_ENDPOINT = (import.meta.env.VITE_ROUTING_ENDPOINT as string | undefined) || '/api/route';

// Layer IDs
const LAYER_YOU = 'layer-you';
const LAYER_PARTNER = 'layer-partner';
const LAYER_DESTINATION = 'layer-destination';

// Source IDs
const SOURCE_YOU = 'source-you';
const SOURCE_PARTNER = 'source-partner';
const SOURCE_DESTINATION = 'source-destination';

const SOURCE_ROUTE_OWN = 'source-route-own';
const SOURCE_ROUTE_PARTNER = 'source-route-partner';
const SOURCE_ROUTE_SINGLE = 'source-route-single';

// ---------------------------------------------------------------------------
// Procedural Icon Generation
// ---------------------------------------------------------------------------

function createPinImage(color: string, initials?: string): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Outer circle
    ctx.beginPath();
    ctx.arc(32, 28, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Inner circle (colored)
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.beginPath();
    ctx.arc(32, 28, 18, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Pin tip
    ctx.beginPath();
    ctx.moveTo(32, 60);
    ctx.lineTo(22, 42);
    ctx.lineTo(42, 42);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    // White center dot or initials
    if (initials) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initials.toUpperCase(), 32, 28);
    } else {
        ctx.beginPath();
        ctx.arc(32, 28, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    return ctx.getImageData(0, 0, 64, 64);
}

function createDestinationImage(emoji: string): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;

    // Pin shape
    ctx.beginPath();
    ctx.moveTo(40, 78);
    ctx.bezierCurveTo(75, 40, 75, 10, 40, 10);
    ctx.bezierCurveTo(5, 10, 5, 40, 40, 78);
    ctx.fillStyle = '#ea4335';
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // White circle for icon
    ctx.beginPath();
    ctx.arc(40, 36, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Emoji
    ctx.font = '32px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 40, 38);

    return ctx.getImageData(0, 0, 80, 80);
}

function createFallbackPoiImage(): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    ctx.beginPath();
    ctx.arc(24, 24, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#4D7298';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(24, 24, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    return ctx.getImageData(0, 0, 48, 48);
}

function makeMidpointEl(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
    position: relative; width: 48px; height: 48px;
    display: flex; align-items: center; justify-content: center;
  `;

    const ring = document.createElement('div');
    ring.style.cssText = `
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px dashed rgba(77,114,152,0.7);
    animation: spin-slow 8s linear infinite;
  `;
    wrap.appendChild(ring);

    const dot = document.createElement('div');
    dot.style.cssText = `
    width: 10px; height: 10px; border-radius: 50%;
    background: #4D7298;
    box-shadow: 0 0 0 4px rgba(77,114,152,0.18);
  `;
    wrap.appendChild(dot);

    return wrap;
}

function makeEtaChipEl(tone: 'you' | 'partner', minutes: number): HTMLElement {
    const el = document.createElement('div');
    const bg = tone === 'you' ? '#4285f4' : '#fbbc04';
    const fg = tone === 'you' ? '#ffffff' : '#1a1f29';
    el.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:6px',
        'padding:6px 10px',
        'border-radius:999px',
        `background:${bg}`,
        `color:${fg}`,
        'font:700 11px "DM Sans", sans-serif',
        'box-shadow:0 4px 12px rgba(0,0,0,0.2)',
        'border:1px solid rgba(255,255,255,0.55)',
        'pointer-events:none',
        'white-space:nowrap',
    ].join(';');
    el.textContent = `${minutes} min`;
    return el;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@customElement('map-view')
export class MapView extends LitElement {
    static createRenderRoot() { return this; }

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
    private _ownEtaMarker: maplibregl.Marker | null = null;
    private _partnerEtaMarker: maplibregl.Marker | null = null;

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
        this._clearEtaMarkers();
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

        this._map.on('styleimagemissing', (e: any) => {
            const missingId = e?.id;
            if (!missingId || this._map?.hasImage(missingId)) return;
            try {
                this._map?.addImage(missingId, createFallbackPoiImage());
            } catch {
                // Ignore duplicate/add race.
            }
        });
    }

    private _onMapLoaded() {
        this._applyBrandStyle();
        this._setupVectorLayers();

        this.dispatchEvent(new CustomEvent('map-view:ready', { bubbles: true, composed: true }));

        // Sync everything immediately on load
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

    // ---------------------------------------------------------------------------
    // Brand style
    // ---------------------------------------------------------------------------

    private _applyBrandStyle() {
        const map = this._map;
        if (!map) return;

        const p = (layer: string, prop: string, value: unknown) => {
            if (map.getLayer(layer)) { try { map.setPaintProperty(layer, prop, value); } catch { } }
        };

        p('background', 'background-color', '#ede8e0');
        p('landuse', 'fill-color', '#e6e0d7');
        p('landuse_overlay', 'fill-color', '#ddd7ce');
        p('park', 'fill-color', '#cfd9c5');
        p('landuse-park', 'fill-color', '#cfd9c5');
        p('grass', 'fill-color', '#d6dccf');
        p('water', 'fill-color', '#b8cfe0');
        p('waterway', 'line-color', '#b8cfe0');
        p('road-motorway', 'line-color', '#c8bfb0');
        p('road-trunk', 'line-color', '#c8bfb0');
        p('road-primary', 'line-color', '#cdc5b8');
        p('road-secondary', 'line-color', '#d0c9bc');
        p('road-tertiary', 'line-color', '#d5cfc4');
        p('road-street', 'line-color', '#dad4ca');
        p('road-service', 'line-color', '#dedad2');
        p('road-path', 'line-color', '#e2ddd6');
        p('building', 'fill-color', '#d8d2c8');
        p('building', 'fill-opacity', 0.5);
        p('building-top', 'fill-color', '#ddd8cf');

        ['place-city', 'place-town', 'place-village', 'place-suburb', 'road-label', 'poi-label'].forEach(l => {
            p(l, 'text-color', '#5a5248');
            p(l, 'text-halo-color', 'rgba(237,232,224,0.85)');
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

        // Auto-fit if we just got a partner or destination
        if ((partner && !hadPartner) || (destination && !hadDestination)) {
            this._onFitTracking();
        }

        if ((screen === 'live-tracking' || screen === 'select-rendezvous' || screen === 'partner-agree-refuse') && own && destination) {
            void this._drawTrackingRoutes(own, partner || undefined, destination);
        }
    }

    private _updateSource(id: string, coords: Coordinates | null) {
        if (!this._map) return;
        const source = this._map.getSource(id) as maplibregl.GeoJSONSource;
        if (!source) return;

        if (!coords) {
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

        // Add pins images
        map.addImage('pin-me', createPinImage('#4285f4', sessionStore.ownName?.charAt(0) || 'Y'));
        map.addImage('pin-partner', createPinImage('#fbbc04', sessionStore.partnerName?.charAt(0) || 'P'));
        map.addImage('pin-destination', createDestinationImage(sessionStore.selectedVenue?.emoji || '📍'));

        // Add pins sources
        [SOURCE_YOU, SOURCE_PARTNER, SOURCE_DESTINATION].forEach(id => {
            if (!map.getSource(id)) {
                map.addSource(id, {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });
            }
        });

        // Add route sources
        if (!map.getSource(SOURCE_ROUTE_OWN)) {
            map.addSource(SOURCE_ROUTE_OWN, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!map.getSource(SOURCE_ROUTE_PARTNER)) {
            map.addSource(SOURCE_ROUTE_PARTNER, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }
        if (!map.getSource(SOURCE_ROUTE_SINGLE)) {
            map.addSource(SOURCE_ROUTE_SINGLE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        }

        // Pulse layer for You
        map.addLayer({
            id: 'pulse-you',
            type: 'circle',
            source: SOURCE_YOU,
            paint: {
                'circle-radius': 14,
                'circle-color': '#4285f4',
                'circle-opacity': 0.4,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        // Layer for You
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

        // Pulse layer for Partner
        map.addLayer({
            id: 'pulse-partner',
            type: 'circle',
            source: SOURCE_PARTNER,
            paint: {
                'circle-radius': 14,
                'circle-color': '#fbbc04',
                'circle-opacity': 0.4,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff'
            }
        });

        // Layer for Partner
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

        // Layer for Destination
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

        // Sync again once images/layers are ready
        this._syncFromStore();
        this._startPulseAnimation();
    }

    private _startPulseAnimation() {
        if (this._animId) cancelAnimationFrame(this._animId);

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

    private _syncDestinationLabel() {
        // This function is no longer relevant for vector pins.
        // Labels for vector pins would require a separate symbol layer or custom rendering.
        // For now, we'll keep it empty or remove it if labels are not needed for vector pins.
    }


    // ---------------------------------------------------------------------------
    // Midpoint marker
    // ---------------------------------------------------------------------------

    private _showMidpoint(coords: Coordinates) {
        if (!this._map) return;
        if (this._midpointMarker) {
            this._midpointMarker.setLngLat([coords.lng, coords.lat]);
            return;
        }
        this._midpointMarker = new maplibregl.Marker({ element: makeMidpointEl(), anchor: 'center' })
            .setLngLat([coords.lng, coords.lat])
            .addTo(this._map);
    }

    private _clearMidpoint() {
        this._midpointMarker?.remove();
        this._midpointMarker = null;
    }

    // ---------------------------------------------------------------------------
    // Camera
    // ---------------------------------------------------------------------------

    private _flyTo(coords: Coordinates, zoom = 15, duration = 1200) {
        this._map?.flyTo({ center: [coords.lng, coords.lat], zoom, duration, essential: true });
    }

    /**
     * Fit the viewport to show all provided points with padding.
     * Used by select-rendezvous (you+partner) and live-tracking (you+partner+dest).
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

    // ---------------------------------------------------------------------------
    // Route lines
    // ---------------------------------------------------------------------------

    private _routeKey(a: Coordinates, b: Coordinates): string {
        return `${a.lat.toFixed(3)},${a.lng.toFixed(3)}->${b.lat.toFixed(3)},${b.lng.toFixed(3)}`;
    }

    private _routeMidpoint(coords: [number, number][]): [number, number] | null {
        if (!coords.length) return null;
        return coords[Math.floor(coords.length / 2)] ?? null;
    }

    private _updateEtaMarker(
        marker: maplibregl.Marker | null,
        tone: 'you' | 'partner',
        minutes: number | null,
        point: [number, number] | null,
    ): maplibregl.Marker | null {
        if (!this._map || minutes === null || minutes < 0 || !point) {
            marker?.remove();
            return null;
        }

        if (!marker) {
            marker = new maplibregl.Marker({
                element: makeEtaChipEl(tone, minutes),
                anchor: 'center',
            })
                .setLngLat(point)
                .addTo(this._map);
            return marker;
        }

        marker.setLngLat(point);
        marker.getElement().textContent = `${minutes} min`;
        return marker;
    }

    private _clearEtaMarkers() {
        this._ownEtaMarker?.remove();
        this._partnerEtaMarker?.remove();
        this._ownEtaMarker = null;
        this._partnerEtaMarker = null;
    }

    private async _fetchRoute(a: Coordinates, b: Coordinates): Promise<[number, number][]> {
        const key = this._routeKey(a, b);
        const cached = this._routeCache.get(key);
        if (cached && cached.length > 1) return cached;

        if (this._routeInflight.has(key)) {
            return this._routeInflight.get(key)!;
        }

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
        this._setLineSource(SOURCE_ROUTE_OWN, youLine, '#4285f4', true);
        this._ownEtaMarker = this._updateEtaMarker(
            this._ownEtaMarker,
            'you',
            locationStore.ownEtaMinutes,
            this._routeMidpoint(youLine),
        );

        if (partner) {
            let partnerLine: [number, number][] = [[partner.lng, partner.lat], [dest.lng, dest.lat]];
            try {
                partnerLine = await this._fetchRoute(partner, dest);
            } catch {
            }
            this._setLineSource(SOURCE_ROUTE_PARTNER, partnerLine, '#fbbc04', true);
            this._partnerEtaMarker = this._updateEtaMarker(
                this._partnerEtaMarker,
                'partner',
                locationStore.partnerEtaMinutes,
                this._routeMidpoint(partnerLine),
            );
        } else {
            this._removeLineSource(SOURCE_ROUTE_PARTNER);
            this._partnerEtaMarker = this._updateEtaMarker(this._partnerEtaMarker, 'partner', null, null);
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

        // White casing underneath for legibility
        if (!map.getLayer(casingLyr)) {
            map.addLayer({
                id: casingLyr, type: 'line', source: id,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.55 },
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
        this._setLineSource(SOURCE_ROUTE_SINGLE, coordinates, '#4D7298', true);
    }

    private _clearRoute() {
        const map = this._map;
        if (!map) return;

        [SOURCE_ROUTE_OWN, SOURCE_ROUTE_PARTNER, SOURCE_ROUTE_SINGLE].forEach(s => {
            this._removeLineSource(s);
        });
        this._clearEtaMarkers();
    }

    // ---------------------------------------------------------------------------
    // Event handlers
    // ---------------------------------------------------------------------------

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
            this.fitBounds(own, destination, 100, partner ?? undefined);
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

            <style>
                .map-overlay-top {
                    position: absolute; top: var(--space-2); left: var(--space-4);
                    z-index: var(--z-topbar); pointer-events: none;
                }
                .gps-status {
                    display: flex; align-items: center; gap: var(--space-2);
                    background: rgba(255,255,255,0.9); padding: 4px 12px;
                    border-radius: var(--border-radius-pill); font-size: 11px;
                    font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    color: var(--color-text-primary);
                    border: 1px solid rgba(0,0,0,0.05);
                }
                .gps-dot { width: 8px; height: 8px; border-radius: 50%; background: #ccc; }
                .gps-status.good .gps-dot { background: #34a853; }
                .gps-status.poor .gps-dot { background: #fbbc04; }
                .gps-status.offline .gps-dot { background: #5f6368; }
                .gps-status.error .gps-dot { background: #ea4335; }
                .gps-status.retry .gps-dot { 
                    background: #fbbc04;
                    animation: pulse-signal 1.5s ease-in-out infinite;
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