import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { m } from 'framer-motion';
import type { GameState, RegionId } from '../engine/types';
import { CONTENT, partyColor, SEATS_TOTAL } from './adapter';

// ---------------------------------------------------------------- hemicycle

interface SeatPos { x: number; y: number; r: number }
function hemiLayout(n: number, rows = 6): SeatPos[] {
  const radii = Array.from({ length: rows }, (_, i) => 0.42 + (0.58 * i) / (rows - 1));
  const tot = radii.reduce((a, b) => a + b, 0);
  const per = radii.map((r) => Math.round((n * r) / tot));
  per[rows - 1] += n - per.reduce((a, b) => a + b, 0);
  const pts: (SeatPos & { a: number })[] = [];
  radii.forEach((r, i) => {
    for (let k = 0; k < per[i]; k++) {
      const a = Math.PI - (Math.PI * (k + 0.5)) / per[i];
      pts.push({ a, x: 100 + Math.cos(a) * r * 92, y: 100 - Math.sin(a) * r * 92, r: 3.6 });
    }
  });
  return pts.sort((p, q) => q.a - p.a || 0);
}
const LAYOUT = hemiLayout(SEATS_TOTAL);

/** 72-seat hemicycle. `colors[i]` fills seat i (left-to-right). */
export function Hemicycle({ colors, label, rm, popKey, center, className }: {
  colors: (string | null)[]; label: string; rm: boolean; popKey?: string | number; center?: ReactNode; className?: string;
}) {
  return (
    <div className={`q-hemi ${className ?? ''}`}>
      <svg viewBox="0 -4 200 108" role="img" aria-label={label}>
        <line x1="100" y1="2" x2="100" y2="100" className="q-hemi__maj" />
        {LAYOUT.map((p, i) => {
          const fill = colors[i] ?? 'var(--bg-3)';
          return rm ? (
            <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={fill} className="q-seat" />
          ) : (
            <m.circle key={`${popKey ?? ''}-${i}`} cx={p.x} cy={p.y} r={p.r} fill={fill} className="q-seat"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 14, delay: i * 0.006 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: 'view-box' } as React.CSSProperties} />
          );
        })}
      </svg>
      {center && <div className="q-hemi__center">{center}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- region map (original stylised hex map)

const GRID = [
  '  CCCAAA  ',
  ' CCCAAAAG ',
  'TTTCAAGGG.',
  'TTTTQQGGG.',
  'TTLLQQQBB.',
  ' LLLQQBBB.',
  ' LLLSSSBB.',
  '  ..SSS...',
];
const CODE: Record<string, RegionId> = { B: 'brassport', L: 'lowmere', A: 'ardent', S: 'sallow', Q: 'quillon', T: 'tamsfield', C: 'corvane', G: 'glasswick' };
const HR = 13;
const HW = Math.sqrt(3) * HR;
function hexPath(cx: number, cy: number) {
  let d = '';
  for (let i = 0; i < 6; i++) { const a = (Math.PI / 3) * i - Math.PI / 6; d += `${i ? 'L' : 'M'}${(cx + HR * Math.cos(a)).toFixed(1)},${(cy + HR * Math.sin(a)).toFixed(1)}`; }
  return d + 'Z';
}
const CELLS = GRID.flatMap((row, y) => row.split('').map((ch, x) => ({ ch, cx: 14 + x * HW + (y % 2 ? HW / 2 : 0), cy: 15 + y * HR * 1.5 }))).filter((c) => c.ch !== ' ');
const CENTROIDS: Record<string, { x: number; y: number }> = {};
for (const code of Object.keys(CODE)) {
  const cs = CELLS.filter((c) => c.ch === code);
  CENTROIDS[CODE[code]] = { x: cs.reduce((a, c) => a + c.cx, 0) / cs.length, y: cs.reduce((a, c) => a + c.cy, 0) / cs.length };
}

export function regionLeader(s: GameState, id: RegionId): { party: string | null; seats: Record<string, number> | null } {
  const last = s.elections[s.elections.length - 1];
  const r = last?.regions.find((x) => x.regionId === id);
  if (!r) return { party: null, seats: null };
  const party = Object.entries(r.seats).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { party, seats: r.seats };
}

export function RegionMap({ s, selected, onSelect, flash }: {
  s: GameState; selected?: RegionId | null; onSelect?: (id: RegionId) => void; flash?: Record<RegionId, string>;
}) {
  return (
    <svg className="q-map" viewBox="0 0 262 172" role="group" aria-label="Map of Calderra's 8 regions">
      {CELLS.filter((c) => c.ch === '.').map((c, i) => <path key={`s${i}`} d={hexPath(c.cx, c.cy)} className="q-map__sea" />)}
      {CONTENT.regions.map((reg) => {
        const lead = regionLeader(s, reg.id).party;
        const fill = flash?.[reg.id] ?? (lead ? partyColor(s, lead) : null);
        const camp = s.campaign[reg.id] ?? 0;
        const code = Object.keys(CODE).find((k) => CODE[k] === reg.id)!;
        const sel = selected === reg.id;
        return (
          <g key={reg.id} className={`q-map__reg${sel ? ' is-sel' : ''}`} role="button" tabIndex={onSelect ? 0 : -1}
            aria-label={`${reg.name}, ${reg.seats} seats${lead ? `, led by ${lead === 'player' ? s.player.name : CONTENT.rivals.find((r) => r.id === lead)?.name}` : ''}${camp ? `, campaigned ${camp} times` : ''}`}
            onClick={() => onSelect?.(reg.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect?.(reg.id); } }}>
            {CELLS.filter((c) => c.ch === code).map((c, i) => (
              <path key={i} d={hexPath(c.cx, c.cy)} className="q-map__hex" style={fill ? { fill, fillOpacity: 0.78 } : undefined} />
            ))}
            <text x={CENTROIDS[reg.id].x} y={CENTROIDS[reg.id].y - 2} className="q-map__lbl">{reg.name.split(' ')[0]}</text>
            <text x={CENTROIDS[reg.id].x} y={CENTROIDS[reg.id].y + 8} className="q-map__seats">{reg.seats}{camp ? ` · ${'▲'.repeat(Math.min(camp, 3))}` : ''}</text>
          </g>
        );
      })}
    </svg>
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
