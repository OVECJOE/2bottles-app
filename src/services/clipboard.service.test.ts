import { describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard.service.js';

describe('copyText', () => {
    it('uses navigator clipboard when available', async () => {
        const writeText = vi.fn(async () => undefined);
        vi.stubGlobal('navigator', {
            ...navigator,
            clipboard: { writeText },
        });

        const ok = await copyText('hello');

        expect(ok).toBe(true);
        expect(writeText).toHaveBeenCalledWith('hello');
    });

    it('falls back to document.execCommand when clipboard API fails', async () => {
        const writeText = vi.fn(async () => {
            throw new Error('blocked');
        });
        vi.stubGlobal('navigator', {
            ...navigator,
            clipboard: { writeText },
        });

        Object.defineProperty(document, 'execCommand', {
            value: () => true,
            configurable: true,
        });
        const execSpy = vi.spyOn(document, 'execCommand').mockReturnValue(true);

        const ok = await copyText('fallback');

        expect(ok).toBe(true);
        expect(execSpy).toHaveBeenCalledWith('copy');
    });
});
