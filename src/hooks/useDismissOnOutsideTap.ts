import { useEffect, type RefObject } from 'react';

/**
 * Dismisses an open popover when the user taps (pointer-down) outside the
 * given container.
 *
 * Friction audit B4: replaces the racy `setTimeout`-on-blur pattern. With the
 * old pattern a tap that lands on a suggestion could be swallowed by the
 * timer, or the dropdown could stay open; a document-level `pointerdown`
 * listener closes the panel before the click event fires, so buttons outside
 * the container never get their click intercepted and nothing stays stuck.
 */
export function useDismissOnOutsideTap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  isOpen: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen, onDismiss, containerRef]);
}
