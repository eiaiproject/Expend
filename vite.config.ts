import { existsSync, readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const version = JSON.parse(readFileSync('./package.json', 'utf8')).version;

// Aset OCR hasil `scripts/vendor-tesseract.mjs` (prebuild). Kalau ada, worker +
// core (dan model bahasa) disajikan dari origin sendiri; kalau tidak, kode
// otomatis kembali ke CDN default tesseract.js.
const OCR_DIR = 'public/tesseract';
const ocrCoreLocal =
  existsSync(`${OCR_DIR}/worker.min.js`) &&
  existsSync(`${OCR_DIR}/tesseract-core-simd-lstm.wasm.js`) &&
  existsSync(`${OCR_DIR}/tesseract-core-lstm.wasm.js`);
const ocrLangLocal = existsSync(`${OCR_DIR}/lang/ind.traineddata.gz`);

const BRAND = '#264025';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __OCR_CORE_LOCAL__: JSON.stringify(ocrCoreLocal),
    __OCR_LANG_LOCAL__: JSON.stringify(ocrLangLocal),
  },
  build: { target: 'esnext' },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        // `id` + `start_url` + `scope` eksplisit: tanpa ini identitas install
        // ikut berubah kalau start_url/default diubah, dan shortcut home screen
        // bisa membuka URL di luar scope aplikasi.
        id: '/',
        start_url: '/',
        scope: '/',
        name: 'Expend',
        short_name: 'Expend',
        description: 'Chat pencatatan pengeluaran - offline-first.',
        lang: 'id',
        dir: 'ltr',
        categories: ['finance', 'productivity'],
        theme_color: BRAND,
        background_color: BRAND,
        display: 'standalone',
        display_override: ['standalone'],
        // Akses satu ketukan dari home screen ke alur utama.
        shortcuts: [
          { name: 'Catat pengeluaran', short_name: 'Catat', url: '/chat', icons: [{ src: '/icons/app-icons/icon-192x192.png', sizes: '192x192' }] },
          { name: 'Ringkasan', short_name: 'Ringkasan', url: '/', icons: [{ src: '/icons/app-icons/icon-192x192.png', sizes: '192x192' }] },
        ],
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
        // og-image.png (304 kB) cuma dibaca crawler, dan aset OCR (~8 MB) harus
        // di-cache saat dipakai - bukan saat install. Keduanya bikin precache
        // membengkak tanpa manfaat; sisa aset OCR tetap masuk lewat
        // runtimeCaching di bawah (CacheFirst).
        globIgnores: ['**/og-image.png', 'tesseract/**'],
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
