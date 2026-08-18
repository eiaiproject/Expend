/** Post-fix verification: contrast, H1 wrap, clipPath dedupe, touch targets. */
import { chromium, webkit, devices } from '@playwright/test';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('ui-audit/out');

const PROBE = String.raw`
() => {
  const lum = (c) => {
    const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return null;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = [f(+m[1]), f(+m[2]), f(+m[3])];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); if (la == null || lb == null) return null; const [hi, lo] = la >= lb ? [la, lb] : [lb, la]; return +((hi + 0.05) / (lo + 0.05)).toFixed(2); };
  const elBg = (el) => { let n = el; for (let i = 0; n && i < 10; i++) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c; n = n.parentElement; } return getComputedStyle(document.body).backgroundColor; };
  const byText = (tag, txt) => { const el = [...document.querySelectorAll(tag)].filter((e) => (e.textContent || '').includes(txt))[0]; if (!el) return null; const cs = getComputedStyle(el); return { text: (el.textContent || '').trim().slice(0, 24), fg: cs.color, bg: elBg(el), ratio: ratio(cs.color, elBg(el)) }; };
  const h1 = document.querySelector('h1');
  const clipIds = [...document.querySelectorAll('clipPath[id]')].map((c) => c.id);
  const dupIds = [...new Set(clipIds.filter((id, i) => clipIds.indexOf(id) !== i))];
  const smallEls = [...document.querySelectorAll('button, a[href], [role="button"]')].filter((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && (r.width < 36 || r.height < 36) && cs.visibility !== 'hidden' && !el.classList.contains('sr-only');
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return String(Math.round(r.width)) + 'x' + String(Math.round(r.height)) + ':' + ((el.textContent || '').trim().slice(0, 14) || el.getAttribute('aria-label') || el.tagName);
  });
  return {
    theme: document.documentElement.dataset.theme || 'system',
    h1: h1 ? { text: (h1.textContent || '').trim().slice(0, 30), truncated: h1.scrollWidth > h1.clientWidth + 2 } : null,
    dupClipIds: dupIds,
    touchUnder36: smallEls,
    heroCta: byText('button', 'Get Started') || byText('button', 'Start Tracking'),
    eyebrow: byText('p', 'Privacy-first expense tracking'),
    mockTxName: (() => { const el = document.querySelector('p.text-xs.font-medium.text-white'); if (!el) return null; const cs = getComputedStyle(el); return { fg: cs.color, bg: elBg(el), ratio: ratio(cs.color, elBg(el)) }; })(),
  };
}
`;

async function probe(page, label) {
  const r = await page.evaluate(`(${PROBE})()`);
  const verdict = (v, need) => {
    if (v == null) return 'n/a';
    return v >= need ? 'PASS' : `FAIL(${v})`;
  };
  const ok = verdict;
  console.log(`══ ${label} (${r.theme})`);
  console.log('   h1:', r.h1 ? `${r.h1.text.slice(0, 26)} trunc=${r.h1.truncated}` : 'none');
  console.log('   dupClipIds:', r.dupClipIds.length === 0 ? 'PASS (0)' : `FAIL ${r.dupClipIds.join(',')}`);
  console.log('   touch<36 (non-sr):', r.touchUnder36.length, JSON.stringify(r.touchUnder36));
  console.log('   heroCta ratio:', ok(r.heroCta?.ratio, 4.5), r.heroCta?.ratio);
  console.log('   eyebrow ratio:', ok(r.eyebrow?.ratio, 4.5), r.eyebrow?.ratio);
  console.log('   mockTxName ratio:', ok(r.mockTxName?.ratio, 4.5), r.mockTxName?.ratio);
  return r;
}

const browser = await chromium.launch();
// Landing + Home in light and dark (desktop)
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root h1:visible', { timeout: 20000 });
  await page.waitForTimeout(600);
  await probe(page, `landing-${scheme}`);
  await page.screenshot({ path: path.join(OUT, `verify-landing-${scheme}.png`), fullPage: true });
  await page.goto(`${BASE}/?seed=demo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main#main-content', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await probe(page, `home-${scheme}`);
  await ctx.close();
}
// Categories (H1 wrap) + more (clipPath) on mobile
for (const [name, dev] of [['android', { ...devices['Pixel 5'] }], ['ios', { ...devices['iPhone 13'] }]]) {
  const engine = name === 'ios' ? webkit : chromium;
  const browser = await engine.launch();
  const ctx = await browser.newContext({ ...dev });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?seed=demo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main#main-content', { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/categories`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main#main-content', { timeout: 20000 });
  await page.waitForTimeout(600);
  await probe(page, `categories-${name}`);
  await page.screenshot({ path: path.join(OUT, `verify-categories-${name}.png`), fullPage: true });
  await page.goto(`${BASE}/more`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main#main-content', { timeout: 20000 });
  await page.waitForTimeout(600);
  await probe(page, `more-${name}`);
  await ctx.close();
  await browser.close();
}

console.log('done');
