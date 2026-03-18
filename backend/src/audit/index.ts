export type AuditLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<AuditLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const VALID_LEVELS = new Set<AuditLevel>(['debug', 'info', 'warn', 'error']);

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

function readLevel(value: string | undefined): AuditLevel {
  const normalized = (value ?? '').trim().toLowerCase();
  if (VALID_LEVELS.has(normalized as AuditLevel)) {
    return normalized as AuditLevel;
  }
  return 'info';
}

function serialize(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === 'bigint') return value.toString();
  return value;
}

const AUDIT_ENABLED = readBoolean(process.env.AUDIT_LOG_ENABLED, true);
const MIN_LEVEL = readLevel(process.env.AUDIT_LOG_LEVEL);
const AUDIT_SINK = (process.env.AUDIT_LOG_SINK ?? 'console').trim().toLowerCase();

export function createCorrelationId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function auditLog(level: AuditLevel, event: string, fields: Record<string, unknown> = {}): void {
  if (!AUDIT_ENABLED) return;
  if (LEVEL_RANK[level] < LEVEL_RANK[MIN_LEVEL]) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(payload, (_key, value) => serialize(value));

  if (AUDIT_SINK === 'console') {
    if (level === 'error') {
      console.error(line);
      return;
    }
    if (level === 'warn') {
      console.warn(line);
      return;
    }
    console.log(line);
    return;
  }

  // Unknown sinks default to console so audit data is not silently dropped.
  console.log(line);
}
