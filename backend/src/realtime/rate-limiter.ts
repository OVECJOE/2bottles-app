import { createClient } from 'redis';

export interface RateLimitResult {
  ok: boolean;
  retryMs?: number;
}

export interface WsRateLimiter {
  mode: 'memory' | 'redis';
  consume(key: string, maxPerWindow: number, windowMs: number): Promise<RateLimitResult>;
  close?: () => Promise<void>;
}

class MemoryWsRateLimiter implements WsRateLimiter {
  mode: 'memory' = 'memory';
  private windows = new Map<string, { count: number; windowStart: number }>();
  private counter = 0;

  async consume(key: string, maxPerWindow: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const record = this.windows.get(key);

    if (!record || now - record.windowStart >= windowMs) {
      this.windows.set(key, { count: 1, windowStart: now });
      return { ok: true };
    }

    if (record.count >= maxPerWindow) {
      const retryMs = Math.max(0, record.windowStart + windowMs - now);
      return { ok: false, retryMs };
    }

    record.count += 1;
    this.windows.set(key, record);

    // Opportunistic cleanup to avoid unbounded map growth on long-lived nodes.
    this.counter += 1;
    if (this.counter % 256 === 0) {
      for (const [k, v] of this.windows.entries()) {
        if (now - v.windowStart >= windowMs * 2) this.windows.delete(k);
      }
    }

    return { ok: true };
  }
}

class RedisWsRateLimiter implements WsRateLimiter {
  mode: 'redis' = 'redis';
  private client: ReturnType<typeof createClient>;

  constructor(
    private redisUrl: string,
    private prefix: string,
  ) {
    this.client = createClient({ url: this.redisUrl });
    this.client.on('error', (err) => {
      console.error('[backend] redis rate-limiter error:', err);
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async consume(key: string, maxPerWindow: number, windowMs: number): Promise<RateLimitResult> {
    const rateKey = `${this.prefix}:${key}`;
    const count = await this.client.incr(rateKey);

    if (count === 1) {
      await this.client.pExpire(rateKey, windowMs);
    }

    if (count <= maxPerWindow) {
      return { ok: true };
    }

    let ttlMs = await this.client.pTTL(rateKey);
    if (ttlMs < 0) {
      await this.client.pExpire(rateKey, windowMs);
      ttlMs = windowMs;
    }

    return {
      ok: false,
      retryMs: ttlMs,
    };
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}

export async function createWsRateLimiter(): Promise<WsRateLimiter> {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return new MemoryWsRateLimiter();
  }

  const prefix = process.env.WS_RATE_LIMIT_PREFIX?.trim() || '2bottles:ws:rate';
  const limiter = new RedisWsRateLimiter(redisUrl, prefix);

  try {
    await limiter.connect();
    return limiter;
  } catch (err) {
    console.error('[backend] failed to initialize redis rate limiter, using in-memory fallback', err);
    return new MemoryWsRateLimiter();
  }
}
