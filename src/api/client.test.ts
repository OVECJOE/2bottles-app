import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client.js';

describe('api client', () => {
    it('sends JSON payload with auth header when token exists', async () => {
        localStorage.setItem('2b:token', 'token-123');

        const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
            new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        vi.stubGlobal('fetch', fetchSpy);

        const result = await api.post<{ ok: boolean }>('/sessions', { a: 1 });

        expect(result.ok).toBe(true);
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        const firstCall = fetchSpy.mock.calls[0];
        expect(firstCall).toBeDefined();
        const url = String(firstCall[0]);
        const init = firstCall[1] as RequestInit;
        expect(url).toBe('/api/sessions');
        expect(init.method).toBe('POST');
        expect(init.body).toBe(JSON.stringify({ a: 1 }));

        const headers = init.headers as Record<string, string>;
        expect(headers.Authorization).toBe('Bearer token-123');
        expect(headers['Content-Type']).toBe('application/json');
    });

    it('throws ApiError with backend message for non-2xx', async () => {
        const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
            new Response(JSON.stringify({ message: 'Nope' }), {
                status: 400,
                statusText: 'Bad Request',
                headers: { 'Content-Type': 'application/json' },
            })
        );

        vi.stubGlobal('fetch', fetchSpy);

        await expect(api.get('/sessions/test')).rejects.toEqual(
            expect.objectContaining<ApiError>({
                name: 'ApiError',
                status: 400,
                message: 'Nope',
            })
        );
    });
});
