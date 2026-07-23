import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
const BRAND_COLOR = '#7A9B6A';

// Exclude Cloudflare plugin during `vite preview` so Playwright tests
// run against Vite's built-in static server which properly supports
// browser Service Workers (Miniflare/Workerd does not).
export default defineConfig(({mode}) => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
    },
    build: {
      // Enable source maps in dev/preview only; off in production
      // to avoid exposing full source code to end users.
      sourcemap: mode !== 'production',
    },
    plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Expend',
        short_name: 'Expend',
        description: 'Privacy-first, offline-first personal finance tracker for expenses, budgets, wallets, debts, receivables, and reports.',
        start_url: '/',
        scope: '/',
        theme_color: BRAND_COLOR,
        background_color: BRAND_COLOR,
        display: 'standalone',
        orientation: 'portrait',
        categories: ['finance', 'productivity'],
        shortcuts: [
          {
            name: 'Wallets',
            short_name: 'Wallets',
            description: 'Open wallet balances and management.',
            url: '/wallets',
            icons: [{ src: '/icons/app-icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Stats',
            short_name: 'Stats',
            description: 'Open spending analytics and reports.',
            url: '/stats',
            icons: [{ src: '/icons/app-icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Settings',
            short_name: 'Settings',
            description: 'Open data, backup, and security settings.',
            url: '/settings',
            icons: [{ src: '/icons/app-icons/icon-192x192.png', sizes: '192x192', type: 'image/png' }]
          }
        ],
        icons: [
          {
            src: '/icons/app-icons/icon-16x16.png',
            sizes: '16x16',
            type: 'image/png'
          },
          {
            src: '/icons/app-icons/icon-32x32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: '/icons/app-icons/icon-180x180.png',
            sizes: '180x180',
            type: 'image/png'
          },
          {
            src: '/icons/app-icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/app-icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/app-icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['registerSW.js'],
        navigateFallback: '/index.html',
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigation-cache',
              precacheFallback: {
                fallbackURL: '/index.html'
              },
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      includeManifestIcons: false,
    })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
