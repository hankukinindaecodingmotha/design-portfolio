import { useEffect, useRef } from 'react';

function isInViewport(el, margin = 0) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top < window.innerHeight - margin &&
    rect.bottom > margin
  );
}

export function useReveal(threshold = 0.12) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reveal = () => el.classList.add('revealed');

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      reveal();
      return;
    }

    if (isInViewport(el, 80)) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: '0px 0px 0px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return ref;
}
