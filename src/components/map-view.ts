/**
 * <map-view> — the persistent map canvas.
 *
 * Responsibilities:
 *   1. Render a brand-styled MapLibre map as the full backdrop
 *   2. React to locationStore changes — move pins in real-time
 *   3. Draw/update the dashed route line between you, partner, and destination
 *   4. Expose a fitBounds() method and a custom-event command API
 *      for screens that need precise camera control
 *
 * Pin lifecycle driven entirely by locationStore:
 *   own        → PIN_YOU        (dark, pulsing)
 *   partner    → PIN_PARTNER    (amber, pulsing)
 *   destination → PIN_DESTINATION (red, venue name label)
 *
 * Route line:
 *   During live-tracking: you → destination and partner → destination
 *   During select-rendezvous: dashed arcs from both pins to midpoint
 *
 * Custom events (dispatch on any ancestor, map-view listens via bubbling):
 *   map-view:move-to       { coords, zoom? }
 *   map-view:add-pin       { id, coords, color?, label?, pulse? }
 *   map-view:remove-pin    { id }
 *   map-view:show-route    { coordinates: [lng,lat][] }
 *   map-view:clear-route
 *   map-view:show-midpoint { coords }
 *   map-view:clear-midpoint
 *   map-view:draw-tracking-routes  (triggers the you→dest + partner→dest lines)
 *   map-view:fit-tracking           (fits camera to all three: you, partner, dest)
 */

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

// ---------------------------------------------------------------------------
// Pin element factory
// ---------------------------------------------------------------------------

function makePinEl(color: string, label?: string, pulse = false): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
    position: relative;
    display: flex; flex-direction: column; align-items: center;
    cursor: pointer;
  `;

    if (pulse) {
        for (let i = 0; i < 2; i++) {
            const ring = document.createElement('div');
            ring.style.cssText = `
        position: absolute; top: 50%; left: 50%;
        width: 32px; height: 32px; margin: -16px 0 0 -16px;
        border-radius: 50%; border: 2px solid ${color};
        opacity: 0;
        animation: pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite;
        animation-delay: ${i * 0.8}s;
        pointer-events: none;
      `;
            wrap.appendChild(ring);
        }
    }

    const dot = document.createElement('div');
    dot.style.cssText = `
    width: 14px; height: 14px; border-radius: 50%;
    background: ${color};
    border: 3px solid rgba(255,255,255,0.95);
    box-shadow: 0 2px 10px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08);
    flex-shrink: 0; position: relative; z-index: 1;
    transition: transform 220ms cubic-bezier(0.34,1.56,0.64,1);
  `;
    wrap.appendChild(dot);

    if (label) {
        const chip = document.createElement('div');
        chip.textContent = label;
        chip.style.cssText = `
      margin-top: 5px;
      background: rgba(255,255,255,0.97); color: #111;
      font-family: 'DM Sans', sans-serif;
      font-size: 10px; font-weight: 600;
      padding: 2px 8px; border-radius: 999px;
      white-space: nowrap;
      box-shadow: 0 1px 6px rgba(0,0,0,0.14);
      letter-spacing: 0.2px;
    `;
        wrap.appendChild(chip);
    }

    return wrap;
}

/** Updates the label chip text on an existing pin element */
export function updatePinLabel(el: HTMLElement, label: string) {
    const chip = el.querySelector<HTMLElement>('div:last-child');
    if (chip && chip !== el.querySelector<HTMLElement>('div:first-child')) {
        chip.textContent = label;
    }
}

function makeDestinationEl(label: string): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
    position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer;
  `;

    // Teardrop shape for destination
    const body = document.createElement('div');
    body.style.cssText = `
    width: 32px; height: 32px; border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: #c0392b;
    border: 3px solid rgba(255,255,255,0.95);
    box-shadow: 0 3px 12px rgba(192,57,43,0.45), 0 0 0 1px rgba(0,0,0,0.08);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  `;
    const inner = document.createElement('div');
    inner.style.cssText = `
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(255,255,255,0.9);
    transform: rotate(45deg);
  `;
    body.appendChild(inner);
    wrap.appendChild(body);

    if (label) {
        const chip = document.createElement('div');
        chip.textContent = label;
        chip.style.cssText = `
      margin-top: 7px;
      background: #c0392b; color: #fff;
      font-family: 'DM Sans', sans-serif;
      font-size: 10px; font-weight: 700;
      padding: 3px 10px; border-radius: 999px;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(192,57,43,0.4);
      letter-spacing: 0.3px;
      max-width: 120px; overflow: hidden; text-overflow: ellipsis;
    `;
        wrap.appendChild(chip);
    }

    return wrap;
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@customElement('map-view')
export class MapView extends LitElement {
    static createRenderRoot() { return this; }

    @query('#map-container')
    private _mapContainer!: HTMLDivElement;
    private _map: maplibregl.Map | null = null;
    private _markers = new Map<string, maplibregl.Marker>();
    private _midpointMarker: maplibregl.Marker | null = null;
    private _unsubLocation?: () => void;
    private _unsubSession?: () => void;

    override connectedCallback() {
        super.connectedCallback();
        this.addEventListener('map-view:move-to', this._onMoveTo as EventListener);
        this.addEventListener('map-view:add-pin', this._onAddPin as EventListener);
        this.addEventListener('map-view:remove-pin', this._onRemovePin as EventListener);
        this.addEventListener('map-view:show-route', this._onShowRoute as EventListener);
        this.addEventListener('map-view:clear-route', this._onClearRoute as EventListener);
        this.addEventListener('map-view:show-midpoint', this._onShowMidpoint as EventListener);
        this.addEventListener('map-view:clear-midpoint', this._onClearMidpoint as EventListener);
        this.addEventListener('map-view:draw-tracking-routes', this._onDrawTracking as EventListener);
        this.addEventListener('map-view:fit-tracking', this._onFitTracking as EventListener);
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubLocation?.();
        this._unsubSession?.();
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
    }

    private _onMapLoaded() {
        this._applyBrandStyle();

        this.dispatchEvent(new CustomEvent('map-view:ready', { bubbles: true, composed: true }));

        if (locationStore.own) {
            this._flyTo(locationStore.own, 15, 600);
            this._upsertYouPin(locationStore.own);
        }

        // React to every location store change
        this._unsubLocation = locationStore.subscribe(() => this._syncFromStore());

        // React to session store changes (venue name updates destination pin label)
        this._unsubSession = sessionStore.subscribe(() => this._syncDestinationLabel());
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

    // ---------------------------------------------------------------------------
    // Store sync — called on every locationStore update
    // ---------------------------------------------------------------------------

    private _syncFromStore() {
        const { own, partner, destination } = locationStore;

        if (own) {
            this._upsertYouPin(own);
        }

        if (partner) {
            this._upsertPartnerPin(partner);
        } else {
            this._removePin(PIN_PARTNER);
        }

        if (destination) {
            this._upsertDestinationPin(destination);
        } else {
            this._removePin(PIN_DESTINATION);
        }

        // Draw/update route lines whenever we have the right combination of coords
        const screen = uiStore.screen;

        if (screen === 'live-tracking' && own && partner && destination) {
            this._drawTrackingRoutes(own, partner, destination);
        } else if (screen === 'select-rendezvous' && own && partner) {
            // No route lines during selection — just the midpoint marker
        }
    }

    private _syncDestinationLabel() {
        const dest = locationStore.destination;
        const venueName = sessionStore.selectedVenue?.name;
        if (!dest || !venueName) return;

        // If a destination marker already exists, replace it with updated label
        const existing = this._markers.get(PIN_DESTINATION);
        if (existing) {
            existing.remove();
            this._markers.delete(PIN_DESTINATION);
            this._upsertDestinationPin(dest);
        }
    }

    // ---------------------------------------------------------------------------
    // Pin helpers
    // ---------------------------------------------------------------------------

    private _upsertYouPin(coords: Coordinates) {
        const existing = this._markers.get(PIN_YOU);
        if (existing) {
            existing.setLngLat([coords.lng, coords.lat]);
            return;
        }
        const el = makePinEl('#1a2530', 'You', true);
        this._markers.set(PIN_YOU,
            new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([coords.lng, coords.lat])
                .addTo(this._map!)
        );
    }

    private _upsertPartnerPin(coords: Coordinates) {
        const label = sessionStore.partner?.name?.split(' ')[0] ?? 'Partner';
        const existing = this._markers.get(PIN_PARTNER);
        if (existing) {
            existing.setLngLat([coords.lng, coords.lat]);
            return;
        }
        const el = makePinEl('#e8a020', label, true);
        this._markers.set(PIN_PARTNER,
            new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([coords.lng, coords.lat])
                .addTo(this._map!)
        );
    }

    private _upsertDestinationPin(coords: Coordinates) {
        const label = sessionStore.selectedVenue?.name ?? '';
        const existing = this._markers.get(PIN_DESTINATION);
        if (existing) {
            existing.setLngLat([coords.lng, coords.lat]);
            return;
        }
        const el = makeDestinationEl(label);
        this._markers.set(PIN_DESTINATION,
            new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([coords.lng, coords.lat])
                .addTo(this._map!)
        );
    }

    private _upsertPin(id: string, coords: Coordinates, color: string, label?: string, pulse = false) {
        if (!this._map) return;
        const existing = this._markers.get(id);
        if (existing) { existing.setLngLat([coords.lng, coords.lat]); return; }
        const el = makePinEl(color, label, pulse);
        this._markers.set(id,
            new maplibregl.Marker({ element: el, anchor: 'bottom' })
                .setLngLat([coords.lng, coords.lat])
                .addTo(this._map)
        );
    }

    private _removePin(id: string) {
        const m = this._markers.get(id);
        if (m) { m.remove(); this._markers.delete(id); }
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

        const lngs = [a.lng, b.lng, ...(c ? [c.lng] : [])];
        const lats = [a.lat, b.lat, ...(c ? [c.lat] : [])];

        this._map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: paddingPx, duration: 1000, maxZoom: 15 }
        );
    }

    // ---------------------------------------------------------------------------
    // Route lines
    // ---------------------------------------------------------------------------

    /**
     * Draw two dashed lines: you→destination and partner→destination.
     * This is the core live-tracking visualization.
     */
    private _drawTrackingRoutes(you: Coordinates, partner: Coordinates, dest: Coordinates) {
        const map = this._map;
        if (!map) return;

        const youLine: [number, number][] = [[you.lng, you.lat], [dest.lng, dest.lat]];
        const partnerLine: [number, number][] = [[partner.lng, partner.lat], [dest.lng, dest.lat]];

        this._setLineSource('2b-route-you', youLine, '#4D7298', false);
        this._setLineSource('2b-route-partner', partnerLine, '#e8a020', true);
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
            return;
        }

        map.addSource(id, { type: 'geojson', data });

        // White casing underneath for legibility
        map.addLayer({
            id: casingLyr, type: 'line', source: id,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.55 },
        });

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

    private _drawRoute(coordinates: [number, number][]) {
        this._setLineSource('2b-route', coordinates, '#4D7298', true);
    }

    private _clearRoute() {
        const map = this._map;
        if (!map) return;
        const ids = [
            '2b-route-you-casing-layer', '2b-route-you-layer',
            '2b-route-partner-casing-layer', '2b-route-partner-layer',
            '2b-route-casing-layer', '2b-route-layer',
        ];
        ids.forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
        ['2b-route-you', '2b-route-partner', '2b-route'].forEach(s => {
            if (map.getSource(s)) map.removeSource(s);
        });
    }

    // ---------------------------------------------------------------------------
    // Event handlers
    // ---------------------------------------------------------------------------

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

    private _onClearRoute() { this._clearRoute(); }

    private _onShowMidpoint(e: CustomEvent<{ coords: Coordinates }>) {
        this._showMidpoint(e.detail.coords);
    }

    private _onClearMidpoint() { this._clearMidpoint(); }

    private _onDrawTracking() {
        const { own, partner, destination } = locationStore;
        if (own && partner && destination) {
            this._drawTrackingRoutes(own, partner, destination);
        }
    }

    private _onFitTracking() {
        const { own, partner, destination } = locationStore;
        if (own && destination) {
            this.fitBounds(own, destination, 100, partner ?? undefined);
        }
    }

    override render() {
        return html`<div id="map-container" style="width:100%;height:100%;"></div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap { 'map-view': MapView; }
}