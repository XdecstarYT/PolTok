// Shared game-feel primitives: tooltips (hover, long-press, focus), number tickers.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../audio';

// ---------------------------------------------------------------- tooltip store

interface TipState { content: ReactNode; rect: DOMRect; id: number }
let cur: TipState | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
let seq = 0;
function showTip(content: ReactNode, el: Element) { cur = { content, rect: el.getBoundingClientRect(), id: ++seq }; emit(); }
export function hideTip() { if (cur) { cur = null; emit(); } }

let pressTimer = 0;
/** Tooltips open on focus only after keyboard navigation, not after programmatic focus or taps. */
let kbdNav = false;
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key.startsWith('Arrow')) kbdNav = true; }, true);
  window.addEventListener('pointerdown', () => { kbdNav = false; }, true);
}
let pressFired = false;
let pressStart: { x: number; y: number } | null = null;
const LONG_PRESS_MS = 420;

export type TipContent = ReactNode | (() => ReactNode);
const resolve = (c: TipContent) => (typeof c === 'function' ? (c as () => ReactNode)() : c);

/** Event props that attach a tooltip to any element (HTML or SVG): mouse hover, touch long-press, keyboard focus. */
export function tip(content: TipContent) {
  return {
    'data-tip': '',
    onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') showTip(resolve(content), e.currentTarget); },
    onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') hideTip(); },
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const el = e.currentTarget;
      pressFired = false; pressStart = { x: e.clientX, y: e.clientY };
      window.clearTimeout(pressTimer);
      pressTimer = window.setTimeout(() => { pressFired = true; haptic(8); showTip(resolve(content), el); }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!pressStart || e.pointerType === 'mouse') return;
      if (Math.hypot(e.clientX - pressStart.x, e.clientY - pressStart.y) > 10) { window.clearTimeout(pressTimer); pressStart = null; }
    },
    onPointerUp: () => { window.clearTimeout(pressTimer); pressStart = null; },
    onPointerCancel: () => { window.clearTimeout(pressTimer); pressStart = null; },
    onContextMenu: (e: React.MouseEvent) => { if (pressFired || pressStart) e.preventDefault(); },
    onClickCapture: (e: React.MouseEvent) => { if (pressFired) { e.preventDefault(); e.stopPropagation(); pressFired = false; } },
    onFocus: (e: React.FocusEvent) => { if (kbdNav) showTip(resolve(content), e.currentTarget); },
    onBlur: () => hideTip(),
  };
}

/** Inline tooltip anchor. Focusable unless it wraps an interactive element (`focus={false}`). */
export function Tip({ content, children, className, focus = true, as = 'span' }: { content: TipContent; children: ReactNode; className?: string; focus?: boolean; as?: 'span' | 'div' }) {
  const Cmp = as;
  const sr = typeof content === 'string' ? content : undefined;
  return (
    <Cmp className={`q-tipa ${className ?? ''}`} tabIndex={focus ? 0 : undefined} {...tip(content)}>
      {children}{sr && <span className="q-sr">. {sr}</span>}
    </Cmp>
  );
}

/** Renders the single floating tooltip. Mount once. */
export function TipLayer() {
  const t = useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => cur, () => null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!t || !ref.current) { setPos(null); return; }
    const b = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const below = t.rect.top - b.height - 10 < 8;
    const left = Math.max(8, Math.min(vw - b.width - 8, t.rect.left + t.rect.width / 2 - b.width / 2));
    const top = below ? t.rect.bottom + 8 : t.rect.top - b.height - 8;
    setPos({ left, top, below });
  }, [t]);
  useEffect(() => {
    if (!t) return;
    const off = (e: Event) => { if (e.type === 'scroll' || e.type === 'keydown' || (e as PointerEvent).pointerType !== 'mouse') hideTip(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') hideTip(); };
    const tmo = window.setTimeout(() => { window.addEventListener('pointerdown', off, true); }, 30);
    window.addEventListener('scroll', off, true); window.addEventListener('keydown', k, true);
    return () => { window.clearTimeout(tmo); window.removeEventListener('pointerdown', off, true); window.removeEventListener('scroll', off, true); window.removeEventListener('keydown', k, true); };
  }, [t]);
  if (!t) return null;
  return createPortal(
    <div ref={ref} role="tooltip" className={`q-tip${pos?.below ? ' is-below' : ''}`} style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: 0 }}>{t.content}</div>,
    document.body,
  );
}

// ---------------------------------------------------------------- number ticker

/** Rolls smoothly from the previous value to `value`; flashes up/down. Instant under reduced motion. */
export function Num({ value, rm, format = (n: number) => String(Math.round(n)), className, dur = 650 }: {
  value: number; rm: boolean; format?: (n: number) => string; className?: string; dur?: number;
}) {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current, b = value;
    from.current = value;
    if (a === b) return;
    if (rm) { setShown(b); return; }
    setDir(b > a ? 1 : -1);
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (b - a) * e);
      if (k < 1) raf = requestAnimationFrame(step); else window.setTimeout(() => setDir(0), 250);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, rm, dur]);
  return <span className={`q-num q-tick${dir > 0 ? ' is-up' : dir < 0 ? ' is-down' : ''} ${className ?? ''}`}>{format(shown)}</span>;
}

export { seeded } from './seeded';
