import { useCallback, useEffect, useState } from 'react';

type OverflowAxis = 'x' | 'y';

/**
 * Reports whether a scrollable element overflows along `axis` (i.e. content
 * can actually be scrolled) and returns a callback ref to attach to it.
 *
 * Used to apply scroll-affordance fades (`.scroll-fade-x` /
 * `.scroll-fade-bottom`) only when they are meaningful — content that
 * already fits needs no edge fade (master.md Phase 7).
 *
 * A callback ref is used so the measurement re-runs whenever the element
 * appears or disappears (conditional rendering), not just on first mount.
 * Live updates come from ResizeObserver (container resizes), MutationObserver
 * (items added/removed), and a window resize listener.
 */
export function useOverflow<T extends HTMLElement>(axis: OverflowAxis = 'x') {
  const [overflows, setOverflows] = useState(false);
  const [el, setEl] = useState<T | null>(null);

  const ref = useCallback((node: T | null) => {
    setEl(node);
  }, []);

  useEffect(() => {
    if (!el) return;

    const update = () => {
      // +1 px tolerance for subpixel rounding.
      setOverflows(
        axis === 'x'
          ? el.scrollWidth > el.clientWidth + 1
          : el.scrollHeight > el.clientHeight + 1,
      );
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(el, { childList: true, subtree: true });

    window.addEventListener('resize', update);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [el, axis]);

  return { ref, overflows } as const;
}
