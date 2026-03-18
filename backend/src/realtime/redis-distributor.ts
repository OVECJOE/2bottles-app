import { createClient } from 'redis';
import type { HubDistributedEvent, RealtimeDistributor } from './hub';

interface RedisEnvelope {
  sourceNodeId: string;
  event: HubDistributedEvent;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isHubEvent(value: unknown): value is HubDistributedEvent {
  if (!isObjectRecord(value)) return false;
  if (value.kind === 'broadcast') {
    return typeof value.sessionId === 'string' && isObjectRecord(value.payload);
  }
  if (value.kind === 'presence') {
    return typeof value.sessionId === 'string'
      && isObjectRecord(value.participant)
      && typeof value.participant.userId === 'string'
      && typeof value.participant.online === 'boolean'
      && (value.participant.name == null || typeof value.participant.name === 'string');
  }
  if (value.kind === 'presence_heartbeat') {
    return typeof value.sessionId === 'string'
      && isObjectRecord(value.participant)
      && typeof value.participant.userId === 'string'
      && (value.participant.name == null || typeof value.participant.name === 'string');
  }
  return false;
}

class RedisDistributorImpl implements RealtimeDistributor {
  private pub: ReturnType<typeof createClient>;
  private sub: ReturnType<typeof createClient>;

  constructor(
    private redisUrl: string,
    private channel: string,
    private nodeId: string,
  ) {
    this.pub = createClient({ url: this.redisUrl });
    this.sub = createClient({ url: this.redisUrl });

    this.pub.on('error', (err) => {
      console.error('[backend] redis publish error:', err);
    });
    this.sub.on('error', (err) => {
      console.error('[backend] redis subscribe error:', err);
    });
  }

  async subscribe(listener: (event: HubDistributedEvent) => void): Promise<void> {
    await this.pub.connect();
    await this.sub.connect();
    await this.sub.subscribe(this.channel, (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (!isObjectRecord(parsed)) return;

        const sourceNodeId = parsed.sourceNodeId;
        const event = parsed.event;
        if (typeof sourceNodeId !== 'string' || !isHubEvent(event)) return;
        if (sourceNodeId === this.nodeId) return;

        listener(event);
      } catch {
        // Ignore malformed pub/sub payloads.
      }
    });
  }

  async publish(event: HubDistributedEvent): Promise<void> {
    const payload: RedisEnvelope = {
      sourceNodeId: this.nodeId,
      event,
    };
    await this.pub.publish(this.channel, JSON.stringify(payload));
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this.sub.quit(),
      this.pub.quit(),
    ]);
  }
}

export async function createRedisDistributor(): Promise<RealtimeDistributor | null> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  const channel = process.env.REDIS_CHANNEL?.trim() || '2bottles:realtime';
  const nodeId = process.env.INSTANCE_ID?.trim()
    || (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2));
  return new RedisDistributorImpl(redisUrl, channel, nodeId);
}
