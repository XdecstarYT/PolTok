import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { m } from 'framer-motion';
import { SEATS_TOTAL } from './adapter';
import { tip } from './fx';

// ---------------------------------------------------------------- hemicycle

interface SeatPos { x: number; y: number; r: number; row: number }
function hemiLayout(n: number, rows = 6): SeatPos[] {
  const radii = Array.from({ length: rows }, (_, i) => 0.4 + (0.6 * i) / (rows - 1));
  const tot = radii.reduce((a, b) => a + b, 0);
  const per = radii.map((r) => Math.round((n * r) / tot));
  per[rows - 1] += n - per.reduce((a, b) => a + b, 0);
  const pts: (SeatPos & { a: number })[] = [];
  radii.forEach((r, i) => {
    for (let k = 0; k < per[i]; k++) {
      const a = Math.PI - (Math.PI * (k + 0.5)) / per[i];
      pts.push({ a, x: 100 + Math.cos(a) * r * 92, y: 100 - Math.sin(a) * r * 92, r: 3.9, row: i });
    }
  });
  return pts.sort((p, q) => q.a - p.a || p.row - q.row);
}
const LAYOUT = hemiLayout(SEATS_TOTAL);

export interface SeatView { color: string | null; flip?: boolean; dim?: boolean; ring?: string }

/** 72-seat hemicycle. `colors[i]` (or `seats[i]`) fills seat i (left-to-right). Seats show a tooltip from `seatTip`. */
export function Hemicycle({ colors, seats, label, rm, popKey, center, className, seatTip }: {
  colors?: (string | null)[]; seats?: SeatView[]; label: string; rm: boolean; popKey?: string | number; center?: ReactNode; className?: string;
  seatTip?: (i: number) => ReactNode;
}) {
  const view: SeatView[] = seats ?? (colors ?? []).map((c) => ({ color: c }));
  return (
    <div className={`q-hemi ${className ?? ''}`}>
      <svg viewBox="-4 -6 208 112" role="img" aria-label={label}>
        <path d="M0,100 A100,100 0 0 1 200,100 L176,100 A76,76 0 0 0 24,100 Z" className="q-hemi__floor2" />
        <path d="M2,100 A98,98 0 0 1 198,100 L160,100 A60,60 0 0 0 40,100 Z" className="q-hemi__floor" />
        <line x1="100" y1="-2" x2="100" y2="100" className="q-hemi__maj" />
        <rect x="92" y="99" width="16" height="3" rx="1.5" className="q-hemi__dais" />
        {LAYOUT.map((p, i) => {
          const sv = view[i] ?? { color: null };
          const fill = sv.color ?? 'var(--q-seat-empty)';
          const tp = seatTip ? tip(() => seatTip(i)) : {};
          const cls = `q-seat${sv.flip ? ' is-flip' : ''}${sv.dim ? ' is-dim' : ''}`;
          const common = { cx: p.x, cy: p.y, r: p.r, fill, className: cls, style: { transformOrigin: `${p.x}px ${p.y}px`, transformBox: 'view-box', ...(sv.ring ? { stroke: sv.ring, strokeWidth: 1 } : {}) } as React.CSSProperties };
          return rm || popKey === undefined ? (
            <circle key={i} {...common} {...tp} />
          ) : (
            <m.circle key={`${popKey}-${i}`} {...common} {...tp}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 14, delay: i * 0.006 }} />
          );
        })}
      </svg>
      {center && <div className="q-hemi__center">{center}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- confetti

export function Confetti({ colors, fire }: { colors: string[]; fire: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!fire) return;
    const cv = ref.current; if (!cv) return;
    const g = cv.getContext('2d'); if (!g) return;
    const W = (cv.width = window.innerWidth), H = (cv.height = window.innerHeight);
    const ps = Array.from({ length: 140 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35, vx: (Math.random() - 0.5) * 12, vy: -Math.random() * 14 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)], w: 5 + Math.random() * 6,
    }));
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      g.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); g.restore();
      }
      if (t - t0 < 2600) raf = requestAnimationFrame(step); else g.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [fire]); // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={ref} className="q-confetti" aria-hidden="true" />;
}

// ---------------------------------------------------------------- dialog

/** Accessible modal: focuses first control, restores focus, Esc closes (if onClose), basic focus trap. */
export function Dialog({ label, onClose, children, className, variant = 'sheet', rm }: {
  label: string; onClose?: () => void; children: ReactNode; className?: string; variant?: 'sheet' | 'center' | 'full'; rm: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el?.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, [tabindex]:not([tabindex="-1"])'));
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => { el?.removeEventListener('keydown', onKey); prev?.focus?.({ preventScroll: true }); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`q-scrim q-scrim--${variant}`} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <m.div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={`q-dlg q-dlg--${variant} ${className ?? ''}`}
        initial={rm ? false : variant === 'sheet' ? { y: 40, opacity: 0 } : { scale: 0.94, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.22 }}>
        {children}
      </m.div>
    </div>
  );
}

/** Small number roller for tallies. */
export function Roll({ value }: { value: number }) {
  return <span className="q-num" aria-live="off">{value}</span>;
}

export function Delta({ n, suffix = '' }: { n: number; suffix?: string }) {
  if (!n) return <span className="q-delta is-zero">0{suffix}</span>;
  return <span className={`q-delta ${n > 0 ? 'is-up' : 'is-down'}`}>{n > 0 ? '▲' : '▼'}{n > 0 ? '+' : ''}{Math.round(n)}{suffix}</span>;
}

export function useStable<T>(v: T) { return useMemo(() => v, [JSON.stringify(v)]); } // eslint-disable-line react-hooks/exhaustive-deps
