import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;

const BRAND = '#264025';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'esnext' },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Expend',
        short_name: 'Expend',
        description: 'Chat pencatatan pengeluaran - offline-first.',
        theme_color: BRAND,
        background_color: BRAND,
        display: 'standalone',
        icons: [
          { src: '/Expend-logo.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icons/app-icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/app-icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/app-icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        share_target: {
          action: '/share-handler',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [{ name: 'receipt', accept: ['image/*'] }],
          },
        },
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallback: '/index.html',
        importScripts: ['/share-handler.js'],
        runtimeCaching: [
          {
            urlPattern: /tesseract|traineddata/, // NOSONAR
            handler: 'CacheFirst',
            options: { cacheName: 'ocr-cache', expiration: { maxEntries: 20, maxAgeSeconds: 2592000 } },
          },
        ],
      },
    }),
  ],
});
