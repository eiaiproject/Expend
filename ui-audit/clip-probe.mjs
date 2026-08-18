import { chromium } from '@playwright/test';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 390, height: 844 } });
await page.addInitScript(() => {
  localStorage.setItem('expend_bypass_pwa', 'true');
  localStorage.setItem('expend_has_onboarded', 'true');
  localStorage.setItem('expend_onboarding_completed', 'true');
});
await page.goto('http://localhost:3000/more', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('main#main-content');
await page.waitForTimeout(1200);
const info = await page.evaluate(() => {
  const clips = [...document.querySelectorAll('clipPath[id]')];
  const ids = clips.map(c => c.id);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  return { count: clips.length, dupIds: [...new Set(dup)], samples: clips.slice(0, 3).map(c => ({ id: c.id, parent: c.closest('svg') ? c.closest('svg').getAttribute('viewBox') : null, el: c.outerHTML.slice(0, 120) })) };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
