import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { RealtimeHub } from './realtime/hub';
import { createRedisDistributor } from './realtime/redis-distributor';
import { createWsRateLimiter } from './realtime/rate-limiter';
import type { ClientToServerMessage, SocketContext } from './realtime/protocol';
import { SessionStore } from './session-store';
import { isRequestAuthenticated, normalizeUserId, resolveIdentity } from './auth';
import { auditLog, createCorrelationId } from './audit/index';
import {
  createDbSession,
  endDbSession,
  getDbSession,
  getDbParticipantRole,
  getSessionHistory,
  hasDb,
  insertChatMessage,
  insertLocationEvent,
  insertSessionEvent,
  joinDbSession,
  readMembershipTier,
  setParticipantPresence,
  updateDbSessionStatus,
  updateDbSessionVenue,
} from './db';

const app = new Hono();
const hub = new RealtimeHub({
  async onJoin(ctx) {
    await setParticipantPresence(ctx.sessionId, ctx.userId, true).catch(() => undefined);
  },
  async onLeave(ctx) {
    await setParticipantPresence(ctx.sessionId, ctx.userId, false).catch(() => undefined);
  },
  async onLocationUpdate(event) {
    await insertLocationEvent(event.sessionId, event.userId, event.lat, event.lng).catch(() => undefined);
  },
  async onChatMessage(event) {
    await insertChatMessage(event.sessionId, event.userId, event.id, event.text).catch(() => undefined);
  },
  async onSessionStatus(event) {
    await updateDbSessionStatus(event.sessionId, event.status).catch(() => undefined);
    await insertSessionEvent(event.sessionId, event.userId, 'session:status', { status: event.status }).catch(() => undefined);
  },
  async onSessionVenue(event) {
    await updateDbSessionVenue(event.sessionId, event.venueId).catch(() => undefined);
    await insertSessionEvent(event.sessionId, event.userId, 'session:venue', { venueId: event.venueId }).catch(() => undefined);
  },
});
const sessions = new SessionStore();
const redisDistributor = await createRedisDistributor();

if (redisDistributor) {
  try {
    await hub.attachDistributor(redisDistributor);
    console.log('[backend] redis pub/sub enabled');
  } catch (err) {
    console.error('[backend] failed to initialize redis pub/sub, continuing with local realtime only', err);
  }
}

const PORT = Number(process.env.PORT ?? 8080);
const ORIGIN = process.env.CORS_ORIGIN ?? '*';
const STRICT_AUTH = process.env.AUTH_REQUIRED === 'true';
const CHAT_RATE_LIMIT_COUNT = Math.max(1, Number(process.env.WS_CHAT_RATE_LIMIT_COUNT ?? 12));
const CHAT_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.WS_CHAT_RATE_LIMIT_WINDOW_MS ?? 10_000));
const LOCATION_RATE_LIMIT_COUNT = Math.max(1, Number(process.env.WS_LOCATION_RATE_LIMIT_COUNT ?? 20));
const LOCATION_RATE_LIMIT_WINDOW_MS = Math.max(1000, Number(process.env.WS_LOCATION_RATE_LIMIT_WINDOW_MS ?? 10_000));
const WS_MAX_CHAT_MESSAGE_LENGTH = Math.max(1, Number(process.env.WS_MAX_CHAT_MESSAGE_LENGTH ?? 500));
const WS_MAX_EVENT_AGE_MS = Math.max(1_000, Number(process.env.WS_MAX_EVENT_AGE_MS ?? 300_000));
const WS_MAX_FUTURE_SKEW_MS = Math.max(1_000, Number(process.env.WS_MAX_FUTURE_SKEW_MS ?? 60_000));
const API_MAX_NAME_LENGTH = Math.max(1, Number(process.env.API_MAX_NAME_LENGTH ?? 80));
const API_MAX_EXTERNAL_ID_LENGTH = Math.max(1, Number(process.env.API_MAX_EXTERNAL_ID_LENGTH ?? 128));
const API_MAX_HISTORY_LIMIT = Math.max(1, Number(process.env.API_MAX_HISTORY_LIMIT ?? 500));
const wsRateLimiter = await createWsRateLimiter();

function requestIdForContext(c: { req: { header: (key: string) => string | undefined }; res: Response }): string | undefined {
  return c.req.header('x-request-id') ?? c.res.headers.get('x-request-id') ?? undefined;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function validateEventTimestamp(ts: unknown): string | null {
  const n = readFiniteNumber(ts);
  if (n == null) return 'Invalid timestamp';
  const now = Date.now();
  if (n < now - WS_MAX_EVENT_AGE_MS) return 'Stale timestamp';
  if (n > now + WS_MAX_FUTURE_SKEW_MS) return 'Timestamp too far in future';
  return null;
}

function validateWsPayload(raw: unknown): string | null {
  if (!isObjectRecord(raw)) return 'Payload must be an object';
  const type = raw.type;
  if (typeof type !== 'string') return 'Payload type is required';

  switch (type) {
    case 'ping': {
      return validateEventTimestamp(raw.ts);
    }

    case 'chat:message': {
      if (typeof raw.text !== 'string') return 'Chat text must be a string';
      const text = raw.text.trim();
      if (!text) return 'Chat text cannot be empty';
      if (text.length > WS_MAX_CHAT_MESSAGE_LENGTH) return 'Chat text too long';
      return validateEventTimestamp(raw.ts);
    }

    case 'location:update': {
      const lat = readFiniteNumber(raw.lat);
      const lng = readFiniteNumber(raw.lng);
      if (lat == null || lng == null) return 'Location coordinates must be numbers';
      if (lat < -90 || lat > 90) return 'Latitude out of range';
      if (lng < -180 || lng > 180) return 'Longitude out of range';
      return validateEventTimestamp(raw.ts);
    }

    case 'session:status': {
      const valid = raw.status === 'pending_partner'
        || raw.status === 'selecting_venue'
        || raw.status === 'pending_agreement'
        || raw.status === 'agreed'
        || raw.status === 'live'
        || raw.status === 'ended';
      return valid ? null : 'Invalid session status';
    }

    case 'session:venue': {
      if (typeof raw.venueId !== 'string') return 'venueId must be a string';
      const venueId = raw.venueId.trim();
      if (!venueId) return 'venueId is required';
      if (venueId.length > 128) return 'venueId too long';
      return null;
    }

    case 'presence:join':
    case 'presence:leave':
      return null;

    default:
      return 'Unsupported message type';
  }
}

function readTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim();
}

function parseHistorySince(value: string | null): { ok: true; sinceMs: number } | { ok: false; error: string } {
  if (!value) return { ok: true, sinceMs: 0 };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return { ok: false, error: 'Invalid since cursor' };
  return { ok: true, sinceMs: parsed };
}

function parseHistoryLimit(value: string | null): { ok: true; limit: number } | { ok: false; error: string } {
  if (!value) return { ok: true, limit: 100 };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return { ok: false, error: 'Invalid history limit' };
  return { ok: true, limit: Math.min(Math.floor(parsed), API_MAX_HISTORY_LIMIT) };
}

async function isOwnerAuthorized(sessionId: string, userId: string): Promise<boolean> {
  if (hasDb()) {
    const role = await getDbParticipantRole(sessionId, userId);
    return role === 'owner';
  }
  return sessions.getRole(sessionId, userId) === 'owner';
}

async function isMemberAuthorized(sessionId: string, userId: string): Promise<boolean> {
  if (hasDb()) {
    const role = await getDbParticipantRole(sessionId, userId);
    return role === 'owner' || role === 'member';
  }
  const role = sessions.getRole(sessionId, userId);
  return role === 'owner' || role === 'member';
}

app.use('/*', cors({ origin: ORIGIN }));

app.use('/*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? createCorrelationId();
  const startedAt = Date.now();
  c.header('x-request-id', requestId);
  await next();

  const path = new URL(c.req.url).pathname;
  auditLog('info', 'http.request', {
    requestId,
    method: c.req.method,
    path,
    status: c.res.status,
    durationMs: Date.now() - startedAt,
  });
});

app.use('/api/sessions/*', async (c, next) => {
  if (!STRICT_AUTH) return next();
  if (!isRequestAuthenticated(c.req.raw)) {
    auditLog('warn', 'http.auth.unauthorized', {
      requestId: requestIdForContext(c),
      path: new URL(c.req.url).pathname,
      method: c.req.method,
    });
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

app.use('/api/me/*', async (c, next) => {
  if (!STRICT_AUTH) return next();
  if (!isRequestAuthenticated(c.req.raw)) {
    auditLog('warn', 'http.auth.unauthorized', {
      requestId: requestIdForContext(c),
      path: new URL(c.req.url).pathname,
      method: c.req.method,
    });
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
});

app.get('/health/live', (c) => c.json({ ok: true, service: '2bottles-backend' }));
app.get('/health/ready', (c) => c.json({ ok: true, ws: true }));

app.get('/api/me/entitlements', async (c) => {
  const identity = resolveIdentity(c.req.raw);
  const fromDb = await readMembershipTier(identity.userId);
  const membership = fromDb ?? identity.membership;
  return c.json({ membership, maxParticipants: membership === 'paid' ? 16 : 2 });
});

app.post('/api/sessions', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isObjectRecord(body)) return c.json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);

  const ownerNameRaw = body.ownerName;
  if (ownerNameRaw != null && typeof ownerNameRaw !== 'string') {
    return c.json({ error: 'bad_request', message: 'ownerName must be a string' }, 400);
  }
  const ownerName = readTrimmedString(ownerNameRaw);
  if (ownerName && ownerName.length > API_MAX_NAME_LENGTH) {
    return c.json({ error: 'bad_request', message: 'ownerName too long' }, 400);
  }

  const requestedMaxRaw = body.maxParticipants;
  const requestedMaxParsed = Number(requestedMaxRaw ?? 2);
  if (!Number.isFinite(requestedMaxParsed) || requestedMaxParsed < 2) {
    return c.json({ error: 'bad_request', message: 'maxParticipants must be a number >= 2' }, 400);
  }

  const identity = resolveIdentity(c.req.raw);
  const membership = (await readMembershipTier(identity.userId)) ?? identity.membership;
  const ownerUserId = identity.userId;
  const ownerNameFinal = ownerName ?? identity.name;

  const requestedMax = Math.floor(requestedMaxParsed);
  const allowedMax = membership === 'paid' ? 16 : 2;
  const maxParticipants = Math.max(2, Math.min(requestedMax, allowedMax));

  const session = (await createDbSession(ownerUserId, ownerNameFinal, maxParticipants))
    ?? sessions.create(ownerUserId, ownerNameFinal, maxParticipants);

  return c.json({
    session: {
      id: session.id,
      link: `${new URL(c.req.url).origin}/join/${session.id}`,
      status: session.status,
      createdAt: session.createdAt,
      venueId: session.venueId ?? null,
    },
  });
});

app.get('/api/sessions/:id', async (c) => {
  const id = c.req.param('id');
  const session = (await getDbSession(id)) ?? sessions.get(id);
  if (!session) return c.json({ error: 'not_found' }, 404);

  return c.json({
    session: {
      id: session.id,
      link: `${new URL(c.req.url).origin}/join/${session.id}`,
      status: session.status,
      createdAt: session.createdAt,
      venueId: session.venueId ?? null,
    },
    partner: null,
  });
});

app.get('/api/sessions/:id/history', async (c) => {
  const id = c.req.param('id');
  const sinceInput = parseHistorySince(c.req.query('since') ?? null);
  if (!sinceInput.ok) return c.json({ error: 'bad_request', message: sinceInput.error }, 400);
  const limitInput = parseHistoryLimit(c.req.query('limit') ?? null);
  if (!limitInput.ok) return c.json({ error: 'bad_request', message: limitInput.error }, 400);

  if (!hasDb()) {
    const session = sessions.get(id);
    if (!session) return c.json({ error: 'not_found' }, 404);
    return c.json({
      session: {
        id: session.id,
        status: session.status,
        venueId: session.venueId ?? null,
        participants: session.participants.map((p) => ({ userId: p.userId, name: p.name, online: true })),
      },
      cursor: Date.now(),
      latestLocations: [],
      locationEvents: [],
      chat: [],
      events: [],
    });
  }

  const history = await getSessionHistory(id, { sinceMs: sinceInput.sinceMs, chatLimit: limitInput.limit });
  if (!history) return c.json({ error: 'not_found' }, 404);

  return c.json({
    session: {
      id: history.sessionId,
      status: history.status,
      venueId: history.venueId ?? null,
      participants: history.participants,
    },
    cursor: history.cursor,
    latestLocations: history.latestLocations,
    locationEvents: history.locationEvents,
    chat: history.chat,
    events: history.events,
  });
});

app.post('/api/sessions/:id/join', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isObjectRecord(body)) return c.json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);

  const requestedUserIdRaw = body.userId;
  if (requestedUserIdRaw != null && typeof requestedUserIdRaw !== 'string') {
    return c.json({ error: 'bad_request', message: 'userId must be a string' }, 400);
  }
  const requestedUserId = readTrimmedString(requestedUserIdRaw) ?? '';
  if (requestedUserId.length > API_MAX_EXTERNAL_ID_LENGTH) {
    return c.json({ error: 'bad_request', message: 'userId too long' }, 400);
  }

  const nameRaw = body.name;
  if (nameRaw != null && typeof nameRaw !== 'string') {
    return c.json({ error: 'bad_request', message: 'name must be a string' }, 400);
  }
  const name = readTrimmedString(nameRaw) ?? undefined;
  if (name && name.length > API_MAX_NAME_LENGTH) {
    return c.json({ error: 'bad_request', message: 'name too long' }, 400);
  }

  const identity = resolveIdentity(c.req.raw);
  const userId = normalizeUserId(requestedUserId || identity.userId);
  const resolvedName = name ?? identity.name;
  const sessionId = c.req.param('id');

  if (hasDb()) {
    const code = await joinDbSession(sessionId, userId, resolvedName);
    if (code !== 'ok') {
      const status = code === 'not_found' ? 404 : code === 'full' ? 409 : 410;
      return c.json({ error: code }, status);
    }
    const dbSession = await getDbSession(sessionId);
    return c.json({ session: dbSession });
  }

  const result = sessions.join(sessionId, userId, resolvedName);

  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : result.code === 'full' ? 409 : 410;
    return c.json({ error: result.code }, status);
  }
  return c.json({ session: result.session });
});

app.post('/api/sessions/invite', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? '');
  const identity = resolveIdentity(c.req.raw);
  const session = (await getDbSession(sessionId)) ?? sessions.get(sessionId);
  if (!sessionId || !session) return c.json({ error: 'not_found' }, 404);
  const ownerAllowed = await isOwnerAuthorized(sessionId, identity.userId);
  if (!ownerAllowed) return c.json({ error: 'forbidden' }, 403);
  return c.json({ ok: true });
});

app.post('/api/sessions/venues', async () => {
  // Venue suggestion logic remains frontend-side for now.
  return Response.json({ venues: [] });
});

app.patch('/api/sessions/:id/venue', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  if (!isObjectRecord(body)) return c.json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);

  const identity = resolveIdentity(c.req.raw);
  const ownerAllowed = await isOwnerAuthorized(id, identity.userId);
  if (!ownerAllowed) {
    auditLog('warn', 'http.auth.forbidden', {
      requestId: requestIdForContext(c),
      path: `/api/sessions/${id}/venue`,
      userId: identity.userId,
      reason: 'owner_required',
    });
    return c.json({ error: 'forbidden' }, 403);
  }

  const venueIdRaw = body.venueId;
  if (venueIdRaw != null && typeof venueIdRaw !== 'string') {
    return c.json({ error: 'bad_request', message: 'venueId must be a string or null' }, 400);
  }
  const venueId = typeof venueIdRaw === 'string' ? venueIdRaw.trim() : '';
  if (venueId.length > API_MAX_EXTERNAL_ID_LENGTH) {
    return c.json({ error: 'bad_request', message: 'venueId too long' }, 400);
  }
  const nextVenueId = venueId || null;

  if (hasDb()) {
    const ok = await updateDbSessionVenue(id, nextVenueId);
    if (!ok) return c.json({ error: 'not_found' }, 404);
    await insertSessionEvent(id, identity.userId, 'session:venue', { venueId: nextVenueId }).catch(() => undefined);
    return c.json({ ok: true, venueId: nextVenueId });
  }

  const ok = sessions.setVenue(id, nextVenueId);
  if (!ok) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true, venueId: nextVenueId });
});

app.post('/api/sessions/:id/end', async (c) => {
  const id = c.req.param('id');
  const identity = resolveIdentity(c.req.raw);
  const ownerAllowed = await isOwnerAuthorized(id, identity.userId);
  if (!ownerAllowed) {
    auditLog('warn', 'http.auth.forbidden', {
      requestId: requestIdForContext(c),
      path: `/api/sessions/${id}/end`,
      userId: identity.userId,
      reason: 'owner_required',
    });
    return c.json({ error: 'forbidden' }, 403);
  }

  const ok = (await endDbSession(id)) || sessions.end(id);
  if (!ok) return c.json({ error: 'not_found' }, 404);
  if (hasDb()) {
    await insertSessionEvent(id, identity.userId, 'session:status', { status: 'ended' }).catch(() => undefined);
  }
  return c.json({ ok: true });
});

app.delete('/api/sessions/:id', async (c) => {
  const id = c.req.param('id');
  const identity = resolveIdentity(c.req.raw);
  const ownerAllowed = await isOwnerAuthorized(id, identity.userId);
  if (!ownerAllowed) {
    auditLog('warn', 'http.auth.forbidden', {
      requestId: requestIdForContext(c),
      path: `/api/sessions/${id}`,
      userId: identity.userId,
      reason: 'owner_required',
    });
    return c.json({ error: 'forbidden' }, 403);
  }

  const ok = (await endDbSession(id)) || sessions.end(id);
  if (!ok) return c.json({ error: 'not_found' }, 404);
  if (hasDb()) {
    await insertSessionEvent(id, identity.userId, 'session:status', { status: 'ended' }).catch(() => undefined);
  }
  return c.json({ ok: true });
});

const server = Bun.serve<{ ctx: SocketContext }>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);
    const requestId = req.headers.get('x-request-id') ?? createCorrelationId();

    if (url.pathname === '/ws') {
      if (STRICT_AUTH && !isRequestAuthenticated(req)) {
        auditLog('warn', 'ws.auth.unauthorized', { requestId, path: '/ws' });
        return new Response('Unauthorized', { status: 401 });
      }

      const identity = resolveIdentity(req);
      const sessionId = url.searchParams.get('sessionId') ?? '';
      const requestedUserId = (url.searchParams.get('userId') ?? '').trim();
      const userId = normalizeUserId(requestedUserId || identity.userId);
      const name = identity.name ?? (url.searchParams.get('name') ?? undefined);

      if (!sessionId) {
        return new Response('Missing sessionId or userId', { status: 400 });
      }

      // Validate membership in the session and enforce participant limits before opening socket.
      if (hasDb()) {
        const code = await joinDbSession(sessionId, userId, name);
        if (code !== 'ok') {
          const status = code === 'not_found' ? 404 : code === 'full' ? 409 : 410;
          return new Response(code, { status });
        }
      } else {
        const joined = sessions.join(sessionId, userId, name);
        if (!joined.ok) {
          const status = joined.code === 'not_found' ? 404 : joined.code === 'full' ? 409 : 410;
          return new Response(joined.code, { status });
        }
      }

      const socketId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

      const upgraded = server.upgrade(req, {
        data: {
          ctx: { socketId, requestId, sessionId, userId, name },
        },
      });

      if (upgraded) {
        auditLog('info', 'ws.upgrade.success', { requestId, socketId, sessionId, userId });
        return;
      }
      auditLog('warn', 'ws.upgrade.failed', { requestId, sessionId, userId });
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      auditLog('info', 'ws.connection.open', {
        requestId: ws.data.ctx.requestId,
        socketId: ws.data.ctx.socketId,
        sessionId: ws.data.ctx.sessionId,
        userId: ws.data.ctx.userId,
      });
      hub.join(ws.data.ctx.sessionId, { ws, ctx: ws.data.ctx });
    },
    message(ws, message) {
      try {
        const parsedRaw = JSON.parse(String(message)) as unknown;
        const validation = validateWsPayload(parsedRaw);
        if (validation) {
          auditLog('warn', 'ws.payload.invalid', {
            requestId: ws.data.ctx.requestId,
            socketId: ws.data.ctx.socketId,
            sessionId: ws.data.ctx.sessionId,
            userId: ws.data.ctx.userId,
            reason: validation,
          });
          ws.send(JSON.stringify({ type: 'error', code: 'invalid_payload', message: validation }));
          return;
        }

        const parsed = parsedRaw as ClientToServerMessage;
        const run = async () => {
          // Defense-in-depth: only active participants may emit session-scoped WS messages.
          if (
            parsed.type === 'chat:message'
            || parsed.type === 'location:update'
            || parsed.type === 'session:status'
            || parsed.type === 'session:venue'
            || parsed.type === 'presence:join'
            || parsed.type === 'presence:leave'
          ) {
            const memberAllowed = await isMemberAuthorized(ws.data.ctx.sessionId, ws.data.ctx.userId);
            if (!memberAllowed) {
              auditLog('warn', 'ws.auth.forbidden', {
                requestId: ws.data.ctx.requestId,
                socketId: ws.data.ctx.socketId,
                sessionId: ws.data.ctx.sessionId,
                userId: ws.data.ctx.userId,
                reason: 'member_required',
                messageType: parsed.type,
              });
              ws.send(JSON.stringify({ type: 'error', code: 'forbidden', message: 'Session membership required' }));
              return;
            }
          }

          if (parsed.type === 'session:status' || parsed.type === 'session:venue') {
            const ownerAllowed = await isOwnerAuthorized(ws.data.ctx.sessionId, ws.data.ctx.userId);
            if (!ownerAllowed) {
              auditLog('warn', 'ws.auth.forbidden', {
                requestId: ws.data.ctx.requestId,
                socketId: ws.data.ctx.socketId,
                sessionId: ws.data.ctx.sessionId,
                userId: ws.data.ctx.userId,
                reason: 'owner_required',
                messageType: parsed.type,
              });
              ws.send(JSON.stringify({ type: 'error', code: 'forbidden', message: 'Owner role required' }));
              return;
            }
          }

          if (parsed.type === 'chat:message') {
            const key = `${ws.data.ctx.sessionId}:${ws.data.ctx.userId}:chat`;
            const rate = await wsRateLimiter.consume(key, CHAT_RATE_LIMIT_COUNT, CHAT_RATE_LIMIT_WINDOW_MS);
            if (!rate.ok) {
              auditLog('warn', 'ws.rate_limited', {
                requestId: ws.data.ctx.requestId,
                socketId: ws.data.ctx.socketId,
                sessionId: ws.data.ctx.sessionId,
                userId: ws.data.ctx.userId,
                channel: 'chat',
                retryMs: rate.retryMs,
              });
              ws.send(JSON.stringify({
                type: 'error',
                code: 'rate_limited',
                message: `Too many chat messages. Retry in ${Math.ceil((rate.retryMs ?? 0) / 1000)}s`,
              }));
              return;
            }
          }

          if (parsed.type === 'location:update') {
            const key = `${ws.data.ctx.sessionId}:${ws.data.ctx.userId}:location`;
            const rate = await wsRateLimiter.consume(key, LOCATION_RATE_LIMIT_COUNT, LOCATION_RATE_LIMIT_WINDOW_MS);
            if (!rate.ok) {
              auditLog('warn', 'ws.rate_limited', {
                requestId: ws.data.ctx.requestId,
                socketId: ws.data.ctx.socketId,
                sessionId: ws.data.ctx.sessionId,
                userId: ws.data.ctx.userId,
                channel: 'location',
                retryMs: rate.retryMs,
              });
              ws.send(JSON.stringify({
                type: 'error',
                code: 'rate_limited',
                message: `Too many location updates. Retry in ${Math.ceil((rate.retryMs ?? 0) / 1000)}s`,
              }));
              return;
            }
          }

          await hub.handleMessage(ws, parsed);
        };

        void run().catch(() => {
          auditLog('error', 'ws.message.error', {
            requestId: ws.data.ctx.requestId,
            socketId: ws.data.ctx.socketId,
            sessionId: ws.data.ctx.sessionId,
            userId: ws.data.ctx.userId,
          });
          ws.send(JSON.stringify({ type: 'error', code: 'internal_error', message: 'Failed to process WS message' }));
        });
      } catch {
        auditLog('warn', 'ws.payload.bad_json', {
          requestId: ws.data.ctx.requestId,
          socketId: ws.data.ctx.socketId,
          sessionId: ws.data.ctx.sessionId,
          userId: ws.data.ctx.userId,
        });
        ws.send(JSON.stringify({ type: 'error', code: 'bad_message', message: 'Invalid WS payload' }));
      }
    },
    close(ws) {
      auditLog('info', 'ws.connection.close', {
        requestId: ws.data.ctx.requestId,
        socketId: ws.data.ctx.socketId,
        sessionId: ws.data.ctx.sessionId,
        userId: ws.data.ctx.userId,
      });
      hub.leave(ws.data.ctx.sessionId, ws.data.ctx.socketId);
    },
  },
});

console.log(`[backend] listening on :${PORT}`);

process.on('SIGTERM', () => {
  hub.close();
  server.stop();
  void redisDistributor?.close?.();
  void wsRateLimiter.close?.();
});
