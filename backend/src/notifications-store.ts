export interface NotificationSubscriptionRecord {
  endpoint: string;
  userId: string;
  createdAt: number;
  updatedAt: number;
  payload: {
    endpoint: string;
    expirationTime?: number | null;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parsePushSubscriptionPayload(raw: unknown): {
  ok: true;
  value: NotificationSubscriptionRecord['payload'];
} | {
  ok: false;
  error: string;
} {
  if (!isObjectRecord(raw)) return { ok: false, error: 'Invalid JSON body' };

  const endpointRaw = raw.endpoint;
  if (typeof endpointRaw !== 'string') return { ok: false, error: 'endpoint is required' };
  const endpoint = endpointRaw.trim();
  if (!endpoint) return { ok: false, error: 'endpoint is required' };
  if (endpoint.length > 2048) return { ok: false, error: 'endpoint too long' };

  let expirationTime: number | null | undefined;
  if (raw.expirationTime !== undefined && raw.expirationTime !== null) {
    if (typeof raw.expirationTime !== 'number' || !Number.isFinite(raw.expirationTime)) {
      return { ok: false, error: 'expirationTime must be a number or null' };
    }
    expirationTime = raw.expirationTime;
  } else if (raw.expirationTime === null) {
    expirationTime = null;
  }

  let keys: { p256dh?: string; auth?: string } | undefined;
  if (raw.keys !== undefined) {
    if (!isObjectRecord(raw.keys)) return { ok: false, error: 'keys must be an object' };
    const p256dh = typeof raw.keys.p256dh === 'string' ? raw.keys.p256dh : undefined;
    const auth = typeof raw.keys.auth === 'string' ? raw.keys.auth : undefined;
    keys = { p256dh, auth };
  }

  return {
    ok: true,
    value: { endpoint, expirationTime, keys },
  };
}

export class NotificationStore {
  private byEndpoint = new Map<string, NotificationSubscriptionRecord>();
  private endpointsByUser = new Map<string, Set<string>>();

  upsert(userId: string, payload: NotificationSubscriptionRecord['payload']): NotificationSubscriptionRecord {
    const now = Date.now();
    const existing = this.byEndpoint.get(payload.endpoint);

    const record: NotificationSubscriptionRecord = {
      endpoint: payload.endpoint,
      userId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      payload,
    };

    if (existing && existing.userId !== userId) {
      const oldSet = this.endpointsByUser.get(existing.userId);
      oldSet?.delete(existing.endpoint);
      if (oldSet && oldSet.size === 0) this.endpointsByUser.delete(existing.userId);
    }

    this.byEndpoint.set(payload.endpoint, record);

    const userSet = this.endpointsByUser.get(userId) ?? new Set<string>();
    userSet.add(payload.endpoint);
    this.endpointsByUser.set(userId, userSet);

    return record;
  }

  removeByEndpoint(userId: string, endpoint: string): boolean {
    const existing = this.byEndpoint.get(endpoint);
    if (!existing) return false;
    if (existing.userId !== userId) return false;

    this.byEndpoint.delete(endpoint);
    const userSet = this.endpointsByUser.get(userId);
    userSet?.delete(endpoint);
    if (userSet && userSet.size === 0) this.endpointsByUser.delete(userId);
    return true;
  }

  getByUser(userId: string): NotificationSubscriptionRecord[] {
    const endpoints = this.endpointsByUser.get(userId);
    if (!endpoints || endpoints.size === 0) return [];

    const records: NotificationSubscriptionRecord[] = [];
    for (const endpoint of endpoints.values()) {
      const rec = this.byEndpoint.get(endpoint);
      if (rec) records.push(rec);
    }
    return records;
  }
}
