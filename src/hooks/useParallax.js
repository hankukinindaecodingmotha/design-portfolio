import { useEffect, useRef } from 'react';

/**
 * 히어로 배너용 스크롤 + 마우스 패럴랙스 훅.
 * 대상 엘리먼트에 CSS 변수를 실시간으로 주입합니다.
 *  --hp : 스크롤 진행도 (0 → 1, 배너 높이 기준)
 *  --mx : 마우스 X 오프셋 (-1 → 1)
 *  --my : 마우스 Y 오프셋 (-1 → 1)
 *
 * prefers-reduced-motion 환경에서는 모든 값을 0으로 고정합니다.
 */
export function useParallax() {
  const ref = useRef(null);
  const pointer = useRef({ x: 0, y: 0, progress: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (prefersReducedMotion) {
      el.style.setProperty('--hp', '0');
      el.style.setProperty('--mx', '0');
      el.style.setProperty('--my', '0');
      pointer.current = { x: 0, y: 0, progress: 0 };
      return;
    }

    let frame = 0;
    let targetMx = 0;
    let targetMy = 0;
    let curMx = 0;
    let curMy = 0;
    let mouseActive = false;

    const setScroll = () => {
      const height = el.offsetHeight || window.innerHeight;
      const progress = Math.min(Math.max(window.scrollY / height, 0), 1);
      el.style.setProperty('--hp', progress.toFixed(4));
      pointer.current.progress = progress;
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setScroll();
        frame = 0;
      });
    };

    // 마우스 패럴랙스는 부드럽게 따라오도록 별도 rAF 루프로 보간
    let mouseFrame = 0;
    const animateMouse = () => {
      curMx += (targetMx - curMx) * 0.08;
      curMy += (targetMy - curMy) * 0.08;
      el.style.setProperty('--mx', curMx.toFixed(4));
      el.style.setProperty('--my', curMy.toFixed(4));
      pointer.current.x = curMx;
      pointer.current.y = curMy;
      if (
        mouseActive ||
        Math.abs(targetMx - curMx) > 0.001 ||
        Math.abs(targetMy - curMy) > 0.001
      ) {
        mouseFrame = requestAnimationFrame(animateMouse);
      } else {
        mouseFrame = 0;
      }
    };

    const onMouseMove = (e) => {
      const rect = el.getBoundingClientRect();
      targetMx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      targetMy = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      mouseActive = true;
      if (!mouseFrame) mouseFrame = requestAnimationFrame(animateMouse);
    };

    const onMouseLeave = () => {
      targetMx = 0;
      targetMy = 0;
      mouseActive = false;
      if (!mouseFrame) mouseFrame = requestAnimationFrame(animateMouse);
    };

    setScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mouseleave', onMouseLeave);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      el.removeEventListener('mousemove', onMouseMove);
      el.removeEventListener('mouseleave', onMouseLeave);
      if (frame) cancelAnimationFrame(frame);
      if (mouseFrame) cancelAnimationFrame(mouseFrame);
    };
  }, []);

  return { ref, pointer };
}
