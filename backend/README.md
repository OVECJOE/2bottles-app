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

- Current hub is in-memory for room state. Add Redis pub/sub before horizontal scaling.
- Auth identity is read from `Authorization: Bearer <jwt>` claims (`sub`, `name`, `tier`) or fallback headers (`x-user-id`, `x-user-name`, `x-membership-tier`).
- If `JWT_SECRET` is set, bearer tokens are verified as `HS256` before claims are trusted.
- User IDs are normalized to UUID-compatible values for DB safety.
- If `DATABASE_URL` is provided, session persistence, presence, chat, and location events are stored in PostgreSQL.
- SQL schema is provided as a starting point for production migration tooling.
- Venue selections are persisted in `sessions.venue_id` (see `sql/migrations/0002_session_venue.sql`).
