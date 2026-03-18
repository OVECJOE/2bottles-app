import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface RequestIdentity {
  userId: string;
  name?: string;
  membership: 'free' | 'paid';
}

function decodeBase64Url(input: string) {
  const pad = input.length % 4;
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + (pad ? '='.repeat(4 - pad) : '');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function readJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    return JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function verifyJwtHs256(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signatureB64] = parts;

  try {
    const headerRaw = decodeBase64Url(headerB64);
    const header = JSON.parse(headerRaw) as Record<string, unknown>;
    if (String(header.alg ?? '') !== 'HS256') return false;
  } catch {
    return false;
  }

  const data = `${headerB64}.${payloadB64}`;
  const expected = createHmac('sha256', secret).update(data).digest();
  const actual = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

function readBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);

  // Browser WebSocket clients cannot set custom Authorization headers.
  // For WS upgrades we accept token via query string.
  try {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get('token') ?? url.searchParams.get('access_token');
    if (queryToken && queryToken.trim()) return queryToken.trim();
  } catch {
    // Ignore malformed URLs and fall through.
  }

  return null;
}

function isJwtExpired(claims: Record<string, unknown> | null): boolean {
  if (!claims) return true;
  const exp = Number(claims.exp ?? 0);
  if (!Number.isFinite(exp) || exp <= 0) return false;
  return Date.now() >= exp * 1000;
}

function toUuidLike(value: string): string {
  const hex = createHash('sha1').update(value).digest('hex').slice(0, 32);
  const chars = hex.split('');
  chars[12] = '5';
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  return `${chars.slice(0, 8).join('')}-${chars.slice(8, 12).join('')}-${chars.slice(12, 16).join('')}-${chars.slice(16, 20).join('')}-${chars.slice(20, 32).join('')}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeUserId(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim();
  if (!value) return toUuidLike('guest');
  if (UUID_RE.test(value)) return value;
  return toUuidLike(value);
}

export function resolveIdentity(req: Request): RequestIdentity {
  const bearer = readBearerToken(req);
  const jwtSecret = process.env.JWT_SECRET?.trim();

  let claims: Record<string, unknown> | null = null;
  if (bearer) {
    if (jwtSecret) {
      const valid = verifyJwtHs256(bearer, jwtSecret);
      claims = valid ? readJwtPayload(bearer) : null;
    } else {
      // In dev mode (no JWT_SECRET) we accept unverified payloads for local integration.
      claims = readJwtPayload(bearer);
    }
  }
  if (isJwtExpired(claims)) claims = null;

  const headerUser = req.headers.get('x-user-id') ?? undefined;
  const headerName = req.headers.get('x-user-name') ?? undefined;
  const headerTier = req.headers.get('x-membership-tier') ?? undefined;

  const userId = normalizeUserId(String(claims?.sub ?? claims?.userId ?? headerUser ?? 'guest'));
  const name = String(claims?.name ?? claims?.displayName ?? headerName ?? '').trim() || undefined;
  const tierRaw = String(claims?.tier ?? claims?.membership ?? headerTier ?? 'free').toLowerCase();
  const membership = tierRaw === 'paid' ? 'paid' : 'free';

  return { userId, name, membership };
}

export function isRequestAuthenticated(req: Request): boolean {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret) return false;
  const bearer = readBearerToken(req);
  if (!bearer) return false;
  if (!verifyJwtHs256(bearer, jwtSecret)) return false;
  const claims = readJwtPayload(bearer);
  return !isJwtExpired(claims);
}
