import { useRef, useState, useEffect, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Additional class names applied to the wrapper when visible. */
  className?: string;
  /** Delay in ms before the reveal animation starts (stagger support). */
  delay?: number;
}

/**
 * Fades + translates children in once they enter the viewport.
 * Respects `prefers-reduced-motion: reduce` — in that mode children are
 * immediately visible with no transition.
 */
export function RevealOnScroll({ children, className = '', delay = 0 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // Check prefers-reduced-motion once
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);

    const el = ref.current;
    if (!el || mq.matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '60px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={
        reducedMotion
          ? undefined
          : {
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(16px)',
              transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
            }
      }
      aria-hidden={!visible ? 'true' : undefined}
    >
      {children}
    </div>
  );
}
