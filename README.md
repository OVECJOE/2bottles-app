# 2bottles Contributor Guide

A deep technical onboarding guide for developers who want to contribute confidently to the 2bottles frontend.

2bottles is a mobile-first Lit + TypeScript web app for coordinating in-person meetups between two people. The product centers on fairness (meeting midpoint-like zones), live location sharing, and low-friction session flows.

## Table of Contents

- [What this repo is](#what-this-repo-is)
- [Tech stack and runtime model](#tech-stack-and-runtime-model)
- [Boot flow and application lifecycle](#boot-flow-and-application-lifecycle)
- [Routing model and screen architecture](#routing-model-and-screen-architecture)
- [Project structure and responsibilities](#project-structure-and-responsibilities)
- [State management](#state-management)
- [Data and realtime architecture](#data-and-realtime-architecture)
- [Geocoding and venue suggestion engine](#geocoding-and-venue-suggestion-engine)
- [Map system](#map-system)
- [PWA and Service Worker behavior](#pwa-and-service-worker-behavior)
- [Styling and design system](#styling-and-design-system)
- [Domain types and contracts](#domain-types-and-contracts)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [How to add features safely](#how-to-add-features-safely)
- [Gotchas and architectural risks](#gotchas-and-architectural-risks)
- [Contribution checklist](#contribution-checklist)

## What this repo is

This repository is the frontend application.

- Runtime: browser SPA with client-side routing.
- Build tool: Vite.
- UI framework: Lit custom elements.
- Realtime transport: PeerJS (WebRTC data channel) + WebSocket.
- Mapping: MapLibre GL.
- Persistence: IndexedDB via idb-keyval + selected localStorage keys.
- PWA: install flow + service worker + push notifications.

Backend APIs are consumed under `/api` and WebSocket under `/ws`, but backend source is not in this workspace.

## Tech stack and runtime model

Core dependencies in `package.json`:

- `lit`: component system.
- `@vaadin/router`: route matching + lazy screen loading.
- `maplibre-gl`: map rendering and interactions.
- `peerjs`: peer-to-peer signaling/data channels.
- `idb-keyval`: lightweight IndexedDB persistence.
- `@lit/context`: context keys for store access patterns.

TypeScript is strict and no-emit (`tsconfig.json`), while Vite handles bundling.

`vite.config.ts` includes important behavior:

- Alias `@ -> src`.
- Separate Rollup entry for service worker (`src/sw/sw.ts`) emitted as `dist/sw.js`.
- Manual vendor chunking for `maplibre-gl` and `lit`.
- Dev proxies for `/api`, `/ws`, plus geocoding/routing public providers.

## Boot flow and application lifecycle

Entry point: `src/main.ts`.

At startup:

1. Global styles load and demo analytics are initialized.
2. Boot mode is determined:
   - Landing mode for `/` and `/index.html` when onboarding is not complete.
   - App mode for main routed experience.
3. Landing actions are listened for globally:
   - start
   - install
   - skip
4. Dynamic import failures are guarded with controlled reload logic.
5. Service worker registration occurs only in production, after page load.

Important localStorage keys used here:

- `2b:onboarding-completed`
- `2b:sw-refresh-at`

## Routing model and screen architecture

Top-level shell: `src/components/app-shell.ts`.

It owns:

- Router initialization.
- Route guards (session active, host-only paths, venue selection prerequisites).
- Global overlays (toast/loading/dialog).
- Location permission takeover UX.
- App install prompt handoff.

Current route set:

- `/` -> landing page.
- `/create-session` -> host starts a session.
- `/invite` -> host shares invite link.
- `/join/:peerId` -> invited partner entry.
- `/rejected` -> rejection outcome.
- `/select-venue` -> host picks venue.
- `/coordinate` -> agreement/chat round.
- `/tracking` -> live trip state.
- `/chat` -> full-screen chat.
- `/session-link` -> confirmed link view.
- `/ended` -> session summary.
- `/save-spot` -> post-session spot save flow.

Unknown routes redirect to `/create-session`.

## Project structure and responsibilities

`src/components`

- `app-shell.ts`: root shell and route orchestration.
- `map-view.ts`: full-screen map, markers, route drawing, map events.
- `marketing/landing-page.ts`: onboarding/marketing and install/start actions.
- `session/*`: create/invite/link screens.
- `partner/*`: join/agree/refuse/rejected flows.
- `rendezvous/*`: fairness suggestions and venue selection.
- `tracking/*`: live tracking, chat overlay, and end session summary.
- `spot/save-spot-page.ts`: rating/media upload after meetup.
- `ui/*`: reusable shell and primitives (dialogs, bottom sheet, location input, menu, etc.).

`src/store`

- `session.store.ts`: session, partner, venue, and chat state.
- `location.store.ts`: own/partner/destination coordinates, ETA, distance, GPS watch lifecycle.
- `ui.store.ts`: route state, overlays, online badge, dialog orchestration.
- `index.ts`: singleton exports and Lit context keys.

`src/services`

- `session.service.ts`: high-level API/session orchestration.
- `p2p.service.ts`: PeerJS setup, reconnect logic, message queue, message handling.
- `websocket.service.ts`: ws lifecycle + periodic location broadcast.
- `geocoding.service.ts`: geocode/reverse geocode/venue scoring/routing metrics.
- `notification.service.ts`: web push subscribe/unsubscribe.
- `spot.service.ts`: spot create/rate/upload (with mock fallback).
- `demo-analytics.service.ts`: batched event flush.
- `clipboard.service.ts`: copy utility.
- `midpoint.service.ts`: currently empty placeholder.

`src/api`

- `client.ts`: typed fetch wrapper, timeout, auth header, error normalization.
- `sessions.api.ts`: session endpoints currently used by app.
- `users.api.ts`, `venue.api.ts`: currently empty placeholders.

`src/sw`

- `sw.ts`: install/activate/fetch/push/notificationclick behavior.
- `push-handler.ts`: currently empty.

`src/styles`

- `tokens.css`: design tokens and semantic variables.
- `global.css`: reset, layout baseline, utility classes, keyframes.
- `shared-styles.ts`: shared Lit CSS blocks.

`src/types`

- Domain types for session/location/venue and shared app screen contracts.

## State management

Stores are singleton class instances with:

- mutable public fields
- manual `subscribe()` + `_notify()` pattern
- selective IndexedDB persistence

### Session store

Persists and manages:

- session identity and status
- partner data/status
- selected venue and suggestions
- agreement flags
- chat history

It auto-expires stale persisted sessions older than 24 hours on init.

### Location store

Manages:

- geolocation watch lifecycle with error handling and cool-off strategy
- own, partner, destination coordinates
- ETA and distance snapshots
- GPS accuracy and error code state

It broadcasts own location through P2P on updates.

### UI store

Manages:

- current app screen mapping to route paths
- loading and toast state
- confirm dialog lifecycle
- partner online indicator

Its `navigate()` translates app screens to URLs and calls router navigation.

## Data and realtime architecture

### HTTP API layer

Base behavior from `src/api/client.ts`:

- base prefix `/api`
- request timeout of 12 seconds
- optional bearer token from `localStorage['2b:token']`
- throws `ApiError(status, message)` for non-2xx

Used session endpoints (`src/api/sessions.api.ts`):

- `POST /sessions` create
- `POST /sessions/invite`
- `GET /sessions/:sessionId`
- `PATCH /sessions/:sessionId/venue`
- `DELETE /sessions/:sessionId`
- `POST /sessions/venues`

### P2P layer

`src/services/p2p.service.ts` handles direct peer communication.

- Host/join modes.
- Signaling reconnect logic.
- Message queue buffering when data channel is down.
- Multiple env-driven ICE/server options.

Message types currently handled:

- `location:update`
- `partner:status`
- `session:status`
- `session:venue`
- `session:agree`
- `session:reset`
- `user:info`
- `chat:message`

### WebSocket layer

`src/services/websocket.service.ts` provides server-mediated sync.

- Connection per session id.
- Exponential reconnect (capped attempts).
- Broadcast own location every 4 seconds while connected.
- Consumes partner/session status updates from server.

In practice, P2P and WebSocket both affect runtime state. Keep side effects carefully reasoned when changing either.

## Geocoding and venue suggestion engine

`src/services/geocoding.service.ts` is one of the most complex subsystems.

What it does:

- Autocomplete with Nominatim primary and Photon fallback.
- Reverse geocode with quantized keys and cooldown handling.
- Venue candidate fetch from Geoapify (rect-based progressive widening).
- Travel metric refinement with OSRM route calls.
- Candidate scoring for fairness and practicality.

Important behavior details:

- Multiple TTL caches by concern (autocomplete, reverse, venues, route metrics).
- Provider rate-limit cooldowns to avoid request storms.
- Candidate de-duplication and category diversification.
- Final venue list enriched with ETA and distance for each participant.

This module is a major hotspot for product behavior, API-cost behavior, and perceived intelligence.

## Map system

`src/components/map-view.ts` is a global map component mounted once in app shell.

Responsibilities:

- Render own, partner, destination markers and midpoint marker.
- Render route lines (own/partner/both modes).
- Fit map bounds and optionally follow own location.
- Show info card with reverse-geocoded place details.

Cross-component control is event-driven using window-level custom events.

Events consumed:

- `map-view:move-to`
- `map-view:show-route`
- `map-view:clear-route`
- `map-view:show-midpoint`
- `map-view:clear-midpoint`
- `map-view:draw-tracking-routes`
- `map-view:fit-tracking`
- `map-view:follow-user`
- `map-view:route-mode`

## PWA and Service Worker behavior

`src/sw/sw.ts` provides:

- Install precache of app shell assets.
- Activate cleanup of old caches.
- Network-only for `/api`, `/ws`, and hashed `/assets/*` chunks.
- Navigation fetch fallback to cached `/index.html` for offline shell behavior.
- Push notification display + notification click focus/open logic.

A specific stale-asset defense exists:

- If hashed asset fetch returns 404/410, service worker posts `ASSET_MISSING_RELOAD`.
- App listens and performs controlled reload with dedupe timing key.

This strategy is intentionally biased toward freshness over aggressive offline caching.

## Styling and design system

Design tokens in `src/styles/tokens.css` include:

- primitive palette
- semantic color roles
- map color contracts
- spacing/typography/motion scales
- z-index system

Global style baseline in `src/styles/global.css` handles:

- reset and viewport constraints
- map and shell layout layering
- utility button/input classes
- shared animation names

Shared reusable component style fragments are in `src/styles/shared-styles.ts`.

## Domain types and contracts

Primary domain contracts live in `src/types` and are re-exported through `src/types/index.ts`.

Key contract categories:

- session lifecycle/status
- partner status
- venue data shape
- coordinates and location state
- chat message shape
- app screen union

Custom UI events are used heavily for inter-component orchestration. When adding new ones:

- use `bubbles: true, composed: true`
- define a stable payload shape
- document listener ownership

## Environment variables

Main environment flags consumed by frontend:

### Geocoding / venue / routing

- `VITE_NOMINATIM_ENDPOINT`
- `VITE_PHOTON_ENDPOINT`
- `VITE_GEOAPIFY_ENDPOINT`
- `VITE_GEOAPIFY_API_KEY`
- `VITE_ROUTING_ENDPOINT`
- `VITE_NOMINATIM_MIN_INTERVAL_MS`

### Notifications

- `VITE_VAPID_PUBLIC_KEY`
- `VITE_DEMO_ANALYTICS_ENDPOINT`

### Spot service

- `VITE_SPOT_API_BASE` (if absent, service uses local mock storage)

### PeerJS / ICE

- `VITE_PEER_HOST`
- `VITE_PEER_PATH`
- `VITE_PEER_PORT`
- `VITE_PEER_SECURE`
- `VITE_ICE_SERVERS_JSON`
- `VITE_STUN_URLS`
- `VITE_TURN_URL`
- `VITE_TURN_USERNAME`
- `VITE_TURN_CREDENTIAL`

## Local development

Install and run:

```bash
npm install
npm run dev
```

Other commands:

```bash
npm run build
npm run preview
```

Default ports:

- dev server: `3000`
- preview server: `4173`

Vite dev proxy expects backend at `http://localhost:8080` for `/api` and `/ws`.

## How to add features safely

### Add a new screen

1. Create component under `src/components/<feature>/`.
2. Add route in `app-shell.ts` with guard logic.
3. Add/extend `AppScreen` union if UI store navigation should know it.
4. Wire navigation through `uiStore.navigate()` or explicit `Router.go` where appropriate.
5. If map interaction is needed, use existing map custom-event conventions.

### Add a new API endpoint integration

1. Add method in `src/api/*.ts` (or create module if needed).
2. Keep response typing explicit.
3. Orchestrate UI behavior in a service module, not directly in components.
4. Surface user feedback via `uiStore.showToast` and loading state with `uiStore.setLoading`.

### Add new shared state

1. Decide if state is truly cross-screen.
2. Extend existing store or create a new store with subscribe/save/init parity.
3. Keep persistence explicit (IDB or none).
4. Avoid hidden coupling by documenting state transitions in method names.

### Add new realtime messages

1. Define payload in P2P and/or WebSocket union types.
2. Handle send and receive paths.
3. Ensure idempotent state transitions where possible.
4. Test disconnected/reconnected behavior and queue interaction.

## Gotchas and architectural risks

1. P2P and WebSocket can both update shared state; out-of-order effects are possible.
2. Store notifications are immediate and unbatched; subscribers can observe intermediate states.
3. Geocoding service has many caches/cooldowns; behavior changes can create subtle regressions.
4. Session and UI persistence keys are string literals across modules.
5. Chat history is unbounded in memory and persisted state.
6. Route guards rely on current store state; stale/partial rehydration can influence navigation.
7. Spot flow uses mock persistence unless API base is configured.
8. Service worker strategy intentionally avoids caching hashed chunks; do not “optimize” this without understanding stale asset risks.
9. `users.api.ts`, `venue.api.ts`, `midpoint.service.ts`, and `sw/push-handler.ts` are currently empty placeholders; avoid assuming they are wired.

## Contribution checklist

Before opening a PR:

- Build passes locally (`npm run build`).
- Routes work after hard refresh and direct deep link navigation.
- Session lifecycle still works end-to-end:
  - create
  - invite/join
  - select venue
  - agree
  - live tracking
  - end
- Location denied/permitted flows still behave correctly.
- Reconnect behavior still works when partner disconnects/rejoins.
- No accidental breaking changes to event names or payload contracts.
- New env vars are documented here.

---

If you are new to this codebase, start by tracing these files in order:

1. `src/main.ts`
2. `src/components/app-shell.ts`
3. `src/store/*.ts`
4. `src/components/session/create-session.ts`
5. `src/components/rendezvous/select-rendezvous.ts`
6. `src/components/tracking/live-tracking.ts`
7. `src/components/map-view.ts`
8. `src/services/p2p.service.ts`
9. `src/services/geocoding.service.ts`
10. `src/sw/sw.ts`

That sequence gives the clearest mental model of app flow, state, map interaction, and realtime behavior.