import { afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    CONNECTING = 0;
    OPEN = 1;
    CLOSING = 2;
    CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    onopen: ((ev: Event) => void) | null = null;
    onclose: ((ev: CloseEvent) => void) | null = null;
    onerror: ((ev: Event) => void) | null = null;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    url: string;
    protocol = '';
    extensions = '';
    binaryType: BinaryType = 'blob';
    bufferedAmount = 0;

    constructor(url: string | URL, _protocols?: string | string[]) {
        this.url = typeof url === 'string' ? url : url.toString();
        setTimeout(() => {
            this.readyState = MockWebSocket.OPEN;
            if (this.onopen) this.onopen(new Event('open'));
        }, 0);
    }

    send(_data: string | ArrayBufferLike | Blob | ArrayBufferView) {}
    close(_code?: number, _reason?: string) {
        this.readyState = MockWebSocket.CLOSED;
        if (this.onclose) this.onclose(new CloseEvent('close'));
    }

    addEventListener(_type: string, _listener: EventListenerOrEventListenerObject) {}
    removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject) {}
    dispatchEvent(_event: Event) { return true; }
}

globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
});
