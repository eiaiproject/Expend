import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Shared Escape-to-close + Tab-cycling for modal dialogs/sheets. */
export function trapTabKey(e: KeyboardEvent, container: HTMLElement | null, onClose: () => void): void {
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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const restoreEl = restoreFocusRef?.current;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const initial =
      initialFocusRef?.current ??
      (containerRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? null);
    initial?.focus?.();
    const onKey = (e: KeyboardEvent) => trapTabKey(e, containerRef.current, () => onCloseRef.current());
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (restoreEl ?? previousFocus.current)?.focus?.();
    };
  }, [active, containerRef, initialFocusRef, restoreFocusRef]);
}
