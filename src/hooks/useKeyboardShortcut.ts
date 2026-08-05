

/**
 * Shared guard for keyboard shortcut handlers.
 * Returns true if the event should be ignored (user is typing, in a dialog, or using modifier keys).
 */
export function useKeyboardShortcutGuard(): (e: KeyboardEvent) => boolean {
  return (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    const isEditable =
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable ||
      target.hasAttribute('contenteditable') ||
      target.getAttribute('role') === 'textbox';
    if (isEditable) return true;
    if (document.querySelector('[role="dialog"]')) return true; // NOSONAR S6819 — runtime detection
    if (e.metaKey || e.ctrlKey || e.altKey) return true;
    return false;
  };
}