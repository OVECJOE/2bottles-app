import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },

    build: {
        target: 'es2023',           // Lit 3 requires ES2019+; 2022 is safe
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,

        rollupOptions: {
            input: {
                // Main app entry
                main: path.resolve(__dirname, 'index.html'),
                // Service worker — compiled to dist/sw.js (root scope)
                sw: path.resolve(__dirname, 'src/sw/sw.ts'),
            },
            output: {
                // Keep sw.js at the root of dist (required for full scope)
                entryFileNames: (chunk) =>
                    chunk.name === 'sw' ? '[name].js' : 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',

                // Split large vendor chunks for better caching:
                // - Mapbox GL is ~800kB and changes infrequently
                // - Lit is ~30kB and changes with your package.json
                manualChunks(id) {
                    if (id.includes('maplibre-gl')) return 'vendor-maplibre';
                    if (id.includes('node_modules/lit') || id.includes('@lit/')) return 'vendor-lit';
                },
            },
        },
    },

    // ----------------------------------------------------------
    // Dev server
    // ----------------------------------------------------------
    server: {
        port: 3000,
        open: true,
        // Proxy API calls to your Bun/Hono backend
        proxy: {
            '/api/nominatim': {
                target: 'https://nominatim.openstreetmap.org',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/nominatim/, ''),
            },
            '/api/photon': {
                target: 'https://photon.komoot.io',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/photon/, ''),
            },
            '/api/route': {
                target: 'https://router.project-osrm.org',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api\/route/, ''),
            },
            '/api': {
                target: 'http://localhost:8080',
                changeOrigin: true,
            },
            '/ws': {
                target: 'ws://localhost:8080',
                ws: true,
            },
        },
        allowedHosts: ['.a.free.pinggy.link']
    },

    // ----------------------------------------------------------
    // Preview (for testing the production build locally)
    // ----------------------------------------------------------
    preview: {
        port: 4173,
    },

    // ----------------------------------------------------------
    // Dep optimization
    // mapbox-gl ships as CJS. We must let Vite/esbuild convert
    // it to ESM (do NOT exclude it). However we tell esbuild to
    // treat it as CommonJS so it wraps the module in a default
    // export shim — that's what fixes the "no default export"
    // error. The SES noise from earlier was caused by excluding
    // it; including it (the default) is actually the right call.
    // ----------------------------------------------------------
    optimizeDeps: {
        include: ['maplibre-gl'],
    },

    // ----------------------------------------------------------
    // Environment variable prefix
    // Only vars prefixed with VITE_ are exposed to the browser.
    // Add VITE_MAPBOX_TOKEN=... to your .env file.
    // ----------------------------------------------------------
    envPrefix: 'VITE_',
});