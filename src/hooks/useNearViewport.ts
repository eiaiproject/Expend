import { useRef, useState, useEffect } from 'react';

/**
 * Returns true once the element (or its sentinel) is within `rootMargin` of the viewport.
 * After becoming true it stays true forever. Falls back to true on SSR or if
 * IntersectionObserver is unavailable.
 */
export function useNearViewport(rootMargin = '400px'): [ref: React.RefObject<HTMLDivElement | null>, isNear: boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Fallback: if IO is missing (very rare), render immediately
    if (typeof IntersectionObserver === 'undefined') {
      setIsNear(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
    // rootMargin is a static string; no need to re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, isNear];
}
