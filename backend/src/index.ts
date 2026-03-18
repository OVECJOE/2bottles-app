import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { RealtimeHub } from './realtime/hub';
import type { ClientToServerMessage, SocketContext } from './realtime/protocol';
import { SessionStore } from './session-store';
import { normalizeUserId, resolveIdentity } from './auth';
import {
  createDbSession,
  endDbSession,
  getDbSession,
  getSessionHistory,
  hasDb,
  insertChatMessage,
  insertLocationEvent,
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
  },
  async onSessionVenue(event) {
    await updateDbSessionVenue(event.sessionId, event.venueId).catch(() => undefined);
  },
});
const sessions = new SessionStore();

const PORT = Number(process.env.PORT ?? 8080);
const ORIGIN = process.env.CORS_ORIGIN ?? '*';

app.use('/*', cors({ origin: ORIGIN }));

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
  const identity = resolveIdentity(c.req.raw);
  const membership = (await readMembershipTier(identity.userId)) ?? identity.membership;
  const ownerUserId = identity.userId;
  const ownerName = (body.ownerName as string | undefined) ?? identity.name;

  const requestedMax = Number(body.maxParticipants ?? 2);
  const allowedMax = membership === 'paid' ? 16 : 2;
  const maxParticipants = Math.max(2, Math.min(requestedMax, allowedMax));

  const session = (await createDbSession(ownerUserId, ownerName, maxParticipants))
    ?? sessions.create(ownerUserId, ownerName, maxParticipants);

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
      latestLocations: [],
      chat: [],
    });
  }

  const history = await getSessionHistory(id);
  if (!history) return c.json({ error: 'not_found' }, 404);

  return c.json({
    session: {
      id: history.sessionId,
      status: history.status,
      venueId: history.venueId ?? null,
      participants: history.participants,
    },
    latestLocations: history.latestLocations,
    chat: history.chat,
  });
});

app.post('/api/sessions/:id/join', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const identity = resolveIdentity(c.req.raw);
  const requestedUserId = String(body.userId ?? '').trim();
  const userId = normalizeUserId(requestedUserId || identity.userId);
  const name = (body.name as string | undefined) ?? identity.name;
  const sessionId = c.req.param('id');

  if (hasDb()) {
    const code = await joinDbSession(sessionId, userId, name);
    if (code !== 'ok') {
      const status = code === 'not_found' ? 404 : code === 'full' ? 409 : 410;
      return c.json({ error: code }, status);
    }
    const dbSession = await getDbSession(sessionId);
    return c.json({ session: dbSession });
  }

  const result = sessions.join(sessionId, userId, name);

  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : result.code === 'full' ? 409 : 410;
    return c.json({ error: result.code }, status);
  }
  return c.json({ session: result.session });
});

app.post('/api/sessions/invite', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sessionId = String(body.sessionId ?? '');
  const session = (await getDbSession(sessionId)) ?? sessions.get(sessionId);
  if (!sessionId || !session) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

app.post('/api/sessions/venues', async () => {
  // Venue suggestion logic remains frontend-side for now.
  return Response.json({ venues: [] });
});

app.patch('/api/sessions/:id/venue', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const venueIdRaw = body.venueId;
  const venueId = typeof venueIdRaw === 'string' ? venueIdRaw.trim() : '';
  const nextVenueId = venueId || null;

  if (hasDb()) {
    const ok = await updateDbSessionVenue(id, nextVenueId);
    if (!ok) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true, venueId: nextVenueId });
  }

  const ok = sessions.setVenue(id, nextVenueId);
  if (!ok) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true, venueId: nextVenueId });
});

app.post('/api/sessions/:id/end', async (c) => {
  const id = c.req.param('id');
  const ok = (await endDbSession(id)) || sessions.end(id);
  if (!ok) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

app.delete('/api/sessions/:id', async (c) => {
  const id = c.req.param('id');
  const ok = (await endDbSession(id)) || sessions.end(id);
  if (!ok) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

const server = Bun.serve<{ ctx: SocketContext }>({
  port: PORT,
  async fetch(req, server) {
    const url = new URL(req.url);

    if (url.pathname === '/ws') {
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
          ctx: { socketId, sessionId, userId, name },
        },
      });

      if (upgraded) return;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      hub.join(ws.data.ctx.sessionId, { ws, ctx: ws.data.ctx });
    },
    message(ws, message) {
      try {
        const parsed = JSON.parse(String(message)) as ClientToServerMessage;
        void hub.handleMessage(ws, parsed).catch(() => {
          ws.send(JSON.stringify({ type: 'error', code: 'internal_error', message: 'Failed to process WS message' }));
        });
      } catch {
        ws.send(JSON.stringify({ type: 'error', code: 'bad_message', message: 'Invalid WS payload' }));
      }
    },
    close(ws) {
      hub.leave(ws.data.ctx.sessionId, ws.data.ctx.socketId);
    },
  },
});

console.log(`[backend] listening on :${PORT}`);

process.on('SIGTERM', () => {
  server.stop();
});
