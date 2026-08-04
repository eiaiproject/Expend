import { useEffect } from 'react';

/**
 * Registers an Escape key handler to call `onClose` when the sheet/modal is open.
 * Use in any dialog/sheet component that should close on Escape.
 */
export function useEscapeKeyClose(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);
}