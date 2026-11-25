/** Liquid Glass pointer highlight: one delegated listener sets --mx/--my on the .lg element under the pointer. */
import '../styles/liquid-glass.css';

let installed = false;
export function installLiquidGlass() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  let raf = 0, last: PointerEvent | null = null;
  window.addEventListener('pointermove', (e) => {
    last = e;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const el = (last?.target as Element | null)?.closest?.('.lg, .lg-immersive') as HTMLElement | null;
      if (!el || !last) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((last.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((last.clientY - r.top) / r.height) * 100}%`);
    });
  }, { passive: true });
}
installLiquidGlass();
