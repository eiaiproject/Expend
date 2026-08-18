/**
 * Expend UI audit harness.
 *
 * Captures every route at three viewports (desktop chromium, Android Pixel 5
 * chromium-mobile, iPhone 13 webkit-mobile) plus automated layout/contrast
 * checks. Output goes to ui-audit/out/ as screenshots + per-route JSON.
 *
 * Usage: node ui-audit/audit.mjs   (dev server must run on :3000)
 */
import { chromium, webkit, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('ui-audit/out');
const DEVICES = {
  desktop: { browser: chromium, options: { viewport: { width: 1440, height: 900 } }, label: 'desktop-1440' },
  android: { browser: chromium, options: { ...devices['Pixel 5'] }, label: 'android-pixel5' },
  ios: { browser: webkit, options: { ...devices['iPhone 13'] }, label: 'ios-iphone13' },
};

const ROUTES = ['/', '/wallets', '/wallets/1', '/debts', '/stats', '/categories', '/payees', '/schedules', '/settings', '/more'];

// ── Page-side audit: geometry, overflow, touch targets, contrast ──────
const PAGE_AUDIT = String.raw`
() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const out = { issues: [], metrics: {} };

  out.metrics.viewport = { w: vw, h: vh };
  out.metrics.docScrollWidth = document.documentElement.scrollWidth;
  out.metrics.docScrollHeight = document.documentElement.scrollHeight;
  out.metrics.bodyOverflowX = getComputedStyle(document.body).overflowX;
  out.metrics.htmlOverflowX = getComputedStyle(document.documentElement).overflowX;
  out.metrics.fonts = {
    jakarta: document.fonts.check('400 16px "Plus Jakarta Sans"'),
    jakartaBold: document.fonts.check('700 16px "Plus Jakarta Sans"'),
    mono: document.fonts.check('400 14px "JetBrains Mono"'),
  };
  out.metrics.bodyFont = getComputedStyle(document.body).fontFamily.slice(0, 60);

  // ── 1. Horizontal overflow ──
  if (document.documentElement.scrollWidth > vw + 1) {
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width > 0 && (r.right > vw + 1 || r.left < -1) && cs.position !== 'fixed') {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 90) : '',
          left: Math.round(r.left), right: Math.round(r.right),
          overflow: cs.overflowX,
        });
      }
    }
    out.issues.push({ type: 'h-overflow', detail: offenders.slice(0, 12) });
  }

  // ── 2. Text clipped without ellipsis (nowrap + overflow) ──
  const clipped = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.whiteSpace === 'nowrap' && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const hasEllipsis = cs.textOverflow === 'ellipsis';
      clipped.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 70) : '',
        text: (el.textContent || '').trim().slice(0, 40),
        w: el.clientWidth, scrollW: el.scrollWidth,
        ellipsis: hasEllipsis,
      });
    }
  }
  if (clipped.length) out.issues.push({ type: 'text-clipped', detail: clipped.slice(0, 15) });

  // ── 3. Touch targets < 44px (mobile only) ──
  const isMobile = matchMedia('(pointer: coarse)').matches;
  if (isMobile) {
    const small = [];
    const sel = 'button, a[href], input, select, textarea, [role="button"], [role="menuitem"], [role="tab"], [role="switch"], label';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0) continue;
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (r.width < 44 || r.height < 44) {
        small.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 70) : '',
          aria: el.getAttribute('aria-label') || '',
          text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
          w: Math.round(r.width), h: Math.round(r.height),
        });
      }
    }
    if (small.length) out.issues.push({ type: 'touch-target', detail: small.slice(0, 20) });
  }

  // ── 4. Contrast of visible text (WCAG relative luminance) ──
  const lum = (c) => {
    const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return null;
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = [f(+m[1]), f(+m[2]), f(+m[3])];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const la = lum(a), lb = lum(b);
    if (la == null || lb == null) return null;
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  };
  const bgOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') {
        const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
        if (m && (!m[4] || +m[4] >= 0.85)) return c;
      }
      node = node.parentElement;
    }
    return getComputedStyle(document.documentElement).getPropertyValue('--bg') ||
      (document.documentElement.dataset.theme === 'light' ? 'rgb(242, 244, 238)' : 'rgb(26, 30, 22)');
  };
  const lowContrast = [];
  const textSel = 'h1, h2, h3, p, span, button, a, td, th, li, label, option, div';
  const seen = new Set();
  for (const el of document.querySelectorAll(textSel)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const txt = (el.childNodes.length === 1 && el.textContent || '').trim();
    if (!txt || txt.length < 2) continue;
    if (cs.fontSize === '0px') continue;
    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const color = cs.color;
    const bg = bgOf(el);
    const ratio = contrast(color, bg);
    if (ratio == null || ratio >= need) continue;
    const key = txt + cs.color + bg;
    if (seen.has(key)) continue;
    seen.add(key);
    lowContrast.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 70) : '',
      text: txt.slice(0, 50),
      fg: color, bg,
      ratio: +ratio.toFixed(2), need,
      size: Math.round(size), bold,
    });
  }
  if (lowContrast.length) out.issues.push({ type: 'contrast', detail: lowContrast.slice(0, 15) });

  // ── 5. Fixed bottom nav overlap with content padding ──
  const nav = document.querySelector('nav.fixed.bottom-0');
  if (nav) {
    const navRect = nav.getBoundingClientRect();
    const main = document.querySelector('main#main-content');
    const mainPad = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0;
    out.metrics.bottomNav = { height: Math.round(navRect.height), mainPadBottom: Math.round(mainPad) };
    if (main && mainPad < navRect.height) {
      out.issues.push({ type: 'nav-overlap', detail: { navH: navRect.height, pad: mainPad } });
    }
  }

  // ── 6. Broken images ──
  const broken = [];
  for (const img of document.querySelectorAll('img')) {
    if (img.complete && img.naturalWidth === 0) broken.push(img.src.slice(0, 80));
  }
  if (broken.length) out.issues.push({ type: 'broken-img', detail: broken.slice(0, 5) });

  // ── 7. Duplicate ids ──
  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) out.issues.push({ type: 'dup-id', detail: [...new Set(dup)].slice(0, 8) });

  // ── 8. Buttons/links with no accessible name ──
  const unnamed = [];
  for (const el of document.querySelectorAll('button, a[href]')) {
    const aria = el.getAttribute('aria-label');
    const title = el.getAttribute('title');
    const txt = (el.textContent || '').trim();
    if (!aria && !title && !txt && !el.querySelector('svg[aria-label]')) {
      unnamed.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60) });
    }
  }
  if (unnamed.length) out.issues.push({ type: 'unnamed-control', detail: unnamed.slice(0, 10) });

  // ── 9. Elements clipped at viewport edges (partially visible content) ──
  const edgeClip = [];
  for (const el of document.querySelectorAll('section, article, [class*="grid"], [class*="flex"]')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0) {
      if (r.right > vw + 1 || r.left < -1) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' && cs.overflowX !== 'hidden' && cs.overflowX !== 'clip') {
          edgeClip.push({ tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 60), left: Math.round(r.left), right: Math.round(r.right) });
        }
      }
    }
  }
  if (edgeClip.length) out.issues.push({ type: 'edge-clip', detail: edgeClip.slice(0, 8) });

  return out;
}
`;

// ── Extra data: debts + schedules on top of demo seed ────────────────
const DEBT_SCHEDULE_SCRIPT = `
async () => {
  const now = new Date().toISOString();
  const today = (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); })();
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); };
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ExpendDB');
    req.onerror = () => reject(req.error || new Error('open failed'));
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['debts','debtPayments','schedules'], 'readwrite');
      const debts = tx.objectStore('debts');
      const pays = tx.objectStore('debtPayments');
      const scheds = tx.objectStore('schedules');
      debts.put({ id: 'audit_debt_1', type: 'payable', personName: 'Pak Budi', title: 'Pinjaman modal usaha', principalAmount: 500000, remainingAmount: 300000, walletId: 1, startDate: '2026-06-01', dueDate: addDays(4), status: 'partial', notes: '', createdAt: now, updatedAt: now, archivedAt: null, reminderDaysBefore: 7, reminderPostponedUntil: null });
      pays.put({ id: 'audit_pay_1', debtId: 'audit_debt_1', amount: 500000, date: '2026-06-01', walletId: 1, type: 'initial', notes: 'Debt note loan received', linkedTransactionId: null, createdAt: now });
      pays.put({ id: 'audit_pay_1b', debtId: 'audit_debt_1', amount: 200000, date: addDays(-3), walletId: 1, type: 'repayment', notes: '', linkedTransactionId: null, createdAt: now });
      debts.put({ id: 'audit_debt_2', type: 'receivable', personName: 'Sinta', title: 'Nempin laptop', principalAmount: 250000, remainingAmount: 250000, walletId: 1, startDate: '2026-07-01', dueDate: addDays(9), status: 'open', notes: '', createdAt: now, updatedAt: now, archivedAt: null, reminderDaysBefore: 3, reminderPostponedUntil: null });
      pays.put({ id: 'audit_pay_2', debtId: 'audit_debt_2', amount: 250000, date: '2026-07-01', walletId: 1, type: 'initial', notes: 'Debt note loan given', linkedTransactionId: null, createdAt: now });
      debts.put({ id: 'audit_debt_3', type: 'payable', personName: 'Agen Kos', title: 'Kontrakan', principalAmount: 2500000, remainingAmount: 2500000, walletId: 2, startDate: '2026-05-01', dueDate: addDays(-6), status: 'overdue', notes: '', createdAt: now, updatedAt: now, archivedAt: null, reminderDaysBefore: 7, reminderPostponedUntil: null });
      pays.put({ id: 'audit_pay_3', debtId: 'audit_debt_3', amount: 2500000, date: '2026-05-01', walletId: 2, type: 'initial', notes: 'Debt note loan received', linkedTransactionId: null, createdAt: now });
      scheds.put({ id: 'audit_sched_1', type: 'expense', frequency: 'monthly', startDate: '2026-01-01', nextOccurrence: today, endDate: null, amount: 79000, categoryId: 105, walletId: 2, payee: 'Netflix', notes: '', mode: 'remind', active: true, lastProcessedOccurrence: null, createdAt: now, updatedAt: now });
      scheds.put({ id: 'audit_sched_2', type: 'expense', frequency: 'weekly', startDate: '2026-01-01', nextOccurrence: addDays(2), endDate: null, amount: 25000, categoryId: 101, walletId: 1, payee: 'Iuran makan kantor', notes: '', mode: 'create', active: true, lastProcessedOccurrence: null, createdAt: now, updatedAt: now });
      tx.oncomplete = () => { db.close(); resolve('ok'); };
      tx.onerror = () => { db.close(); reject(tx.error || new Error('tx failed')); };
    };
  });
}
`;

const SKIP_BOOTSTRAP = `
() => {
  localStorage.setItem('expend_bypass_pwa', 'true');
  localStorage.setItem('expend_has_onboarded', 'true');
  localStorage.setItem('expend_onboarding_completed', 'true');
}
`;

async function settle(page) {
  await page.waitForTimeout(700);
}

async function capture(device, route, page, tag) {
  const label = device.label;
  const fileBase = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
  const dir = path.join(OUT, label);
  fs.mkdirSync(dir, { recursive: true });

  let audit = null;
  try {
    audit = await page.evaluate(new Function(`return (${PAGE_AUDIT})`)());
  } catch (e) {
    audit = { issues: [{ type: 'audit-error', detail: String(e).slice(0, 120) }], metrics: {} };
  }

  const shot = path.join(dir, `${fileBase}${tag}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  const result = { route, viewport: label, url: page.url(), shot: shot.replace(OUT + '/', ''), audit };
  fs.appendFileSync(path.join(OUT, 'data.jsonl'), JSON.stringify(result) + '\n');
  return result;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.rmSync(path.join(OUT, 'data.jsonl'), { force: true });
  console.log('Audit start →', OUT);

  // ── Pass 1: landing + onboarding (fresh, no data) ──
  for (const [, dev] of Object.entries(DEVICES)) {
    const browser = await dev.browser.launch();
    const ctx = await browser.newContext({ ...dev.options });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#root h1:visible', { timeout: 20000 });
    await settle(page);
    await capture(dev, '/', page, '-landing');
    // Onboarding wizard step 1
    const cta = page.locator('button', { hasText: /start tracking|mulai mencatat/i }).first();
    if (await cta.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cta.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, dev.label, 'onboarding-step1.png'), fullPage: true });
    }
    await browser.close();
  }

  // ── Pass 2: seeded data (demo + debts + schedules) ──
  for (const [, dev] of Object.entries(DEVICES)) {
    const browser = await dev.browser.launch();
    const ctx = await browser.newContext({ ...dev.options });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/?seed=demo`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    // demo seed triggers a reload; wait for the app shell
    await page.waitForSelector('main#main-content', { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.evaluate(new Function(`return (${DEBT_SCHEDULE_SCRIPT})`)());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main#main-content', { timeout: 30000 });
    await page.waitForTimeout(1500); // let schedules process + insights render

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('main#main-content', { timeout: 20000 });
      await settle(page);
      await capture(dev, route, page, '');
    }

    // Overlay captures on Home (mobile + desktop)
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('main#main-content', { timeout: 20000 });
    await settle(page);
    const fab = page.locator('nav button[aria-label="Add Transaction"]:visible, aside button[aria-label="Add Transaction"]:visible').first();
    if (await fab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fab.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(OUT, dev.label, 'overlay-action-picker.png') });
      const dialog = page.getByRole('dialog');
      const addExp = dialog.getByRole('button', { name: /add expense/i }).first();
      if (await addExp.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addExp.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(OUT, dev.label, 'overlay-tx-form.png') });
      }
    }
    await browser.close();
  }

  // ── Pass 3: empty states (bypassed onboarding, no data) ──
  for (const [, dev] of Object.entries(DEVICES)) {
    const browser = await dev.browser.launch();
    const ctx = await browser.newContext({ ...dev.options });
    await ctx.addInitScript(new Function(`return (${SKIP_BOOTSTRAP})`)());
    const page = await ctx.newPage();
    for (const route of ROUTES.slice(0, 6)) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('main#main-content', { timeout: 20000 });
      await settle(page);
      await capture(dev, route, page, '-empty');
    }
    await browser.close();
  }

  console.log('Done. Screenshots + data in', OUT);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
