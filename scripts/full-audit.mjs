// Full pixel-perfect UI audit — all routes, viewports, themes, langs.
// Routes from src/App.tsx: / (Home), /chat, /settings, * -> /
// Checks: anchoring, symmetry, consistency, proportion/ratio, spacing rhythm,
// typography, radius palette, a11y structure, i18n, console errors + screenshots.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = 'D:/Repos/Expend/audit-output';
const SHOT = path.join(OUT, 'screenshots');
fs.mkdirSync(SHOT, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800, scheme: 'light' },
  { name: 'mobile', width: 393, height: 851, scheme: 'light' },
  { name: 'tablet', width: 834, height: 1112, scheme: 'light' },
];

const results = [];
const shots = [];
const consoleErrors = [];
let passCount = 0, failCount = 0;

function check(label, cond, detail = '') {
  const pass = !!cond;
  results.push({ label, pass, detail });
  if (pass) { passCount++; console.log(`  ✓ ${label}`); }
  else { failCount++; console.log(`  ✗ ${label} — ${detail}`); }
}

// Safe measure: CSS strings prefixed so they never overwrite rect numbers.
async function measure(page, selector) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return null;
  const box = await el.boundingBox();
  if (!box) return null;
  const css = await el.evaluate((node) => {
    const s = getComputedStyle(node);
    return {
      paddingTop: s.paddingTop, paddingRight: s.paddingRight,
      paddingBottom: s.paddingBottom, paddingLeft: s.paddingLeft,
      gap: s.gap, fontSize: s.fontSize, lineHeight: s.lineHeight,
      borderRadius: s.borderRadius, color: s.color, bg: s.backgroundColor,
      display: s.display, maxWidth: s.maxWidth,
    };
  });
  return { ...css, ...box };
}

async function ready(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.locator('#main-content').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function quietAnimations(page) {
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; caret-color: transparent !important; }`,
  }).catch(() => {});
}

async function newPage(browser, vp, { theme = 'light', lang = 'id' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${vp.name}/${theme}/${lang}] ${m.text().slice(0, 160)}`); });
  page.on('pageerror', (e) => consoleErrors.push(`[${vp.name}/${theme}/${lang}] PAGEERROR ${String(e).slice(0, 160)}`));
  await page.addInitScript(({ theme, lang }) => {
    try {
      localStorage.setItem('theme', theme);
      localStorage.setItem('expend_lang', lang);
      localStorage.setItem('confirmSave', 'true');
    } catch {}
  }, { theme, lang });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  await ready(page);
  // Force theme attr (app only applies it from Settings effect)
  await page.evaluate((t) => {
    const r = document.documentElement;
    if (t === 'system') delete r.dataset.theme; else r.dataset.theme = t;
  }, theme).catch(() => {});
  await quietAnimations(page);
  await page.waitForTimeout(250);
  return { ctx, page };
}

async function clearDB(page) {
  // Open at CURRENT version (no arg) — Dexie migrates this DB over time,
  // so a hardcoded version either throws VersionError or creates a
  // store-less v1. Clear stores instead of deleteDatabase (delete + reopen
  // would recreate at v1 without object stores, silently losing seeds).
  await page.evaluate(async () => {
    const openReq = indexedDB.open('ExpendDB');
    const db = await new Promise((res, rej) => {
      openReq.onsuccess = () => res(openReq.result);
      openReq.onerror = () => rej(openReq.error);
    });
    try {
      for (const store of ['transactions', 'chatMessages']) {
        if (!db.objectStoreNames.contains(store)) continue;
        await new Promise((res) => {
          try {
            const tx = db.transaction(store, 'readwrite');
            tx.objectStore(store).clear();
            tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
          } catch { res(); }
        });
      }
    } finally {
      db.close();
    }
  });
}

async function wipeDB(page) {
  await clearDB(page);
  await page.reload().catch(() => {});
  await ready(page);
  await page.waitForTimeout(400);
}

async function seedDB(page, txs, msgs) {
  await page.evaluate(async ({ txs, msgs }) => {
    const openReq = indexedDB.open('ExpendDB');
    const db = await new Promise((res, rej) => {
      openReq.onsuccess = () => res(openReq.result);
      openReq.onerror = () => rej(openReq.error);
    });
    for (const store of ['transactions', 'chatMessages']) {
      await new Promise((res) => {
        try {
          const tx = db.transaction(store, 'readwrite');
          tx.objectStore(store).clear();
          tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
        } catch { res(); }
      });
    }
    for (const t of txs) {
      await new Promise((res) => {
        try {
          const tx = db.transaction('transactions', 'readwrite');
          tx.objectStore('transactions').add(t);
          tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
        } catch { res(); }
      });
    }
    for (const m of msgs) {
      await new Promise((res) => {
        try {
          const tx = db.transaction('chatMessages', 'readwrite');
          tx.objectStore('chatMessages').add(m);
          tx.oncomplete = res; tx.onerror = res; tx.onabort = res;
        } catch { res(); }
      });
    }
    db.close();
  }, { txs, msgs });
  await page.reload().catch(() => {});
  await ready(page);
}

const SEED_TXS = [
  { description: 'Kopi di Indomaret', amount: 50000, date: '2026-09-04', createdAt: '2026-09-04T01:00:00.000Z', source: 'Tunai' },
  { description: 'Transfer ke Budi untuk Bazar', amount: 150000, date: '2026-09-03', createdAt: '2026-09-03T01:00:00.000Z', source: 'BCA', note: 'Titip bazar' },
  { description: 'Bayar Listrik', amount: 200000, date: '2026-09-02', createdAt: '2026-09-02T01:00:00.000Z', source: 'GoPay' },
  { description: 'Mie Ayam di Kotabaru', amount: 25000, date: '2026-09-01', createdAt: '2026-09-01T01:00:00.000Z', source: 'Tunai', note: 'Pedas level 2' },
  { description: 'KPR', amount: 7500000, date: '2026-08-31', createdAt: '2026-08-31T01:00:00.000Z', source: 'BSI' },
];

const SEED_MSGS = [
  { role: 'user', text: 'kopi 25rb', createdAt: '2026-09-04T01:00:00.000Z' },
  { role: 'assistant', text: 'Tercatat: Kopi Rp25.000', createdAt: '2026-09-04T01:00:10.000Z' },
  { role: 'user', text: 'berapa total minggu ini?', createdAt: '2026-09-04T01:01:00.000Z' },
  { role: 'assistant', text: 'Saya tidak punya akses real-time, cek halaman List ya.', createdAt: '2026-09-04T01:01:10.000Z' },
];

const px = (v) => parseFloat(String(v).replace('px', '')) || 0;
const shot = (page, name) => page.screenshot({ path: path.join(SHOT, name) }).then(() => shots.push(name));

// ─── per-viewport main flow (light) ──────────────────────────────────────────
async function auditViewport(browser, vp) {
  console.log(`\n===== ${vp.name} ${vp.width}x${vp.height} (light/id) =====`);
  const { ctx, page } = await newPage(browser, vp, { theme: 'light', lang: 'id' });

  // Shell: sidebar / bottomnav / main centering (on /)
  await page.goto(BASE + '/').catch(() => {});
  await ready(page);
  const asideCount = await page.locator('aside').count();
  const asideVisible = asideCount ? await page.locator('aside').first().isVisible().catch(() => false) : false;
  const bottomVisible = await page.locator('nav.fixed.bottom-0').first().isVisible().catch(() => false);
  const main = await measure(page, 'main#main-content');
  if (main) {
    // main is centered in space REMAINING after sidebar (flex-1 + mx-auto)
    const asideBox = asideVisible ? await page.locator('aside').first().boundingBox().catch(() => null) : null;
    const asideW = asideBox?.width ?? 0;
    const expected = asideW + (vp.width - asideW - main.width) / 2;
    check(`${vp.name}.shell.main-centered`, Math.abs(main.x - expected) < 16, `x=${main.x.toFixed(1)} expected=${expected.toFixed(1)} asideW=${asideW.toFixed(0)} w=${main.width.toFixed(0)}`);
    check(`${vp.name}.shell.px-symmetric`, Math.abs(px(main.paddingLeft) - px(main.paddingRight)) < 1, `pl=${main.paddingLeft} pr=${main.paddingRight}`);
  }
  if (vp.name === 'desktop' || vp.name === 'tablet') {
    check(`${vp.name}.shell.sidebar-visible`, asideVisible, `aside count=${asideCount}`);
    check(`${vp.name}.shell.bottomnav-hidden`, !bottomVisible, 'BottomNav must hide on md+');
  } else {
    check(`${vp.name}.shell.sidebar-hidden`, !asideVisible, 'sidebar must hide on mobile');
    check(`${vp.name}.shell.bottomnav-visible`, bottomVisible, 'BottomNav must show on mobile');
    if (bottomVisible) {
      const nav = await measure(page, 'nav.fixed.bottom-0');
      if (nav) check(`${vp.name}.shell.bottomnav-anchored`, Math.abs((nav.y + nav.height) - vp.height) < 2, `bottom=${(nav.y + nav.height).toFixed(1)} vp=${vp.height}`);
    }
  }

  // Home empty
  await wipeDB(page);
  await page.goto(BASE + '/').catch(() => {});
  await ready(page);
  await shot(page, `home-empty-${vp.name}.png`);
  const emptyCTA = await measure(page, 'main#main-content a[href="/chat"]');
  if (emptyCTA) check(`${vp.name}.home.empty-cta-minheight`, emptyCTA.height >= 47, `h=${emptyCTA.height.toFixed(1)}`);
  const htmlLang = await page.evaluate(() => document.documentElement.lang).catch(() => '');
  check(`${vp.name}.a11y.html-lang`, htmlLang === 'id', `lang=${htmlLang}`);
  const h1Count = await page.locator('main#main-content h1').count();
  check(`${vp.name}.a11y.home-h1`, h1Count >= 1, `h1 count=${h1Count}`);

  // Home with data
  await seedDB(page, SEED_TXS, []);
  await page.goto(BASE + '/').catch(() => {});
  await ready(page);
  await shot(page, `home-data-${vp.name}.png`);
  const items = page.locator('ul li.list-item');
  const n = await items.count();
  check(`${vp.name}.home.list-count`, n === SEED_TXS.length, `got ${n}`);
  const heightsNoNote = [], heightsNote = [];
  for (let i = 0; i < n; i++) {
    const li = items.nth(i);
    const b = await li.boundingBox();
    const hasNote = (await li.locator('p[title]').count()) > 0;
    if (b) (hasNote ? heightsNote : heightsNoNote).push(b.height);
    // symmetry: amount right edge vs edit button left edge consistent
    const amt = await li.locator('p.whitespace-nowrap').first().boundingBox().catch(() => null);
    if (i === 0 && amt) console.log(`  (info) amount w=${amt.width.toFixed(0)} h=${amt.height.toFixed(0)}`);
  }
  if (heightsNoNote.length > 1) {
    const spread = Math.max(...heightsNoNote) - Math.min(...heightsNoNote);
    check(`${vp.name}.home.item-height-consistent`, spread < 5, `spread=${spread.toFixed(1)} heights=[${heightsNoNote.map((h) => h.toFixed(0)).join(',')}]`);
  }
  // list gap rhythm (space-y-2 => 8px margin between items)
  if (n > 1) {
    const b0 = await items.nth(0).boundingBox();
    const b1 = await items.nth(1).boundingBox();
    if (b0 && b1) {
      const gap = b1.y - (b0.y + b0.height);
      check(`${vp.name}.home.list-gap-8`, Math.abs(gap - 8) < 1.5, `gap=${gap.toFixed(1)}`);
    }
  }
  // icon square 36x36 + CTA min height
  const iconBox = await page.locator('ul').first().isVisible().catch(() => false)
    ? null : null;
  const sumIcon = await measure(page, 'main#main-content div.w-9.h-9');
  if (sumIcon) check(`${vp.name}.home.summary-icon-square`, Math.abs(sumIcon.width - sumIcon.height) < 1 && Math.abs(sumIcon.width - 36) < 1.5, `w=${sumIcon.width.toFixed(1)} h=${sumIcon.height.toFixed(1)}`);
  const cta2 = await measure(page, 'main#main-content a[href="/chat"]');
  if (cta2) check(`${vp.name}.home.cta-minheight`, cta2.height >= 47, `h=${cta2.height.toFixed(1)}`);
  // edit + delete buttons 44x44 touch targets
  const editBtn = await measure(page, 'ul li.list-item button');
  if (editBtn) check(`${vp.name}.home.row-btn-touch`, editBtn.width >= 43 && editBtn.height >= 43, `w=${editBtn.width.toFixed(0)} h=${editBtn.height.toFixed(0)}`);

  // Edit sheet open (functional + proportion)
  await items.first().locator('button').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const dlg = page.locator('dialog[open]');
  const dlgOpen = (await dlg.count()) > 0;
  check(`${vp.name}.home.edit-dialog-opens`, dlgOpen, 'click first row edit btn');
  if (dlgOpen) {
    await shot(page, `home-edit-${vp.name}.png`);
    const form = await measure(page, 'dialog[open] form');
    if (form) {
      if (vp.name === 'mobile') {
        check(`${vp.name}.home.edit-bottomsheet`, Math.abs((form.y + form.height) - vp.height) < 60, `form.bottom=${(form.y + form.height).toFixed(0)} vp=${vp.height}`);
      } else {
        const cx = form.x + form.width / 2;
        check(`${vp.name}.home.edit-centered`, Math.abs(cx - vp.width / 2) < 30, `cx=${cx.toFixed(0)} vp/2=${vp.width / 2}`);
      }
    }
    const inp = await measure(page, 'dialog[open] input');
    if (inp) check(`${vp.name}.home.edit-input-height`, inp.height >= 47, `h=${inp.height.toFixed(1)}`);
    const inpCount = await page.locator('dialog[open] input, dialog[open] textarea').count();
    check(`${vp.name}.home.edit-fields`, inpCount === 5, `inputs+textarea=${inpCount}`);
    const dlgLabel = await dlg.first().getAttribute('aria-label').catch(() => null);
    check(`${vp.name}.home.edit-dialog-aria`, !!dlgLabel, `aria-label=${dlgLabel}`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }

  // Chat empty
  await seedDB(page, SEED_TXS, []);
  await page.goto(BASE + '/chat').catch(() => {});
  await ready(page);
  await shot(page, `chat-empty-${vp.name}.png`);
  const chatH1 = await page.locator('main#main-content h1').count();
  check(`${vp.name}.a11y.chat-h1`, chatH1 >= 1, `h1=${chatH1}`);
  const ta = await measure(page, 'main#main-content textarea');
  if (ta) check(`${vp.name}.chat.textarea-minheight`, ta.height >= 43, `h=${ta.height.toFixed(1)}`);

  // Chat with messages + bubbles symmetry
  await seedDB(page, SEED_TXS, SEED_MSGS);
  await page.goto(BASE + '/chat').catch(() => {});
  await ready(page);
  await shot(page, `chat-msgs-${vp.name}.png`);
  const bubbles = page.locator('div[role="log"] > div > div');
  const bn = await bubbles.count();
  check(`${vp.name}.chat.bubble-count`, bn === SEED_MSGS.length, `got ${bn}`);
  const listW = (await measure(page, 'div[role="log"]'))?.width ?? 0;
  if (bn >= 2 && listW) {
    const b0 = await bubbles.nth(0).locator('div').first().boundingBox();
    const b1 = await bubbles.nth(1).locator('div').first().boundingBox();
    if (b0 && b1) {
      check(`${vp.name}.chat.user-right-assistant-left`, b0.x > b1.x, `user.x=${b0.x.toFixed(0)} asst.x=${b1.x.toFixed(0)}`);
      check(`${vp.name}.chat.bubble-maxwidth`, b0.width <= listW * 0.8 && b1.width <= listW * 0.8, `w0=${b0.width.toFixed(0)} w1=${b1.width.toFixed(0)} list=${listW.toFixed(0)}`);
    }
  }

  // Composer anchoring + grow (outer container, not inner form)
  const formBox = await page.locator('main#main-content form').first().boundingBox();
  const contBottom = await page.evaluate(() => {
    const f = document.querySelector('main#main-content form');
    const c = f?.parentElement;
    if (!c) return -1;
    return c.getBoundingClientRect().bottom;
  }).catch(() => -1);
  const vh = await page.evaluate(() => window.innerHeight).catch(() => vp.height);
  check(`${vp.name}.chat.composer-anchored`, Math.abs(contBottom - vh) < 3, `container.bottom=${contBottom.toFixed?.(0) ?? contBottom} vh=${vh}`);
  const taSel = 'main#main-content textarea';
  await page.locator(taSel).fill('beli kopi 25rb dan roti bakar coklat keju plus susu jahe anget di warung pakde sebelah gang sempit itu loh ya');
  await page.waitForTimeout(400);
  const ta2 = await measure(page, taSel);
  const contBottom2 = await page.evaluate(() => {
    const f = document.querySelector('main#main-content form');
    return f?.parentElement?.getBoundingClientRect().bottom ?? -1;
  }).catch(() => -1);
  if (ta2 && ta) check(`${vp.name}.chat.composer-grows`, ta2.height > ta.height, `h ${ta.height.toFixed(0)} -> ${ta2.height.toFixed(0)}`);
  check(`${vp.name}.chat.composer-stays-anchored`, Math.abs(contBottom2 - vh) < 3, `bottom=${Math.round(contBottom2)} vh=${vh}`);
  await shot(page, `chat-grow-${vp.name}.png`);
  await page.locator(taSel).fill('').catch(() => {});

  // Pending card (send a parseable expense)
  await page.locator(taSel).fill('kopi 25rb');
  await page.keyboard.press('Enter').catch(() => {});
  await page.locator('#pending-desc').waitFor({ timeout: 5000 }).catch(() => {});
  const pendVisible = (await page.locator('#pending-desc').count()) > 0;
  check(`${vp.name}.chat.pending-appears`, pendVisible, 'send "kopi 25rb"');
  if (pendVisible) {
    await shot(page, `chat-pending-${vp.name}.png`);
    const pAmt = await measure(page, '#pending-amount');
    if (pAmt) check(`${vp.name}.chat.pending-input-height`, pAmt.height >= 47, `h=${pAmt.height.toFixed(1)}`);
  }

  // Settings
  await page.goto(BASE + '/settings').catch(() => {});
  await ready(page);
  await shot(page, `settings-${vp.name}.png`);
  const h2s = await page.locator('main#main-content h2').count();
  check(`${vp.name}.settings.sections`, h2s >= 5, `h2=${h2s}`);
  const sel = await measure(page, 'main#main-content select');
  if (sel) check(`${vp.name}.settings.select-height`, Math.abs(sel.height - 40) < 2, `h=${sel.height.toFixed(1)}`);
  const tgl = await measure(page, 'main#main-content button[role="switch"] div.relative');
  if (tgl) check(`${vp.name}.settings.toggle-proportion`, Math.abs(tgl.width - 44) < 2 && Math.abs(tgl.height - 24) < 2, `w=${tgl.width.toFixed(1)} h=${tgl.height.toFixed(1)}`);
  const foot = await page.locator('main#main-content').getByText('expend.pages.dev').count();
  check(`${vp.name}.settings.footer`, foot >= 1, 'footer domain present');
  const imgs = page.locator('main#main-content img, aside img');
  const ni = await imgs.count();
  let altOk = true;
  for (let i = 0; i < ni; i++) {
    const a = await imgs.nth(i).getAttribute('alt');
    if (a === null || a === '') altOk = false;
  }
  check(`${vp.name}.a11y.img-alt`, altOk, `imgs=${ni}`);

  await ctx.close();
}

// ─── dark theme spot-check ───────────────────────────────────────────────────
async function auditDark(browser, vp) {
  console.log(`\n===== ${vp.name} (dark/id) =====`);
  const { ctx, page } = await newPage(browser, vp, { theme: 'dark', lang: 'id' });
  await seedDB(page, SEED_TXS, SEED_MSGS);
  await page.goto(BASE + '/').catch(() => {});
  await ready(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }).catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, `home-data-${vp.name}-dark.png`);
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()).catch(() => '');
  check(`${vp.name}.dark.bg-token`, bg === '#0a0a0a', `--bg=${bg}`);
  await page.goto(BASE + '/chat').catch(() => {});
  await ready(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }).catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, `chat-msgs-${vp.name}-dark.png`);
  await page.goto(BASE + '/settings').catch(() => {});
  await ready(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; }).catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, `settings-${vp.name}-dark.png`);
  await ctx.close();
}

// ─── english spot-check + 404 ────────────────────────────────────────────────
async function auditEnAnd404(browser) {
  console.log(`\n===== desktop (light/en) + 404 =====`);
  const vp = VIEWPORTS[0];
  const { ctx, page } = await newPage(browser, vp, { theme: 'light', lang: 'en' });
  await seedDB(page, SEED_TXS, []);
  await page.goto(BASE + '/').catch(() => {});
  await ready(page);
  await shot(page, 'home-data-desktop-en.png');
  const bodyTxt = (await page.locator('main#main-content').innerText().catch(() => '')).slice(0, 2000);
  check('en.no-raw-keys', !/home\.[a-zA-Z]+|settings\.[a-zA-Z]+|chat\.[a-zA-Z]+/.test(bodyTxt), 'no untranslated keys in main');
  check('en.differs-from-id', /Record|Settings|Transactions|Total/i.test(bodyTxt), 'english copy present');
  await page.goto(BASE + '/settings').catch(() => {});
  await ready(page);
  await shot(page, 'settings-desktop-en.png');
  await page.goto(BASE + '/nonexistent-xyz').catch(() => {});
  await page.waitForTimeout(800);
  const url = page.url();
  check('router.404-redirects-home', url.endsWith('/') || url === BASE + '/', `url=${url}`);
  await ctx.close();
}

// ─── spacing rhythm + radius palette sweep ───────────────────────────────────
async function auditTokens(browser) {
  console.log(`\n===== token sweep (desktop/light) =====`);
  const vp = VIEWPORTS[0];
  const { ctx, page } = await newPage(browser, vp, { theme: 'light', lang: 'id' });
  await seedDB(page, SEED_TXS, SEED_MSGS);
  const SELS = [
    'main#main-content', 'main#main-content ul', 'ul li.list-item',
    'main#main-content a[href="/chat"]', 'main#main-content form',
    'div[role="log"]', 'nav.fixed.bottom-0',
  ];
  const gaps = new Set(), pads = new Set(), radii = new Set(), fonts = new Set();
  // seed first so message log + list exist when measuring
  await seedDB(page, SEED_TXS, SEED_MSGS);
  await page.goto(BASE + '/chat').catch(() => {});
  await ready(page);
  for (const s of SELS) {
    const m = await measure(page, s);
    if (!m) continue;
    [m.gap].forEach((v) => { if (v && v !== 'normal') gaps.add(v); });
    // div[role="log"] paddingBottom is dynamic (composerH + 16 inline) — informational only
    if (s === 'div[role="log"]') {
      console.log(`  (info) message-log dynamic paddingBottom=${m.paddingBottom} (composerH+16, by design)`);
      [m.paddingTop, m.paddingRight, m.paddingLeft].forEach((v) => pads.add(v));
    } else {
      [m.paddingTop, m.paddingRight, m.paddingBottom, m.paddingLeft].forEach((v) => pads.add(v));
    }
    radii.add(m.borderRadius);
    fonts.add(m.fontSize);
  }
  await page.goto(BASE + '/').catch(() => {});
  await ready(page);
  for (const s of SELS) {
    const m = await measure(page, s);
    if (!m) continue;
    [m.gap].forEach((v) => { if (v && v !== 'normal') gaps.add(v); });
    if (s === 'div[role="log"]') {
      [m.paddingTop, m.paddingRight, m.paddingLeft].forEach((v) => pads.add(v));
    } else {
      [m.paddingTop, m.paddingRight, m.paddingBottom, m.paddingLeft].forEach((v) => pads.add(v));
    }
    radii.add(m.borderRadius);
    fonts.add(m.fontSize);
  }
  const num = (s) => parseFloat(String(s).replace('px', ''));
  const oddPads = [...pads].filter((v) => { const n = num(v); return Number.isFinite(n) && ![0, 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48].includes(Math.round(n)); });
  console.log(`  (info) gaps=[${[...gaps].join(', ')}]`);
  console.log(`  (info) paddings=[${[...pads].join(', ')}]`);
  console.log(`  (info) radii=[${[...radii].join(' | ')}]`);
  console.log(`  (info) fonts=[${[...fonts].join(', ')}]`);
  check('tokens.padding-rhythm', oddPads.length === 0, oddPads.length ? `off-palette: ${oddPads.join(', ')}` : `palette ok (${pads.size} values)`);
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
try {
  for (const vp of VIEWPORTS) await auditViewport(browser, vp);
  await auditDark(browser, VIEWPORTS[0]);
  await auditDark(browser, VIEWPORTS[1]);
  await auditEnAnd404(browser);
  await auditTokens(browser);
} finally {
  await browser.close().catch(() => {});
}

fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ pass: passCount, fail: failCount, results, shots, consoleErrors }, null, 2));

const fails = results.filter((r) => !r.pass);
const md = [
  '# Expend UI Audit — pixel-perfect report',
  '',
  `Date: ${new Date().toISOString()} · Base: ${BASE}`,
  `Result: **${passCount} pass / ${failCount} fail** (${results.length} checks)`,
  '',
  '## Coverage',
  '- Routes: `/` empty + with-data + edit-sheet, `/chat` empty + messages + composer-grow + pending, `/settings`, 404 redirect',
  '- Viewports: desktop 1280x800, mobile 393x851, tablet 834x1112',
  '- Themes: light (full) + dark (desktop/mobile spot)',
  '- Langs: id (full) + en (desktop spot)',
  '- Token sweep: gap/padding/radius/font palette',
  '',
  fails.length ? '## FAILS' : '## FAILS — none',
  ...fails.map((f) => `- [ ] **${f.label}** — ${f.detail}`),
  '',
  '## All checks',
  ...results.map((r) => `- ${r.pass ? '[x]' : '[ ]'} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`),
  '',
  '## Console errors',
  ...(consoleErrors.length ? consoleErrors.map((e) => `- ${e}`) : ['- none']),
  '',
  '## Screenshots',
  ...shots.map((s) => `- screenshots/${s}`),
  '',
].join('\n');
fs.writeFileSync(path.join(OUT, 'report.md'), md);
console.log(`\nDONE: ${passCount} pass / ${failCount} fail → ${path.join(OUT, 'report.md')}`);
process.exit(failCount ? 1 : 0);
