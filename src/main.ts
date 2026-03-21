import './styles/global.css';
import { initDemoAnalytics } from './services/demo-analytics.service.js';

const SW_REFRESH_KEY = '2b:sw-refresh-at';
const ONBOARDING_COMPLETED_KEY = '2b:onboarding-completed';
const QUICKSTART_QUERY_KEY = 'quickstart';
type BootMode = 'landing' | 'app';
type LandingAction = 'start' | 'install' | 'skip';

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let bootMode: BootMode | null = null;
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let canInstall = false;

const appRoot = document.getElementById('app') ?? document.body;
initDemoAnalytics();

function isLandingPath(pathname: string): boolean {
    return pathname === '/' || pathname === '/index.html';
}

function hasCompletedOnboarding(): boolean {
    return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === '1';
}

function hasQuickStartIntent(): boolean {
    const value = new URLSearchParams(window.location.search).get(QUICKSTART_QUERY_KEY);
    return value === '1' || value === 'true';
}

function syncLandingInstallCapability() {
    if (bootMode !== 'landing') return;
    const landing = appRoot.querySelector('landing-page') as { canInstall?: boolean } | null;
    if (landing) landing.canInstall = canInstall;
}

async function mountLandingPage() {
    if (bootMode === 'landing') {
        syncLandingInstallCapability();
        return;
    }

    await import('./components/marketing/landing-page.js');
    appRoot.innerHTML = '<landing-page></landing-page>';
    bootMode = 'landing';
    syncLandingInstallCapability();
}

async function mountAppShell() {
    if (bootMode === 'app') return;

    await import('./components/app-shell.js');
    appRoot.innerHTML = '<app-shell></app-shell>';
    bootMode = 'app';
}

async function renderForCurrentPath() {
    if (isLandingPath(window.location.pathname)) {
        if (hasCompletedOnboarding() || hasQuickStartIntent()) {
            localStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
            window.history.replaceState({}, '', '/create-session');
            await mountAppShell();
            return;
        }
        await mountLandingPage();
        return;
    }
    await mountAppShell();
}

async function requestInstallFromLanding() {
    if (!deferredInstallPrompt) return;

    await deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') {
        deferredInstallPrompt = null;
        canInstall = false;
        syncLandingInstallCapability();
    }
}

document.addEventListener('landing-action', async (event) => {
    const detail = (event as CustomEvent<{ action: LandingAction }>).detail;
    if (!detail) return;

    if (detail.action === 'install') {
        await requestInstallFromLanding();
        return;
    }

    if (detail.action === 'skip') {
        localStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
        window.history.pushState({}, '', '/create-session');
        await mountAppShell();
        return;
    }

    localStorage.setItem(ONBOARDING_COMPLETED_KEY, '1');
    window.history.pushState({}, '', '/create-session');
    await mountAppShell();
});

window.addEventListener('beforeinstallprompt', (event) => {
    const installEvent = event as BeforeInstallPromptEvent;
    installEvent.preventDefault();
    deferredInstallPrompt = installEvent;
    canInstall = true;
    syncLandingInstallCapability();
});

window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    canInstall = false;
    syncLandingInstallCapability();
});

window.addEventListener('popstate', () => {
    void renderForCurrentPath();
});

void renderForCurrentPath();

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