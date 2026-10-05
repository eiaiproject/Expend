import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Hitung modal aktif agar satu Escape hanya menutup yang paling atas.
let openTraps = 0;

/** Shared Escape-to-close + Tab-cycling for modal dialogs/sheets. */
function trapTabKey(e: KeyboardEvent, container: HTMLElement | null, onClose: () => void): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    onClose();
    return;
  }
  if (e.key === 'Tab' && container) {
    const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

interface FocusTrapOptions {
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  active?: boolean;
}

/** Focuses `initialFocusRef` on mount, traps Tab, restores focus on unmount. */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  { onClose, initialFocusRef, restoreFocusRef, active = true }: FocusTrapOptions,
): void {
  const previousFocus = useRef<HTMLElement | null>(null);
  // Effect Event: handler memakai versi `onClose` terbaru TANPA membuat effect
  // ikut re-run. Sebelumnya `onClose` ada di dependency array padahal handler-nya
  // sudah lewat ref, sehingga setiap render induk (callback inline) membuat
  // effect teardown + re-run: cleanup mengembalikan fokus KE LUAR dialog, lalu
  // fokus ditarik lagi ke elemen pertama - fokus meloncat saat dialog terbuka.
  const closeDialog = useEffectEvent(onClose);
  useEffect(() => {
    if (!active) return;
    openTraps += 1;
    const myLevel = openTraps;
    const restoreEl = restoreFocusRef?.current;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const initial =
      initialFocusRef?.current ??
      (containerRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? null);
    initial?.focus?.();
    const onKey = (e: KeyboardEvent) => {
      // Hanya trap paling atas yang merespons Escape.
      if (e.key === 'Escape' && myLevel !== openTraps) return;
      trapTabKey(e, containerRef.current, () => closeDialog());
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      openTraps = Math.max(0, openTraps - 1);
      (restoreEl ?? previousFocus.current)?.focus?.();
    };
  }, [active, containerRef, initialFocusRef, restoreFocusRef]);
}
