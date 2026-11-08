import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, m as motion } from 'framer-motion';
import { useNow, useReducedMotion } from './hooks';
import { splitDuration } from './time';

/* ═════════════════ Tabs ═════════════════ */

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  /** optional count badge */
  count?: number;
}

/**
 * Controlled tabs with an animated (shared-layout) underline. Arrow keys move between tabs.
 * `variant="pill"` renders a segmented control. Render your panel yourself based on `value`.
 */
export function Tabs<T extends string = string>({
  tabs, value, onChange, variant = 'line', ariaLabel = 'Tabs', className,
}: { tabs: TabItem<T>[]; value: T; onChange: (id: T) => void; variant?: 'line' | 'pill'; ariaLabel?: string; className?: string }) {
  const layoutId = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + tabs.length) % tabs.length;
    refs.current[n]?.focus();
    onChange(tabs[n].id);
  };
  return (
    <div role="tablist" aria-label={ariaLabel} className={`tabs ${variant === 'pill' ? 'tabs--pill' : ''} ${className ?? ''}`}>
      {tabs.map((t, i) => {
        const sel = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            type="button"
            aria-selected={sel}
            tabIndex={sel ? 0 : -1}
            className="tab"
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {sel && <motion.span layoutId={layoutId} className="tab__bar" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 38 }} />}
            <span style={{ position: 'relative' }}>{t.label}</span>
            {t.count != null && <span className="tab__count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ═════════════════ Countdown ═════════════════ */

/**
 * Live countdown to `to` (epoch ms). Renders HH:MM:SS blocks (or "12m 04s" when `compact`).
 * Shows `doneLabel` once elapsed and fires `onDone` once.
 */
export function Countdown({
  to, compact, doneLabel = 'Now', onDone, className,
}: { to: number; compact?: boolean; doneLabel?: ReactNode; onDone?: () => void; className?: string }) {
  const now = useNow(1000);
  const { h, m, s, total } = splitDuration(to - now);
  const fired = useRef(false);
  useEffect(() => {
    if (total === 0 && !fired.current) {
      fired.current = true;
      onDone?.();
    }
    if (total > 0) fired.current = false;
  }, [total, onDone]);
  const p2 = (n: number) => String(n).padStart(2, '0');
  if (!Number.isFinite(to)) return null;
  if (total === 0) return <span className={`pt-count pt-count--done ${className ?? ''}`}>{doneLabel}</span>;
  if (compact)
    return (
      <span className={`num ${className ?? ''}`} aria-label={`${h} hours ${m} minutes ${s} seconds`}>
        {h > 0 ? `${h}h ${p2(m)}m` : `${m}m ${p2(s)}s`}
      </span>
    );
  return (
    <span className={`pt-count ${className ?? ''}`} role="timer" aria-label={`${h} hours ${m} minutes ${s} seconds remaining`}>
      {[
        [h, 'HRS'],
        [m, 'MIN'],
        [s, 'SEC'],
      ].map(([v, l], i) => (
        <span key={l as string} className="pt-count__unit" aria-hidden="true">
          {i > 0 && <span className="pt-count__sep">:</span>}
          <span className="pt-count__block">
            <span className="pt-count__v num">{p2(v as number)}</span>
            <span className="pt-count__l">{l}</span>
          </span>
        </span>
      ))}
    </span>
  );
}

/* ═════════════════ Modal / Sheet ═════════════════ */

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal. `variant="sheet"` slides up from the bottom (mobile-friendly), "dialog" is centered.
 * Esc / backdrop click → onClose. Focus is trapped and restored. Body scroll is locked while open.
 */
export function Modal({
  open, onClose, title, children, variant = 'dialog', width = 560, hideClose, ariaLabel, closeOnlyWithX,
}: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; variant?: 'dialog' | 'sheet';
  width?: number; hideClose?: boolean; ariaLabel?: string;
  /** ignore backdrop taps and Escape — close only via the X button */
  closeOnlyWithX?: boolean;
}) {
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel.current)?.focus();
    }, 20);
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !closeOnlyWithX) {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Tab' && panel.current) {
        const els = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!els.length) return;
        const first = els[0], last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prev?.focus?.();
    };
  }, [open, onClose, closeOnlyWithX]);

  const sheet = variant === 'sheet';
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className={`pt-modal ${sheet ? 'pt-modal--sheet' : ''}`}>
          <motion.div className="pt-modal__backdrop" onClick={closeOnlyWithX ? undefined : onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }} />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : ariaLabel}
            tabIndex={-1}
            className="pt-modal__panel card"
            style={{ maxWidth: sheet ? undefined : width }}
            initial={reduce ? { opacity: 0 } : sheet ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={reduce ? { opacity: 1 } : sheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : sheet ? { y: '100%' } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
          >
            {sheet && <span className="pt-modal__grab" aria-hidden="true" />}
            {(title || !hideClose) && (
              <header className="pt-modal__head">
                {title ? <h2 id={titleId} className="pt-modal__title">{title}</h2> : <span />}
                {!hideClose && (
                  <button type="button" className="btn btn--ghost btn--sm btn--icon" onClick={onClose} aria-label="Close">
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                )}
              </header>
            )}
            <div className="pt-modal__body">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
/** Alias: <Sheet> = <Modal variant="sheet"> */
export function Sheet(props: Omit<Parameters<typeof Modal>[0], 'variant'>) {
  return <Modal {...props} variant="sheet" />;
}

/* ═════════════════ Toasts ═════════════════ */

export interface ToastInput {
  title: ReactNode;
  body?: ReactNode;
  /** small mono label, e.g. "RACE CALL" */
  kicker?: ReactNode;
  tone?: 'info' | 'dem' | 'rep' | 'ind' | 'alert' | 'ok';
  /** router path to navigate to when clicked */
  to?: string;
  /** ms before auto-dismiss (default 6000; 0 = sticky) */
  duration?: number;
}
interface ToastRec extends ToastInput { id: number }
interface ToastApi {
  push: (t: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<ToastApi>({ push: () => -1, dismiss: () => {} });

/** Imperative toasts: `const toast = useToast(); toast.push({ title: 'Called', tone: 'dem' })`. Needs <ToastProvider> (mounted by Shell). */
export const useToast = () => useContext(ToastCtx);

let toastSeq = 0;

/** Provider + viewport for toasts (max 4 visible, newest on top). Shell mounts this once. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRec[]>([]);
  const reduce = useReducedMotion();
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);
  const push = useCallback(
    (t: ToastInput) => {
      const id = ++toastSeq;
      setItems((xs) => [{ ...t, id }, ...xs].slice(0, 4));
      const d = t.duration ?? 6000;
      if (d > 0) timers.current.set(id, setTimeout(() => dismiss(id), d));
      return id;
    },
    [dismiss],
  );
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);
  return (
    <ToastCtx.Provider value={api}>
      {children}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="pt-toasts" role="region" aria-label="Notifications" aria-live="polite">
            <AnimatePresence initial={false}>
              {items.map((t) => {
                const content = (
                  <>
                    <span className="pt-toast__stripe" aria-hidden="true" />
                    <span className="pt-toast__main">
                      {t.kicker && <span className="pt-toast__kicker">{t.kicker}</span>}
                      <span className="pt-toast__title">{t.title}</span>
                      {t.body && <span className="pt-toast__body">{t.body}</span>}
                    </span>
                  </>
                );
                return (
                  <motion.div
                    key={t.id}
                    layout={!reduce}
                    className={`pt-toast pt-toast--${t.tone ?? 'info'}`}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40, transition: { duration: 0.18 } }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  >
                    {t.to ? (
                      <Link to={t.to} className="pt-toast__link" onClick={() => dismiss(t.id)}>{content}</Link>
                    ) : (
                      <div className="pt-toast__link">{content}</div>
                    )}
                    <button type="button" className="pt-toast__x" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">×</button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}
