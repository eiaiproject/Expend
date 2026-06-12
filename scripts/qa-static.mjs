import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const dist = join(root, 'dist');

const readText = (path) => readFileSync(join(root, path), 'utf8');
const readJson = (path) => JSON.parse(readText(path));

assert.ok(existsSync(dist), 'dist directory must exist. Run npm run build first.');

const manifest = readJson('dist/manifest.webmanifest');
assert.equal(manifest.name, 'Expend', 'manifest name should be Expend');
assert.equal(manifest.short_name, 'Expend', 'manifest short_name should be Expend');
assert.equal(manifest.start_url, '/', 'manifest start_url should be /');
assert.equal(manifest.scope, '/', 'manifest scope should be /');
assert.equal(manifest.display, 'standalone', 'manifest display should be standalone');
assert.equal(manifest.theme_color, '#0F766E', 'manifest theme color should match app brand');
assert.ok(!manifest.screenshots, 'manifest should not reference missing screenshots');
assert.ok(manifest.shortcuts?.some((shortcut) => shortcut.url === '/wallets'), 'manifest should include a Wallets shortcut');
assert.ok(manifest.shortcuts?.some((shortcut) => shortcut.url === '/stats'), 'manifest should include a Stats shortcut');
assert.ok(manifest.shortcuts?.some((shortcut) => shortcut.url === '/settings'), 'manifest should include a Settings shortcut');
assert.ok(manifest.icons?.some((icon) => icon.sizes === '192x192'), 'manifest needs a 192x192 icon');
assert.ok(manifest.icons?.some((icon) => icon.sizes === '512x512'), 'manifest needs a 512x512 icon');

const index = readText('dist/index.html');
assert.match(index, /og:title/, 'index.html should include Open Graph metadata');
assert.match(index, /twitter:card/, 'index.html should include Twitter metadata');
assert.ok(!index.includes('/src/main.tsx'), 'production index.html should not preload source TS entry');
assert.ok(!index.includes('fonts.googleapis.com'), 'production index.html should not load Google Fonts CSS');
assert.ok(!index.includes('fonts.gstatic.com'), 'production index.html should not preconnect to Google Fonts files');

const sw = readText('dist/sw.js');
assert.match(sw, /offline\.html/, 'service worker should precache offline.html');
assert.match(sw, /PrecacheFallbackPlugin/, 'service worker should use a precache fallback');
assert.match(sw, /navigation-cache/, 'service worker should register navigation runtime caching');
assert.match(sw, /cleanupOutdatedCaches/, 'service worker should clean outdated caches');
assert.ok(!sw.includes('google-fonts-css'), 'service worker should not cache Google Fonts CSS');
assert.ok(!sw.includes('google-fonts-files'), 'service worker should not cache Google Fonts files');
assert.ok(!sw.includes('image-cache'), 'service worker should not register a universal external image cache');
assert.ok(!sw.includes('screenshots/desktop.png'), 'service worker should not precache missing desktop screenshot');
assert.ok(!sw.includes('screenshots/mobile.png'), 'service worker should not precache missing mobile screenshot');

const vercel = readJson('vercel.json');
const allHeaders = vercel.headers.flatMap((entry) => entry.headers.map((header) => `${header.key}:${header.value}`));
assert.ok(allHeaders.some((header) => header.startsWith('Content-Security-Policy:')), 'vercel headers should include CSP');
assert.ok(allHeaders.some((header) => header.startsWith('Strict-Transport-Security:')), 'vercel headers should include HSTS');
assert.ok(
  vercel.headers.some((entry) => entry.source === '/assets/(.*)' && entry.headers.some((header) => /immutable/.test(header.value))),
  'hashed build assets should have immutable cache headers',
);
assert.ok(
  vercel.headers.some((entry) => entry.source === '/sw.js' && entry.headers.some((header) => /no-cache/.test(header.value))),
  'service worker should have no-cache headers',
);
assert.ok(
  vercel.headers.some((entry) => entry.source === '/manifest.webmanifest' && entry.headers.some((header) => /no-cache/.test(header.value))),
  'manifest should have no-cache headers',
);

console.log('Static PWA/deployment QA passed.');
