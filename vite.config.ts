import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { BRAND_COLOR } from './src/utils/brandColors';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({mode}) => {
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(process.env.BUILD_DATE || ''),
      __GIT_HASH__: JSON.stringify(process.env.GIT_HASH || 'dev'),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
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
          navigateFallback: undefined,
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
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-router': ['react-router-dom'],
            'vendor-ui': ['lucide-react', 'motion/react', 'clsx', 'tailwind-merge'],
            'vendor-charts': ['recharts'],
            'vendor-date': ['date-fns'],
            'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
            'vendor-db': ['dexie', 'dexie-react-hooks'],
          }
        }
      }
    },
  };
});
