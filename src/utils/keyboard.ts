import { useEffect, useState } from 'react';

/**
 * Metrik keyboard dari visualViewport.
 * Inset hanya dipercaya saat elemen editable sedang fokus; saat tidak ada
 * yang fokus, keyboard pasti sudah turun sehingga inset dipaksa 0.
 * Ini mencegah composer "nyangkut" di tengah layar bila event resize
 * dari visualViewport tidak sampai (ditemukan di sebagian Chrome Android).
 */
export function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return type !== 'file' && type !== 'checkbox' && type !== 'radio' && type !== 'submit';
  }
  return false;
}

export function keyboardInsetPx(innerHeight: number, vvHeight: number, offsetTop: number, editing: boolean): number {
  if (!editing) return 0;
  return Math.max(0, innerHeight - vvHeight - offsetTop);
}

/** Shared visualViewport listener boilerplate for both hooks below. */
function trackViewport(recompute: () => void): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  let t = 0;
  const onBlur = () => { window.clearTimeout(t); t = window.setTimeout(recompute, 300); };
  vv.addEventListener('resize', recompute);
  vv.addEventListener('scroll', recompute);
  window.addEventListener('resize', recompute);
  window.addEventListener('orientationchange', recompute);
  document.addEventListener('focusin', recompute);
  document.addEventListener('focusout', onBlur);
  recompute();
  return () => {
    window.clearTimeout(t);
    vv.removeEventListener('resize', recompute);
    vv.removeEventListener('scroll', recompute);
    window.removeEventListener('resize', recompute);
    window.removeEventListener('orientationchange', recompute);
    document.removeEventListener('focusin', recompute);
    document.removeEventListener('focusout', onBlur);
  };
}

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => trackViewport(() => {
    const vv = window.visualViewport!;
    setInset(keyboardInsetPx(window.innerHeight, vv.height, vv.offsetTop, isEditableElement(document.activeElement)));
  }), []);
  return inset;
}

export function useVisualViewport(): { vvHeight: number; vvTop: number; keyboardOpen: boolean } {
  const [vvHeight, setVvHeight] = useState(0);
  const [vvTop, setVvTop] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const threshold = 60;
    const initialHeight = vv.height;
    return trackViewport(() => {
      const h = vv.height;
      setVvTop(vv.offsetTop);
      const editing = isEditableElement(document.activeElement);
      if (!editing) { setVvHeight(h); setKeyboardOpen(false); return; }
      setVvHeight(h);
      setKeyboardOpen(Math.max(initialHeight, h) - h > threshold);
    });
  }, []);
  return { vvHeight, vvTop, keyboardOpen };
}
