import { useEffect, useRef } from 'react';

/**
 * Focus trap hook for modal dialogs.
 * Traps Tab/Shift+Tab cycling within the dialog element.
 * Also focuses the first focusable element when the dialog opens.
 *
 * @param isActive - Whether the focus trap is active (dialog is open)
 * @returns A ref to attach to the dialog container element
 */
export function useFocusTrap(isActive: boolean) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Save the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element after DOM settles
    const focusTimer = setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const firstFocusable = dialog.querySelector<HTMLElement>(
        'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 50);

    return () => {
      clearTimeout(focusTimer);
      // Restore focus when dialog closes
      previousFocusRef.current?.focus();
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0]!;
      const lastElement = focusableElements[focusableElements.length - 1]!;

      if (e.shiftKey) {
        // Shift+Tab: if focus is on first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else if (document.activeElement === lastElement) {
        // Tab: focus on last element, wrap to first
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isActive]);

  return dialogRef;
}
