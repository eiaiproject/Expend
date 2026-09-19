import type { Page } from '@playwright/test';

// Simulasi keyboard virtual Android (interactive-widget=resizes-visual):
// visualViewport.height mengecil sementara layout viewport (window.innerHeight)
// dan offsetTop tetap. Getter height/offsetTop adalah atribut WebIDL pada
// prototype VisualViewport (configurable), jadi aman di-override per-test.
export async function simulateKeyboardOpen(page: Page, keyboardPx = 300) {
  await page.evaluate((px) => {
    const vv = window.visualViewport as unknown as { dispatchEvent(e: Event): boolean };
    const proto = Object.getPrototypeOf(vv) as { height?: number; offsetTop?: number };
    const inner = window.innerHeight;
    Object.defineProperty(proto, 'height', { configurable: true, get: () => inner - px });
    Object.defineProperty(proto, 'offsetTop', { configurable: true, get: () => 0 });
    vv.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
  }, keyboardPx);
}

export const MOBILE = { width: 390, height: 844 };
export const KEYBOARD = 300;
export const fold = MOBILE.height - KEYBOARD; // batas atas keyboard simulasi
