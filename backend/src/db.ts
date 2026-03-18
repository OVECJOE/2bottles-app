import postgres from 'postgres';

export type MembershipTier = 'free' | 'paid';
export type SessionStatus = 'pending_partner' | 'selecting_venue' | 'pending_agreement' | 'agreed' | 'live' | 'ended';

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
  participants: Array<{ userId: string; name?: string; online: boolean }>;
  latestLocations: Array<{ userId: string; lat: number; lng: number; ts: number }>;
  chat: Array<{ id: string; userId: string; text: string; ts: number }>;
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

export async function getSessionHistory(sessionId: string, chatLimit = 100): Promise<SessionHistoryRecord | null> {
  if (!sql) return null;

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

  const latestLocations = await sql<{
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
    ORDER BY le.user_id, le.created_at DESC
  `;

  const chatRows = await sql<{
    id: string;
    user_id: string;
    text: string;
    created_at: Date;
  }[]>`
    SELECT id, user_id, text, created_at
    FROM chat_messages
    WHERE session_id = ${sessionId}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(chatLimit, 500))}
  `;

  return {
    sessionId: base.id,
    status: base.status,
    venueId: base.venue_id ?? undefined,
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
    chat: chatRows
      .reverse()
      .map((m) => ({ id: m.id, userId: m.user_id, text: m.text, ts: new Date(m.created_at).getTime() })),
  };
}
