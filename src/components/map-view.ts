// =============================================================
// 2bottles — <map-view>
//
// The map IS the product. This component is the persistent,
// always-alive canvas that everything else floats on top of.
//
// Design intent:
//   - Muted, desaturated base map so brand colours pop
//   - Pins feel organic: pulse rings, label chips, smooth moves
//   - Midpoint marker (dashed ring) signals the calculation moment
//   - Camera choreography: fitBounds shows the full picture,
//     flyTo zooms into moments of arrival
//
// Sibling components command the map via bubbling CustomEvents:
//   map-view:move-to    { coords, zoom? }
//   map-view:add-pin    { id, coords, color?, label? }
//   map-view:remove-pin { id }
//   map-view:show-route { coordinates: [lng,lat][] }
//   map-view:clear-route
//   map-view:show-midpoint { coords }
//   map-view:clear-midpoint
// =============================================================

import { LitElement, html } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { locationStore } from '../store/index.js';
import type { Coordinates } from '../types/index.js';

export const PIN_YOU = 'pin-you';
export const PIN_PARTNER = 'pin-partner';
export const PIN_DESTINATION = 'pin-destination';

// Lagos, Nigeria — default center
const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244];
const DEFAULT_ZOOM = 13;
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

// ------------------------------------------------------------------
// Pin factory
// Each pin is a hand-crafted DOM element so we control every pixel.
// ------------------------------------------------------------------
function makePinEl(color: string, label?: string, pulse = false): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
  `;

    if (pulse) {
        // Outer pulse ring — uses the keyframe defined in global.css
        const ring = document.createElement('div');
        ring.style.cssText = `
      position: absolute;
      top: 50%; left: 50%;
      width: 32px; height: 32px;
      margin: -16px 0 0 -16px;
      border-radius: 50%;
      border: 2px solid ${color};
      opacity: 0;
      animation: pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      pointer-events: none;
    `;
        wrap.appendChild(ring);

        // Second ring, offset — creates a breathing double-pulse
        const ring2 = document.createElement('div');
        ring2.style.cssText = ring.style.cssText;
        ring2.style.animationDelay = '0.8s';
        wrap.appendChild(ring2);
    }

    // Core dot
    const dot = document.createElement('div');
    dot.style.cssText = `
    width: 14px; height: 14px;
    border-radius: 50%;
    background: ${color};
    border: 3px solid rgba(255,255,255,0.95);
    box-shadow: 0 2px 10px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08);
    flex-shrink: 0;
    position: relative;
    z-index: 1;
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
  `;
    wrap.appendChild(dot);

    // Label chip — only if a label is provided
    if (label) {
        const chip = document.createElement('div');
        chip.textContent = label;
        chip.style.cssText = `
      margin-top: 5px;
      background: rgba(255,255,255,0.96);
      color: #111;
      font-family: 'DM Sans', sans-serif;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      white-space: nowrap;
      box-shadow: 0 1px 6px rgba(0,0,0,0.14);
      letter-spacing: 0.2px;
    `;
        wrap.appendChild(chip);
    }

    return wrap;
}

// Midpoint marker — dashed ring with a centre dot, signals the
// calculated fair-meetup zone
function makeMidpointEl(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
    position: relative;
    width: 44px; height: 44px;
    display: flex; align-items: center; justify-content: center;
  `;

    const ring = document.createElement('div');
    ring.style.cssText = `
    position: absolute; inset: 0;
    border-radius: 50%;
    border: 2px dashed rgba(77, 114, 152, 0.7);
    animation: spin-slow 8s linear infinite;
  `;
    wrap.appendChild(ring);

    const dot = document.createElement('div');
    dot.style.cssText = `
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #4D7298;
    box-shadow: 0 0 0 3px rgba(77,114,152,0.2);
  `;
    wrap.appendChild(dot);

    return wrap;
}

@customElement('map-view')
export class MapView extends LitElement {
    static createRenderRoot() { return this; }

    @query('#map-container')
    private _mapContainer!: HTMLElement;
    private _map: maplibregl.Map | null = null;
    private _markers = new Map<string, maplibregl.Marker>();
    private _midpointMarker: maplibregl.Marker | null = null;
    private _unsubLocation?: () => void;

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    override connectedCallback() {
        super.connectedCallback();
        this.addEventListener('map-view:move-to', this._onMoveTo as EventListener);
        this.addEventListener('map-view:add-pin', this._onAddPin as EventListener);
        this.addEventListener('map-view:remove-pin', this._onRemovePin as EventListener);
        this.addEventListener('map-view:show-route', this._onShowRoute as EventListener);
        this.addEventListener('map-view:clear-route', this._onClearRoute as EventListener);
        this.addEventListener('map-view:show-midpoint', this._onShowMidpoint as EventListener);
        this.addEventListener('map-view:clear-midpoint', this._onClearMidpoint as EventListener);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubLocation?.();
        this._map?.remove();
        this._map = null;
    }

    override firstUpdated() {
        this._initMap();
    }

    // ------------------------------------------------------------------
    // Init
    // ------------------------------------------------------------------

    private _initMap() {
        if (!this._mapContainer) return;

        this._map = new maplibregl.Map({
            container: this._mapContainer,
            style: MAP_STYLE,
            center: DEFAULT_CENTER,
            zoom: DEFAULT_ZOOM,
            attributionControl: false,
            // Disable default interactions that feel clunky on mobile
            pitchWithRotate: false,
        });

        // Add minimal attribution in a non-intrusive position
        this._map.addControl(
            new maplibregl.AttributionControl({ compact: true }),
            'bottom-left'
        );

        this._map.once('load', () => this._onMapLoaded());
    }

    private _onMapLoaded() {
        this._applyBrandStyle();

        this.dispatchEvent(
            new CustomEvent('map-view:ready', { bubbles: true, composed: true })
        );

        if (locationStore.own) {
            this._flyTo(locationStore.own, 15, 600);
            this._upsertPin(PIN_YOU, locationStore.own, '#1a2530', 'You', true);
        }

        this._unsubLocation = locationStore.subscribe(() => this._syncFromStore());
    }

    // ------------------------------------------------------------------
    // Brand style — applied after the base style loads.
    // We paint over the map tiles to match 2bottles' palette:
    //   land: warm off-white   roads: muted greige
    //   water: brand blue-grey  parks: desaturated sage
    // ------------------------------------------------------------------
    private _applyBrandStyle() {
        const map = this._map;
        if (!map) return;

        const tryPaint = (layer: string, prop: string, value: unknown) => {
            if (map.getLayer(layer)) {
                try { map.setPaintProperty(layer, prop, value); } catch { }
            }
        };

        // Land / background
        tryPaint('background', 'background-color', '#ede8e0');
        tryPaint('landuse', 'fill-color', '#e6e0d7');
        tryPaint('landuse_overlay', 'fill-color', '#ddd7ce');

        // Parks / green areas — desaturated so our green pins pop
        tryPaint('park', 'fill-color', '#cfd9c5');
        tryPaint('landuse-park', 'fill-color', '#cfd9c5');
        tryPaint('grass', 'fill-color', '#d6dccf');

        // Water — cool, slightly blue-grey
        tryPaint('water', 'fill-color', '#b8cfe0');
        tryPaint('waterway', 'line-color', '#b8cfe0');

        // Roads — warm greige, low contrast so pins dominate
        tryPaint('road-motorway', 'line-color', '#c8bfb0');
        tryPaint('road-trunk', 'line-color', '#c8bfb0');
        tryPaint('road-primary', 'line-color', '#cdc5b8');
        tryPaint('road-secondary', 'line-color', '#d0c9bc');
        tryPaint('road-tertiary', 'line-color', '#d5cfc4');
        tryPaint('road-street', 'line-color', '#dad4ca');
        tryPaint('road-service', 'line-color', '#dedad2');
        tryPaint('road-path', 'line-color', '#e2ddd6');

        // Buildings — very subtle, almost background
        tryPaint('building', 'fill-color', '#d8d2c8');
        tryPaint('building', 'fill-opacity', 0.5);
        tryPaint('building-top', 'fill-color', '#ddd8cf');

        // Labels — keep them readable but not loud
        const labelLayers = [
            'place-city', 'place-town', 'place-village', 'place-suburb',
            'road-label', 'poi-label',
        ];
        labelLayers.forEach(l => {
            tryPaint(l, 'text-color', '#5a5248');
            tryPaint(l, 'text-halo-color', 'rgba(237,232,224,0.85)');
            tryPaint(l, 'text-halo-width', 1.2);
        });
    }

    // ------------------------------------------------------------------
    // Store sync
    // ------------------------------------------------------------------

    private _syncFromStore() {
        if (locationStore.own) {
            this._upsertPin(PIN_YOU, locationStore.own, '#1a2530', 'You', true);
        }
        if (locationStore.partner) {
            this._upsertPin(PIN_PARTNER, locationStore.partner, '#e8a020', 'Partner', false);
        } else {
            this._removePin(PIN_PARTNER);
        }
        if (locationStore.destination) {
            this._upsertPin(PIN_DESTINATION, locationStore.destination, '#c0392b', undefined, false);
        } else {
            this._removePin(PIN_DESTINATION);
        }
    }

    // ------------------------------------------------------------------
    // Pins
    // ------------------------------------------------------------------

    private _upsertPin(
        id: string,
        coords: Coordinates,
        color: string,
        label?: string,
        pulse = false
    ) {
        if (!this._map) return;

        const existing = this._markers.get(id);
        if (existing) {
            existing.setLngLat([coords.lng, coords.lat]);
            return;
        }

        const el = makePinEl(color, label, pulse);
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([coords.lng, coords.lat])
            .addTo(this._map);

        this._markers.set(id, marker);
    }

    private _removePin(id: string) {
        const m = this._markers.get(id);
        if (m) { m.remove(); this._markers.delete(id); }
    }

    // ------------------------------------------------------------------
    // Midpoint
    // ------------------------------------------------------------------

    private _showMidpoint(coords: Coordinates) {
        if (!this._map) return;
        if (this._midpointMarker) {
            this._midpointMarker.setLngLat([coords.lng, coords.lat]);
            return;
        }
        const el = makeMidpointEl();
        this._midpointMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([coords.lng, coords.lat])
            .addTo(this._map);
    }

    private _clearMidpoint() {
        this._midpointMarker?.remove();
        this._midpointMarker = null;
    }

    // ------------------------------------------------------------------
    // Camera
    // ------------------------------------------------------------------

    private _flyTo(coords: Coordinates, zoom = 15, duration = 1200) {
        this._map?.flyTo({
            center: [coords.lng, coords.lat],
            zoom,
            duration,
            essential: true,
        });
    }

    /** Fit camera to show both points — used during venue selection */
    fitBounds(a: Coordinates, b: Coordinates, paddingPx = 100) {
        this._map?.fitBounds(
            [[a.lng, a.lat], [b.lng, b.lat]],
            { padding: paddingPx, duration: 1000, maxZoom: 15 }
        );
    }

    // ------------------------------------------------------------------
    // Route line
    // ------------------------------------------------------------------

    private _drawRoute(coordinates: [number, number][]) {
        const map = this._map;
        if (!map) return;

        const SRC = '2b-route';
        const LYR = '2b-route-line';

        const data: GeoJSON.Feature<GeoJSON.LineString> = {
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates },
        };

        if (map.getSource(SRC)) {
            (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(data);
        } else {
            map.addSource(SRC, { type: 'geojson', data });
            // Wider casing for legibility over the muted map
            map.addLayer({
                id: `${LYR}-casing`, type: 'line', source: SRC,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#ffffff', 'line-width': 5, 'line-opacity': 0.6 },
            });
            map.addLayer({
                id: LYR, type: 'line', source: SRC,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#4D7298',
                    'line-width': 3,
                    'line-dasharray': [1, 2],
                    'line-opacity': 0.85,
                },
            });
        }
    }

    private _clearRoute() {
        const map = this._map;
        if (!map) return;
        ['2b-route-line-casing', '2b-route-line'].forEach(l => {
            if (map.getLayer(l)) map.removeLayer(l);
        });
        if (map.getSource('2b-route')) map.removeSource('2b-route');
    }

    // ------------------------------------------------------------------
    // Event handlers
    // ------------------------------------------------------------------

    private _onMoveTo(e: CustomEvent<{ coords: Coordinates; zoom?: number }>) {
        this._flyTo(e.detail.coords, e.detail.zoom ?? 15);
    }
    private _onAddPin(e: CustomEvent<{ id: string; coords: Coordinates; color?: string; label?: string; pulse?: boolean }>) {
        this._upsertPin(e.detail.id, e.detail.coords, e.detail.color ?? '#4D7298', e.detail.label, e.detail.pulse);
    }
    private _onRemovePin(e: CustomEvent<{ id: string }>) {
        this._removePin(e.detail.id);
    }
    private _onShowRoute(e: CustomEvent<{ coordinates: [number, number][] }>) {
        this._drawRoute(e.detail.coordinates);
    }
    private _onClearRoute() {
        this._clearRoute();
    }
    private _onShowMidpoint(e: CustomEvent<{ coords: Coordinates }>) {
        this._showMidpoint(e.detail.coords);
    }
    private _onClearMidpoint() {
        this._clearMidpoint();
    }

    // ------------------------------------------------------------------
    // Render — a sized inner div for MapLibre to attach to
    // ------------------------------------------------------------------

    override render() {
        return html`<div id="map-container" style="width:100%;height:100%;"></div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'map-view': MapView; }
}