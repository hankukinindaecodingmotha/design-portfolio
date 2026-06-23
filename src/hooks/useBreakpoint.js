import { useEffect, useState } from 'react';

function getBreakpoint() {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth <= 640) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState(getBreakpoint);

  useEffect(() => {
    const onResize = () => setBreakpoint(getBreakpoint());
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return breakpoint;
}
