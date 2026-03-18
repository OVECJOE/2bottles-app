import postgres from 'postgres';

export type MembershipTier = 'free' | 'paid';
export type SessionStatus = 'pending_partner' | 'selecting_venue' | 'pending_agreement' | 'agreed' | 'live' | 'ended';
export type SessionEventType = 'session:status' | 'session:venue';
export type SessionRole = 'owner' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'rejected';

export interface DbNotificationSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export interface DbNotificationSubscriptionRecord {
  endpoint: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  payload: DbNotificationSubscriptionPayload;
}

export interface DbInviteRecord {
  sessionId: string;
  inviterUserId: string;
  partnerUserId: string;
  status: InviteStatus;
  createdAt: number;
  updatedAt: number;
  respondedAt?: number;
}

export interface DbSessionRecord {
  id: string;
  ownerUserId: string;
  status: SessionStatus;
  venueId?: string;
  maxParticipants: number;
  participants: Array<{ userId: string; name?: string }>;
  createdAt: number;
}

export interface SessionHistoryRecord {
  sessionId: string;
  status: SessionStatus;
  venueId?: string;
  cursor: number;
  participants: Array<{ userId: string; name?: string; online: boolean }>;
  latestLocations: Array<{ userId: string; lat: number; lng: number; ts: number }>;
  locationEvents: Array<{ userId: string; lat: number; lng: number; ts: number }>;
  chat: Array<{ id: string; userId: string; text: string; ts: number }>;
  events: Array<{ id: string; type: SessionEventType; actorUserId?: string; payload: Record<string, unknown>; ts: number }>;
}

interface SessionHistoryOptions {
  sinceMs?: number;
  chatLimit?: number;
}

const DATABASE_URL = process.env.DATABASE_URL;
const sql = DATABASE_URL ? postgres(DATABASE_URL, { max: 10, idle_timeout: 20 }) : null;

function newId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function hasDb() {
  return !!sql;
}

export async function readMembershipTier(userId: string): Promise<MembershipTier | null> {
  if (!sql) return null;
  const rows = await sql<{ tier: MembershipTier }[]>`SELECT tier FROM memberships WHERE user_id = ${userId} LIMIT 1`;
  return rows[0]?.tier ?? null;
}

export async function upsertDbMembershipTier(
  userId: string,
  tier: MembershipTier,
  provider: string,
  providerRef: string | null,
): Promise<void> {
  if (!sql) return;

  await sql.begin(async (tx: any) => {
    await tx`
      INSERT INTO users (id, display_name)
      VALUES (${userId}, NULL)
      ON CONFLICT (id) DO NOTHING
    `;

    await tx`
      INSERT INTO memberships (user_id, tier, paid_at, provider, provider_ref, updated_at)
      VALUES (
        ${userId},
        ${tier},
        ${tier === 'paid' ? tx`NOW()` : null},
        ${provider},
        ${providerRef},
        NOW()
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        tier = EXCLUDED.tier,
        paid_at = CASE
          WHEN EXCLUDED.tier = 'paid' THEN COALESCE(memberships.paid_at, NOW())
          ELSE NULL
        END,
        provider = EXCLUDED.provider,
        provider_ref = EXCLUDED.provider_ref,
        updated_at = NOW()
    `;
  });
}

export async function recordDbPaymentWebhookEvent(
  provider: string,
  eventId: string,
  eventType: string,
  userId: string | null,
  providerRef: string | null,
  payload: Record<string, unknown>,
): Promise<boolean> {
  if (!sql) return true;

  const rows = await sql<{ inserted: number }[]>`
    INSERT INTO payment_webhook_events (provider, event_id, event_type, user_id, provider_ref, payload)
    VALUES (${provider}, ${eventId}, ${eventType}, ${userId}, ${providerRef}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING 1 as inserted
  `;

  return rows.length > 0;
}

export async function upsertDbNotificationSubscription(
  userId: string,
  payload: DbNotificationSubscriptionPayload,
): Promise<DbNotificationSubscriptionRecord | null> {
  if (!sql) return null;

  await sql.begin(async (tx: any) => {
    await tx`
      INSERT INTO users (id, display_name)
      VALUES (${userId}, NULL)
      ON CONFLICT (id) DO NOTHING
    `;

    await tx`
      INSERT INTO notification_subscriptions (
        endpoint,
        user_id,
        expiration_time_ms,
        p256dh,
        auth,
        payload
      ) VALUES (
        ${payload.endpoint},
        ${userId},
        ${payload.expirationTime ?? null},
        ${payload.keys?.p256dh ?? null},
        ${payload.keys?.auth ?? null},
        ${JSON.stringify(payload)}::jsonb
      )
      ON CONFLICT (endpoint)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        expiration_time_ms = EXCLUDED.expiration_time_ms,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  });

  const rows = await sql<{
    endpoint: string;
    user_id: string;
    created_at: Date;
    updated_at: Date;
    payload: unknown;
  }[]>`
    SELECT endpoint, user_id, created_at, updated_at, payload
    FROM notification_subscriptions
    WHERE endpoint = ${payload.endpoint}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;
  const parsedPayload = typeof row.payload === 'object' && row.payload && !Array.isArray(row.payload)
    ? row.payload as Record<string, unknown>
    : {};

  return {
    endpoint: row.endpoint,
    userId: row.user_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    payload: {
      endpoint: String(parsedPayload.endpoint ?? row.endpoint),
      expirationTime: typeof parsedPayload.expirationTime === 'number' ? parsedPayload.expirationTime : null,
      keys: {
        p256dh: typeof parsedPayload.keys === 'object' && parsedPayload.keys && !Array.isArray(parsedPayload.keys)
          && typeof (parsedPayload.keys as Record<string, unknown>).p256dh === 'string'
          ? (parsedPayload.keys as Record<string, string>).p256dh
          : undefined,
        auth: typeof parsedPayload.keys === 'object' && parsedPayload.keys && !Array.isArray(parsedPayload.keys)
          && typeof (parsedPayload.keys as Record<string, unknown>).auth === 'string'
          ? (parsedPayload.keys as Record<string, string>).auth
          : undefined,
      },
    },
  };
}

export async function removeDbNotificationSubscription(userId: string, endpoint: string): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql<{ endpoint: string }[]>`
    DELETE FROM notification_subscriptions
    WHERE endpoint = ${endpoint} AND user_id = ${userId}
    RETURNING endpoint
  `;
  return rows.length > 0;
}

export async function listDbNotificationSubscriptionsForUser(userId: string): Promise<DbNotificationSubscriptionRecord[]> {
  if (!sql) return [];
  const rows = await sql<{
    endpoint: string;
    user_id: string;
    created_at: Date;
    updated_at: Date;
    payload: unknown;
  }[]>`
    SELECT endpoint, user_id, created_at, updated_at, payload
    FROM notification_subscriptions
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  return rows.map((row) => {
    const parsedPayload = typeof row.payload === 'object' && row.payload && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown>
      : {};
    return {
      endpoint: row.endpoint,
      userId: row.user_id,
      createdAt: new Date(row.created_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      payload: {
        endpoint: String(parsedPayload.endpoint ?? row.endpoint),
        expirationTime: typeof parsedPayload.expirationTime === 'number' ? parsedPayload.expirationTime : null,
        keys: {
          p256dh: typeof parsedPayload.keys === 'object' && parsedPayload.keys && !Array.isArray(parsedPayload.keys)
            && typeof (parsedPayload.keys as Record<string, unknown>).p256dh === 'string'
            ? (parsedPayload.keys as Record<string, string>).p256dh
            : undefined,
          auth: typeof parsedPayload.keys === 'object' && parsedPayload.keys && !Array.isArray(parsedPayload.keys)
            && typeof (parsedPayload.keys as Record<string, unknown>).auth === 'string'
            ? (parsedPayload.keys as Record<string, string>).auth
            : undefined,
        },
      },
    };
  });
}

export async function upsertDbInvite(sessionId: string, inviterUserId: string, partnerUserId: string): Promise<DbInviteRecord | null> {
  if (!sql) return null;

  await sql.begin(async (tx: any) => {
    await tx`
      INSERT INTO users (id, display_name)
      VALUES (${inviterUserId}, NULL)
      ON CONFLICT (id) DO NOTHING
    `;
    await tx`
      INSERT INTO users (id, display_name)
      VALUES (${partnerUserId}, NULL)
      ON CONFLICT (id) DO NOTHING
    `;

    await tx`
      INSERT INTO session_invites (session_id, inviter_user_id, partner_user_id, status)
      VALUES (${sessionId}, ${inviterUserId}, ${partnerUserId}, 'pending')
      ON CONFLICT (session_id, partner_user_id)
      DO UPDATE SET
        inviter_user_id = EXCLUDED.inviter_user_id,
        status = 'pending',
        responded_at = NULL,
        updated_at = NOW()
    `;
  });

  return getDbInvite(sessionId, partnerUserId);
}

export async function getDbInvite(sessionId: string, partnerUserId: string): Promise<DbInviteRecord | null> {
  if (!sql) return null;
  const rows = await sql<{
    session_id: string;
    inviter_user_id: string;
    partner_user_id: string;
    status: InviteStatus;
    created_at: Date;
    updated_at: Date;
    responded_at: Date | null;
  }[]>`
    SELECT session_id, inviter_user_id, partner_user_id, status, created_at, updated_at, responded_at
    FROM session_invites
    WHERE session_id = ${sessionId} AND partner_user_id = ${partnerUserId}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.session_id,
    inviterUserId: row.inviter_user_id,
    partnerUserId: row.partner_user_id,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : undefined,
  };
}

export async function listDbInvitesForPartner(partnerUserId: string, status: InviteStatus = 'pending'): Promise<DbInviteRecord[]> {
  if (!sql) return [];
  const rows = await sql<{
    session_id: string;
    inviter_user_id: string;
    partner_user_id: string;
    status: InviteStatus;
    created_at: Date;
    updated_at: Date;
    responded_at: Date | null;
  }[]>`
    SELECT session_id, inviter_user_id, partner_user_id, status, created_at, updated_at, responded_at
    FROM session_invites
    WHERE partner_user_id = ${partnerUserId}
      AND status = ${status}
    ORDER BY updated_at DESC
  `;

  return rows.map((row) => ({
    sessionId: row.session_id,
    inviterUserId: row.inviter_user_id,
    partnerUserId: row.partner_user_id,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : undefined,
  }));
}

export async function respondDbInvite(
  sessionId: string,
  partnerUserId: string,
  decision: Exclude<InviteStatus, 'pending'>,
): Promise<DbInviteRecord | null> {
  if (!sql) return null;
  const rows = await sql<{
    session_id: string;
    inviter_user_id: string;
    partner_user_id: string;
    status: InviteStatus;
    created_at: Date;
    updated_at: Date;
    responded_at: Date | null;
  }[]>`
    UPDATE session_invites
    SET status = ${decision}, responded_at = NOW(), updated_at = NOW()
    WHERE session_id = ${sessionId}
      AND partner_user_id = ${partnerUserId}
      AND status = 'pending'
    RETURNING session_id, inviter_user_id, partner_user_id, status, created_at, updated_at, responded_at
  `;

  const row = rows[0];
  if (!row) return null;
  return {
    sessionId: row.session_id,
    inviterUserId: row.inviter_user_id,
    partnerUserId: row.partner_user_id,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    respondedAt: row.responded_at ? new Date(row.responded_at).getTime() : undefined,
  };
}

export async function createDbSession(ownerUserId: string, ownerName: string | undefined, maxParticipants: number): Promise<DbSessionRecord | null> {
  if (!sql) return null;
  const id = newId();
  await sql.begin(async (tx: any) => {
    await tx`
      INSERT INTO sessions (id, owner_user_id, status, max_participants)
      VALUES (${id}, ${ownerUserId}, 'pending_partner', ${maxParticipants})
    `;

    await tx`
      INSERT INTO session_participants (session_id, user_id, role)
      VALUES (${id}, ${ownerUserId}, 'owner')
      ON CONFLICT (session_id, user_id) DO NOTHING
    `;

    await tx`
      INSERT INTO users (id, display_name)
      VALUES (${ownerUserId}, ${ownerName ?? null})
      ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, users.display_name)
    `;
  });

  return getDbSession(id);
}

export async function getDbSession(sessionId: string): Promise<DbSessionRecord | null> {
  if (!sql) return null;

  const sessions = await sql<{
    id: string;
    owner_user_id: string;
    status: DbSessionRecord['status'];
    venue_id: string | null;
    max_participants: number;
    created_at: Date;
  }[]>`SELECT id, owner_user_id, status, venue_id, max_participants, created_at FROM sessions WHERE id = ${sessionId} LIMIT 1`;

  const s = sessions[0];
  if (!s) return null;

  const participants = await sql<{ user_id: string; display_name: string | null }[]>`
    SELECT sp.user_id, u.display_name
    FROM session_participants sp
    LEFT JOIN users u ON u.id = sp.user_id
    WHERE sp.session_id = ${sessionId} AND sp.left_at IS NULL
    ORDER BY sp.joined_at ASC
  `;

  return {
    id: s.id,
    ownerUserId: s.owner_user_id,
    status: s.status,
    venueId: s.venue_id ?? undefined,
    maxParticipants: s.max_participants,
    createdAt: new Date(s.created_at).getTime(),
    participants: participants.map((p: { user_id: string; display_name: string | null }) => ({ userId: p.user_id, name: p.display_name ?? undefined })),
  };
}

export async function joinDbSession(sessionId: string, userId: string, name?: string): Promise<'ok' | 'full' | 'ended' | 'not_found'> {
  if (!sql) return 'not_found';

  return sql.begin(async (tx: any) => {
    const rows = await tx<{ status: DbSessionRecord['status']; max_participants: number }[]>`
      SELECT status, max_participants FROM sessions WHERE id = ${sessionId} LIMIT 1
    `;

    const session = rows[0];
    if (!session) return 'not_found';
    if (session.status === 'ended') return 'ended';

    const existing = await tx<{ exists: number }[]>`
      SELECT 1 as exists FROM session_participants WHERE session_id = ${sessionId} AND user_id = ${userId} AND left_at IS NULL LIMIT 1
    `;
    if (existing[0]) return 'ok';

    const counts = await tx<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM session_participants WHERE session_id = ${sessionId} AND left_at IS NULL
    `;
    if ((counts[0]?.n ?? 0) >= session.max_participants) return 'full';

    await tx`
      INSERT INTO users (id, display_name)
      VALUES (${userId}, ${name ?? null})
      ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, users.display_name)
    `;

    await tx`
      INSERT INTO session_participants (session_id, user_id, role)
      VALUES (${sessionId}, ${userId}, 'member')
      ON CONFLICT (session_id, user_id) DO UPDATE SET left_at = NULL
    `;

    return 'ok';
  });
}

export async function getDbParticipantRole(sessionId: string, userId: string): Promise<SessionRole | null> {
  if (!sql) return null;
  const rows = await sql<{ role: SessionRole }[]>`
    SELECT role
    FROM session_participants
    WHERE session_id = ${sessionId}
      AND user_id = ${userId}
      AND left_at IS NULL
    LIMIT 1
  `;
  return rows[0]?.role ?? null;
}

export async function endDbSession(sessionId: string): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql<{ id: string }[]>`
    UPDATE sessions
    SET status = 'ended', ended_at = NOW()
    WHERE id = ${sessionId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function setParticipantPresence(sessionId: string, userId: string, online: boolean): Promise<void> {
  if (!sql) return;
  await sql`
    INSERT INTO participant_presence (session_id, user_id, online, last_seen_at)
    VALUES (${sessionId}, ${userId}, ${online}, NOW())
    ON CONFLICT (session_id, user_id)
    DO UPDATE SET online = EXCLUDED.online, last_seen_at = NOW()
  `;
}

export async function insertLocationEvent(
  sessionId: string,
  userId: string,
  lat: number,
  lng: number,
  accuracyM?: number,
): Promise<void> {
  if (!sql) return;
  await sql`
    INSERT INTO location_events (session_id, user_id, geom, accuracy_m)
    VALUES (
      ${sessionId},
      ${userId},
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${accuracyM ?? null}
    )
  `;
}

export async function insertChatMessage(sessionId: string, userId: string, id: string, text: string): Promise<void> {
  if (!sql) return;
  await sql`
    INSERT INTO chat_messages (id, session_id, user_id, text)
    VALUES (${id}, ${sessionId}, ${userId}, ${text})
  `;
}

export async function updateDbSessionStatus(sessionId: string, status: SessionStatus): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql<{ id: string }[]>`
    UPDATE sessions
    SET status = ${status}
    WHERE id = ${sessionId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function updateDbSessionVenue(sessionId: string, venueId: string | null): Promise<boolean> {
  if (!sql) return false;
  const rows = await sql<{ id: string }[]>`
    UPDATE sessions
    SET venue_id = ${venueId}
    WHERE id = ${sessionId}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function insertSessionEvent(
  sessionId: string,
  actorUserId: string | null,
  type: SessionEventType,
  payload: Record<string, unknown>,
): Promise<string | null> {
  if (!sql) return null;
  const id = newId();
  const rows = await sql<{ id: string }[]>`
    INSERT INTO session_events (id, session_id, actor_user_id, event_type, payload)
    VALUES (${id}, ${sessionId}, ${actorUserId}, ${type}, ${JSON.stringify(payload)}::jsonb)
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

export async function getSessionHistory(sessionId: string, options: SessionHistoryOptions = {}): Promise<SessionHistoryRecord | null> {
  if (!sql) return null;
  const sinceMs = Number(options.sinceMs ?? 0);
  const hasSince = Number.isFinite(sinceMs) && sinceMs > 0;
  const chatLimit = Math.max(1, Math.min(Number(options.chatLimit ?? 100), 500));
  const sinceDate = new Date(hasSince ? sinceMs : 0);

  const cursorRows = await sql<{ cursor_ts: Date }[]>`SELECT NOW() AS cursor_ts`;
  const cursorDate = cursorRows[0]?.cursor_ts ? new Date(cursorRows[0].cursor_ts) : new Date();

  const sessions = await sql<{ id: string; status: SessionStatus; venue_id: string | null }[]>`
    SELECT id, status, venue_id FROM sessions WHERE id = ${sessionId} LIMIT 1
  `;
  const base = sessions[0];
  if (!base) return null;

  const participants = await sql<{
    user_id: string;
    display_name: string | null;
    online: boolean | null;
  }[]>`
    SELECT sp.user_id, u.display_name, pp.online
    FROM session_participants sp
    LEFT JOIN users u ON u.id = sp.user_id
    LEFT JOIN participant_presence pp ON pp.session_id = sp.session_id AND pp.user_id = sp.user_id
    WHERE sp.session_id = ${sessionId} AND sp.left_at IS NULL
    ORDER BY sp.joined_at ASC
  `;

  let latestLocations: Array<{ user_id: string; lat: number; lng: number; created_at: Date }> = [];
  if (!hasSince) {
    latestLocations = await sql<{
      user_id: string;
      lat: number;
      lng: number;
      created_at: Date;
    }[]>`
      SELECT DISTINCT ON (le.user_id)
        le.user_id,
        ST_Y(le.geom::geometry) AS lat,
        ST_X(le.geom::geometry) AS lng,
        le.created_at
      FROM location_events le
      WHERE le.session_id = ${sessionId}
        AND le.created_at <= ${cursorDate}
      ORDER BY le.user_id, le.created_at DESC
    `;
  }

  const locationEventRows = await sql<{
    user_id: string;
    lat: number;
    lng: number;
    created_at: Date;
  }[]>`
    SELECT le.user_id, ST_Y(le.geom::geometry) AS lat, ST_X(le.geom::geometry) AS lng, le.created_at
    FROM location_events le
    WHERE le.session_id = ${sessionId}
      ${hasSince ? sql`AND le.created_at > ${sinceDate}` : sql``}
      AND le.created_at <= ${cursorDate}
    ORDER BY le.created_at ASC
    LIMIT ${chatLimit}
  `;

  const chatRowsDesc = await sql<{
    id: string;
    user_id: string;
    text: string;
    created_at: Date;
  }[]>`
    SELECT id, user_id, text, created_at
    FROM chat_messages
    WHERE session_id = ${sessionId}
      ${hasSince ? sql`AND created_at > ${sinceDate}` : sql``}
      AND created_at <= ${cursorDate}
    ORDER BY created_at DESC
    LIMIT ${chatLimit}
  `;

  const eventRows = await sql<{
    id: string;
    event_type: SessionEventType;
    actor_user_id: string | null;
    payload: unknown;
    created_at: Date;
  }[]>`
    SELECT id, event_type, actor_user_id, payload, created_at
    FROM session_events
    WHERE session_id = ${sessionId}
      ${hasSince ? sql`AND created_at > ${sinceDate}` : sql``}
      AND created_at <= ${cursorDate}
    ORDER BY created_at DESC
    LIMIT ${chatLimit}
  `;

  const chatRows = chatRowsDesc.reverse();
  const eventsChronological = eventRows.reverse();

  const cursor = new Date(cursorDate).getTime();

  return {
    sessionId: base.id,
    status: base.status,
    venueId: base.venue_id ?? undefined,
    cursor,
    participants: participants.map((p) => ({
      userId: p.user_id,
      name: p.display_name ?? undefined,
      online: Boolean(p.online),
    })),
    latestLocations: latestLocations.map((l) => ({
      userId: l.user_id,
      lat: Number(l.lat),
      lng: Number(l.lng),
      ts: new Date(l.created_at).getTime(),
    })),
    locationEvents: locationEventRows.map((l) => ({
      userId: l.user_id,
      lat: Number(l.lat),
      lng: Number(l.lng),
      ts: new Date(l.created_at).getTime(),
    })),
    chat: chatRows
      .map((m) => ({ id: m.id, userId: m.user_id, text: m.text, ts: new Date(m.created_at).getTime() })),
    events: eventsChronological.map((e) => ({
      id: e.id,
      type: e.event_type,
      actorUserId: e.actor_user_id ?? undefined,
      payload: (typeof e.payload === 'object' && e.payload && !Array.isArray(e.payload)
        ? (e.payload as Record<string, unknown>)
        : {}),
      ts: new Date(e.created_at).getTime(),
    })),
  };
}
