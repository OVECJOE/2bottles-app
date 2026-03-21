type DemoAnalyticsPayload = {
  name: string;
  step: string;
  stepIndex: number;
  at: number;
  meta?: Record<string, unknown>;
};

const QUEUE_LIMIT = 25;
const FLUSH_INTERVAL_MS = 5000;

let initialized = false;
let queue: DemoAnalyticsPayload[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

function endpoint(): string {
  return (import.meta.env.VITE_DEMO_ANALYTICS_ENDPOINT as string | undefined) || '';
}

function flushWithBeacon(url: string, payload: DemoAnalyticsPayload[]): boolean {
  if (!navigator.sendBeacon) return false;
  try {
    const body = JSON.stringify({ events: payload });
    return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
  } catch {
    return false;
  }
}

async function flushWithFetch(url: string, payload: DemoAnalyticsPayload[]): Promise<void> {
  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ events: payload }),
    keepalive: true,
  });
}

async function flush(): Promise<void> {
  if (!queue.length) return;

  const url = endpoint();
  if (!url) {
    queue = [];
    return;
  }

  const payload = queue;
  queue = [];

  const sent = flushWithBeacon(url, payload);
  if (sent) return;

  try {
    await flushWithFetch(url, payload);
  } catch {
    queue = payload.concat(queue).slice(-QUEUE_LIMIT);
  }
}

function onEvent(event: Event) {
  const detail = (event as CustomEvent<DemoAnalyticsPayload>).detail;
  if (!detail) return;

  queue.push(detail);
  if (queue.length >= QUEUE_LIMIT) {
    void flush();
  }
}

export function initDemoAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('demo-analytics', onEvent as EventListener);

  timer = setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);

  window.addEventListener('pagehide', () => {
    void flush();
  });

  window.addEventListener('beforeunload', () => {
    void flush();
  });
}

export function stopDemoAnalytics(): void {
  if (!initialized || typeof window === 'undefined') return;
  initialized = false;
  window.removeEventListener('demo-analytics', onEvent as EventListener);
  if (timer) clearInterval(timer);
  timer = null;
}
