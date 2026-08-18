/** Targeted dark/light contrast verification for Home + Landing. */
import { chromium } from '@playwright/test';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('ui-audit/out');

const MEASURE = `
() => {
  const lum = (c) => {
    const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return null;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = [f(+m[1]), f(+m[2]), f(+m[3])];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const la = lum(a), lb = lum(b);
    if (la == null || lb == null) return null;
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
  };
  const elBg = (el) => {
    const c = getComputedStyle(el).backgroundColor;
    if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    return getComputedStyle(document.body).backgroundColor;
  };
  const byText = (tag, txt, idx = 0) => {
    const el = [...document.querySelectorAll(tag)].filter((e) => (e.textContent || '').includes(txt))[idx];
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { sel: tag + '~"' + txt.slice(0, 14), text: (el.textContent || '').trim().slice(0, 30), fg: cs.color, bg: elBg(el), ratio: ratio(cs.color, elBg(el)) };
  };
  const first = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { sel, text: (el.textContent || '').trim().slice(0, 30), fg: cs.color, bg: elBg(el), ratio: ratio(cs.color, elBg(el)) };
  };
  const root = document.documentElement;
  return {
    theme: root.dataset.theme || 'system',
    bodyBg: getComputedStyle(document.body).backgroundColor,
    accentVar: getComputedStyle(root).getPropertyValue('--accent').trim(),
    expenseVar: getComputedStyle(root).getPropertyValue('--expense').trim(),
    bgVar: getComputedStyle(root).getPropertyValue('--bg').trim(),
    heroCta: byText('button', 'Get Started'),
    heroCta2: byText('button', 'Start Tracking'),
    eyebrow: byText('p', 'Privacy-first expense tracking'),
    mockExpendWord: byText('h2', 'Expend'),
    mockTxName: first('p.text-xs.font-medium.text-white'),
    mockAmount: first('p.text-xs.font-bold.text-white.font-mono'),
    navActive: first('a[aria-current="page"]'),
    expenseAmount: first('p.font-mono.font-semibold'),
    thisMonthChip: byText('button', 'This Month'),
  };
}
`;

async function measure(page, label) {
  const r = await page.evaluate(`(${MEASURE})()`);
  console.log('══', label, '| theme:', r.theme, '| bodyBg:', r.bodyBg, '| accent:', r.accentVar, '| expense:', r.expenseVar);
  for (const [k, v] of Object.entries(r)) {
    if (!v || typeof v !== 'object') continue;
    console.log('   ', k.padEnd(14), 'ratio:', String(v.ratio).padEnd(5), 'fg:', v.fg, 'bg:', v.bg, '|', v.text);
  }
}

const browser = await chromium.launch();
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#root h1:visible', { timeout: 20000 });
  await page.waitForTimeout(600);
  await measure(page, `landing-${scheme}`);
  await page.screenshot({ path: path.join(OUT, `landing-${scheme}.png`), fullPage: true });
  await page.goto(`${BASE}/?seed=demo`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main#main-content', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await measure(page, `home-${scheme}`);
  await page.screenshot({ path: path.join(OUT, `home-${scheme}.png`), fullPage: true });
  await ctx.close();
}
await browser.close();
console.log('done');
