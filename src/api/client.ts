const BASE = '/api';
const TIMEOUT_MS = 12_000;
const AUTH_TOKEN_KEY = '2b:token';

interface AuthTokenClaims {
    sub?: string;
    userId?: string;
    name?: string;
    displayName?: string;
    exp?: number;
    [key: string]: unknown;
}

function decodeTokenClaims(token: string): AuthTokenClaims | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(normalized)) as AuthTokenClaims;
    } catch {
        return null;
    }
}

export function getAuthToken(): string | null {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token.trim());
}

export function clearAuthToken(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthUserIdFromToken(): string | null {
    const token = getAuthToken();
    if (!token) return null;

    const claims = decodeTokenClaims(token);
    if (!claims) return null;
    if (typeof claims.sub === 'string' && claims.sub.trim()) return claims.sub.trim();
    if (typeof claims.userId === 'string' && claims.userId.trim()) return claims.userId.trim();
    return null;
}

export function getAuthDisplayNameFromToken(): string | null {
    const token = getAuthToken();
    if (!token) return null;

    const claims = decodeTokenClaims(token);
    if (!claims) return null;

    if (typeof claims.name === 'string' && claims.name.trim()) return claims.name.trim();
    if (typeof claims.displayName === 'string' && claims.displayName.trim()) return claims.displayName.trim();
    return null;
}

export class ApiError extends Error {
    public status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const token = getAuthToken();

    const res = await fetch(`${BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init.headers,
        },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
        const body = await res.json().catch(() => ({ message: res.statusText }));
        throw new ApiError(res.status, body.message ?? res.statusText);
    }

    return res.json() as Promise<T>;
}

export const api = {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
    patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};