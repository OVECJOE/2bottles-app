# Production Readiness Checklist

## Must-pass before deploy

- Apply DB migrations in order (`0001`..`0004`) and verify tables/indexes exist.
- Set auth and secrets:
  - `JWT_SECRET`
  - `AUTH_REQUIRED=true`
- Set push env if invites should notify offline users:
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`
- If multi-instance:
  - `REDIS_URL`
  - optional `REDIS_CHANNEL`, `REDIS_INVITE_CHANNEL`, `INSTANCE_ID`
- Run `backend/scripts/prod-smoke.sh` with a valid `TOKEN`.

## WebSocket auth model

Browser WebSocket clients cannot set `Authorization` headers.
This backend supports token query auth for WS strict mode:
- `/ws?...&token=<jwt>`
- `/ws/invites?...&token=<jwt>`

## Known behavior

- WS rate limiter degrades to memory when Redis is unavailable and retries later.
- Invite push delivery prunes stale endpoints (`404`/`410`).
- Invite realtime fanout works across instances when Redis is configured.

## Payments status

Stripe payment wiring is implemented:
- `POST /api/payments/checkout`
- `POST /api/payments/webhook/stripe`
- idempotent webhook event table (`payment_webhook_events`)
- membership tier updates in `memberships`

Still required before production launch:
- Stripe dashboard webhook configured to `/api/payments/webhook/stripe`
- price catalog review (`STRIPE_PRICE_ID_PAID`)
- periodic reconciliation for missed webhooks
