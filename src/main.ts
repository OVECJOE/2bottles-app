import './styles/global.css';
import './components/app-shell.js';

const SW_REFRESH_KEY = '2b:sw-refresh-at';

function recoverFromDynamicImportFailure(reason: unknown): boolean {
    const msg = String(reason ?? '');
    const isDynamicImportFailure =
        msg.includes('dynamically imported module') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed');

    if (!isDynamicImportFailure) return false;

    const now = Date.now();
    const last = Number(sessionStorage.getItem(SW_REFRESH_KEY) || '0');
    if (now - last < 15_000) return true;

    sessionStorage.setItem(SW_REFRESH_KEY, String(now));
    window.location.reload();
    return true;
}

window.addEventListener('unhandledrejection', (event) => {
    if (recoverFromDynamicImportFailure(event.reason)) {
        event.preventDefault();
    }
});

// -- Service Worker -------------------------------------------
// Vite's ?url suffix gives us the compiled SW path at build
// time. In dev, Vite serves /src/sw/sw.ts directly.
// The SW is registered AFTER the app shell so first paint
// is never blocked by SW installation.
// Service workers are production-only.
// In dev, Vite's HMR handles reloading and the SW path rules
// (must be same-origin, no .ts extension) make dev registration
// unreliable and unnecessary.
if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            });

            // Prompt update check on each app load so stale SW is replaced quickly.
            void registration.update();

            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data?.type === 'ASSET_MISSING_RELOAD') {
                    const now = Date.now();
                    const last = Number(sessionStorage.getItem(SW_REFRESH_KEY) || '0');
                    if (now - last > 10_000) {
                        sessionStorage.setItem(SW_REFRESH_KEY, String(now));
                        window.location.reload();
                    }
                }
            });

            let reloadedOnControllerChange = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (reloadedOnControllerChange) return;
                reloadedOnControllerChange = true;
                const now = Date.now();
                const last = Number(sessionStorage.getItem(SW_REFRESH_KEY) || '0');
                if (now - last > 10_000) {
                    sessionStorage.setItem(SW_REFRESH_KEY, String(now));
                    window.location.reload();
                }
            });

            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker?.addEventListener('statechange', () => {
                    if (
                        newWorker.state === 'installed' &&
                        navigator.serviceWorker.controller
                    ) {
                        console.info('[SW] New version available. Reload to update.');
                    }
                });
            });

            console.info('[SW] Registered:', registration.scope);
        } catch (err) {
            console.error('[SW] Registration failed:', err);
        }
    });
}