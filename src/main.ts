import './styles/global.css';
import './components/app-shell.js';

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