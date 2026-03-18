# 2bottles Backend (Bun + Hono)

This backend provides:
- Health endpoints (`/health/live`, `/health/ready`)
- Basic entitlements endpoint (`/api/me/entitlements`)
- Realtime WebSocket hub (`/ws`) for session presence, location, chat, venue, and status events
- Initial PostgreSQL + PostGIS schema migration in `sql/migrations/0001_init.sql`
- Session API compatibility routes used by current frontend:
	- `POST /api/sessions`
	- `GET /api/sessions/:id`
	- `GET /api/sessions/:id/history`
	- `POST /api/sessions/invite`
	- `POST /api/sessions/venues`
	- `PATCH /api/sessions/:id/venue`
	- `DELETE /api/sessions/:id`

## Run locally

```bash
cd backend
bun install
bun run dev
```

Server starts on `http://localhost:8080` by default.

## WebSocket endpoint

Connect using query params:

`ws://localhost:8080/ws?sessionId=<id>&userId=<id>&name=<displayName>`

## Notes

- Realtime fanout is in-memory by default and can be distributed with Redis pub/sub when `REDIS_URL` is configured.
- Auth identity is read from `Authorization: Bearer <jwt>` claims (`sub`, `name`, `tier`) or fallback headers (`x-user-id`, `x-user-name`, `x-membership-tier`).
- If `JWT_SECRET` is set, bearer tokens are verified as `HS256` before claims are trusted.
- If `AUTH_REQUIRED=true`, `/api/sessions/*`, `/api/me/*`, and `/ws` require a verified bearer token.
- User IDs are normalized to UUID-compatible values for DB safety.
- If `DATABASE_URL` is provided, session persistence, presence, chat, and location events are stored in PostgreSQL.
- SQL schema is provided as a starting point for production migration tooling.
- Venue selections are persisted in `sessions.venue_id` (see `sql/migrations/0002_session_venue.sql`).
- Session status/venue changes are written to append-only `session_events` (see `sql/migrations/0003_session_events.sql`).
- Owner-role authorization is enforced for:
	- `POST /api/sessions/invite`
	- `PATCH /api/sessions/:id/venue`
	- `POST /api/sessions/:id/end`
	- `DELETE /api/sessions/:id`
	- WebSocket messages `session:status` and `session:venue`
- Member-level authorization is enforced for session-scoped WebSocket messages:
	- `chat:message`
	- `location:update`
	- `presence:join` and `presence:leave`
	- `session:status` and `session:venue` (plus owner-role requirement)
- Per-member WebSocket rate limits are enforced:
	- chat via `WS_CHAT_RATE_LIMIT_COUNT` / `WS_CHAT_RATE_LIMIT_WINDOW_MS`
	- location via `WS_LOCATION_RATE_LIMIT_COUNT` / `WS_LOCATION_RATE_LIMIT_WINDOW_MS`
	- if `REDIS_URL` is set, limits are shared across instances (otherwise in-memory per node)
	- limit breaches return WS error code `rate_limited`
- WebSocket payload validation is enforced before auth/rate-limit checks:
	- chat text required and bounded by `WS_MAX_CHAT_MESSAGE_LENGTH`
	- location must have finite `lat/lng` within geographic range
	- event timestamps (`ts`) must be within `WS_MAX_EVENT_AGE_MS` and `WS_MAX_FUTURE_SKEW_MS`
	- malformed payloads return WS error code `invalid_payload`

## History sync

- `GET /api/sessions/:id/history` supports optional `?since=<unix_ms>` for incremental sync.
- Optional `?limit=<n>` bounds incremental payload size (capped by `API_MAX_HISTORY_LIMIT`).
- Response includes:
	- `cursor`: latest server timestamp for subsequent `since` calls.
	- `latestLocations`: last known location per user (full sync only).
	- `locationEvents`: ordered location updates since cursor/full window.
	- `chat`: ordered chat messages.
	- `events`: ordered `session:status` / `session:venue` event stream.
- The history cursor is produced from a DB snapshot boundary (`NOW()`), and all returned rows are bounded to `created_at <= cursor` to avoid missed events between polls.

## REST validation

- Session API payloads are validated with explicit `400 bad_request` responses for malformed input.
- Validation tunables:
	- `API_MAX_NAME_LENGTH`
	- `API_MAX_EXTERNAL_ID_LENGTH`
	- `API_MAX_HISTORY_LIMIT`

## Audit Logging

- Structured JSON logs are emitted for HTTP and WebSocket lifecycle/security events.
- Each HTTP request gets a correlation ID (`x-request-id`), echoed in responses.
- WebSocket upgrades inherit the request ID for connection and message-level audit events.
- Logging controls:
  - `AUDIT_LOG_ENABLED`
  - `AUDIT_LOG_LEVEL` (`debug` | `info` | `warn` | `error`)
	- `AUDIT_LOG_SINK` (`console`)

## Redis pub/sub (optional)

- Set `REDIS_URL` (for example `redis://localhost:6379`) to enable cross-instance realtime fanout.
- Optional: set `REDIS_CHANNEL` to override the default channel `2bottles:realtime`.
- Optional: set `INSTANCE_ID` to provide a stable instance identifier in multi-node deployments.
- Optional: set `WS_RATE_LIMIT_PREFIX` to override Redis key prefix for distributed WebSocket limits.
- Distributed presence self-healing:
	- nodes publish periodic presence heartbeats for connected users
	- stale remote users are marked offline after `WS_REMOTE_PRESENCE_TTL_MS`
	- heartbeat cadence can be tuned with `WS_REMOTE_PRESENCE_HEARTBEAT_MS`
