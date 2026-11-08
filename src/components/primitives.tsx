import { useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Party, Rating } from '../types';
import { initials, PARTY_COLOR, PARTY_NAME, RATING_HEX } from '../lib/format';
import { useLive } from '../lib/live';
import { PersonAvatar } from './PersonAvatar';

/* ───────────── Original primitives (props are stable) ───────────── */

/** Small round party swatch. Has an accessible title with the party name. */
export function PartyDot({ party, size = 10 }: { party: Party; size?: number }) {
  return (
    <span
      className="pt-partydot"
      title={PARTY_NAME[party]}
      style={{ width: size, height: size, background: PARTY_COLOR[party], boxShadow: `0 0 ${size}px -2px ${PARTY_COLOR[party]}` }}
    />
  );
}

/** Cook/Sabato-style rating pill (Solid D … Toss-up … Solid R). */
export function RatingBadge({ rating }: { rating: Rating }) {
  const c = RATING_HEX[rating] ?? '#888';
  return (
    <span className="pt-rating" style={{ background: c + '24', color: c, borderColor: c + '66' }}>
      {rating}
    </span>
  );
}

/**
 * Candidate avatar: licensed photo or initials fallback, ringed in party color (see PersonAvatar). Without a feed
 * headshot it falls back to the strictly matched 2026-candidate portrait index (Wikimedia Commons / bioguide).
 */
export function Avatar({ name, party, src, size = 40 }: { name: string; party: Party; src?: string; size?: number }) {
  return <PersonAvatar name={name} party={party} photo={src} lookup={src ? undefined : { name, scope: 'us26' }} size={size} />;
}

/** Pulsing "● LIVE" indicator. */
export function LiveDot({ label = 'LIVE', color }: { label?: string; color?: string }) {
  return (
    <span className="pt-livedot" style={color ? ({ '--pulse-c': color, color } as CSSProperties) : undefined}>
      <span className="pulse" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * Glass panel. `title` renders as a mono uppercase panel header; `action` sits at the right.
 * Optional: `kicker` (small label above title), `live` (pulsing LED in header), `flush` (no padding).
 */
export function Card({
  children, style, className, title, action, kicker, live, flush, as: Tag = 'section',
}: {
  children: ReactNode; style?: CSSProperties; className?: string; title?: ReactNode; action?: ReactNode;
  kicker?: ReactNode; live?: boolean; flush?: boolean; as?: 'section' | 'article' | 'div' | 'aside';
}) {
  return (
    <Tag className={`card pt-card ${flush ? 'pt-card--flush' : ''} ${className ?? ''}`} style={style}>
      {(title || action || kicker) && (
        <header className="pt-card__head">
          <div className="stack" style={{ gap: 4 }}>
            {kicker && <span className="kicker">{kicker}</span>}
            {title && (
              <h3 className="panel-title row" style={{ gap: 8 }}>
                {live && <span className="pulse" aria-hidden="true" />}
                {title}
              </h3>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}

/**
 * Results-source badge (name kept for compatibility). PolTok shows live data only, so it
 * always carries the real-data attribution ("LIVE · AP").
 */
export function SimBadge({ compact }: { compact?: boolean }) {
  return (
    <span className="pt-simbadge pt-simbadge--live" title="Real results: AP race calls and vote counts via The New York Times">
      <span className="pt-simbadge__dot" aria-hidden="true" />
      {compact ? 'AP' : 'LIVE · AP'}
    </span>
  );
}

/* ───────────── New primitives ───────────── */

export type ButtonVariant = 'primary' | 'accent' | 'ghost' | 'dem' | 'rep' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** visual style; default 'primary' (white) */
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** leading icon node */
  icon?: ReactNode;
  /** square icon-only button — pass aria-label! */
  iconOnly?: boolean;
  /** render as react-router <Link to> */
  to?: string;
  /** render as external <a href target=_blank> */
  href?: string;
}

/** Button / link-button. `to` → router Link, `href` → external anchor, else <button>. */
export function Button({ variant = 'primary', size = 'md', icon, iconOnly, to, href, className, children, type, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    variant === 'ghost' ? 'btn--ghost' : variant !== 'primary' ? `btn--${variant}` : '',
    size !== 'md' ? `btn--${size}` : '',
    iconOnly ? 'btn--icon' : '',
    className ?? '',
  ].join(' ');
  const inner = (
    <>
      {icon}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} aria-label={rest['aria-label']} title={rest.title}>{inner}</Link>;
  if (href)
    return (
      <a href={href} className={cls} target="_blank" rel="noreferrer noopener" aria-label={rest['aria-label']} title={rest.title}>
        {inner}
      </a>
    );
  return (
    <button type={type ?? 'button'} className={cls} {...rest}>
      {inner}
    </button>
  );
}

export type Tone = 'default' | 'dem' | 'rep' | 'ind' | 'tossup' | 'accent' | 'live';

/** Party → chip tone. */
export const partyTone = (p?: Party): Tone => (p === 'D' ? 'dem' : p === 'R' ? 'rep' : p ? 'ind' : 'default');

/**
 * Pill label. Interactive when `onClick` (button, toggles aria-pressed via `active`) or `to` (Link).
 */
export function Chip({
  children, tone = 'default', size = 'md', active, onClick, to, title, icon, className, style,
}: {
  children: ReactNode; tone?: Tone; size?: 'sm' | 'md'; active?: boolean; onClick?: () => void; to?: string;
  title?: string; icon?: ReactNode; className?: string; style?: CSSProperties;
}) {
  const cls = `chip ${tone !== 'default' ? `chip--${tone}` : ''} ${size === 'sm' ? 'chip--sm' : ''} ${className ?? ''}`;
  const inner = (
    <>
      {icon}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} title={title} style={style}>{inner}</Link>;
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick} aria-pressed={active ?? undefined} title={title} style={style}>
        {inner}
      </button>
    );
  return <span className={cls} title={title} style={style}>{inner}</span>;
}

/** "D+4.2" / "R+1.0" margin chip colored by leader. margin = leader's lead in points. */
export function MarginChip({ party, margin, size = 'sm' }: { party: Party; margin: number; size?: 'sm' | 'md' }) {
  return (
    <Chip tone={partyTone(party)} size={size} className="num">
      {party}+{Math.abs(margin).toFixed(1)}
    </Chip>
  );
}

/**
 * Section header: kicker (mono signpost) + title + right-aligned action.
 * `live` shows a pulse dot in the kicker.
 */
export function SectionHeader({
  kicker, title, action, live, as: H = 'h2', id, sub,
}: { kicker?: ReactNode; title: ReactNode; action?: ReactNode; live?: boolean; as?: 'h1' | 'h2' | 'h3'; id?: string; sub?: ReactNode }) {
  return (
    <header className="pt-sechead">
      <div className="stack" style={{ gap: 6, minWidth: 0 }}>
        {kicker && (
          <span className={`kicker ${live ? 'kicker--live' : ''}`}>
            {live && <span className="pulse" aria-hidden="true" />}
            {kicker}
          </span>
        )}
        <H id={id} className="pt-sechead__title">{title}</H>
        {sub && <p className="muted" style={{ fontSize: 14 }}>{sub}</p>}
      </div>
      {action && <div className="pt-sechead__action">{action}</div>}
    </header>
  );
}

/** Shimmering placeholder. `lines` > 1 renders a paragraph of bars (last one shorter). */
export function Skeleton({
  width = '100%', height = 14, radius, lines = 1, className, style,
}: { width?: number | string; height?: number | string; radius?: number | string; lines?: number; className?: string; style?: CSSProperties }) {
  if (lines > 1)
    return (
      <span className={`stack ${className ?? ''}`} style={{ gap: 8, ...style }} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className="skeleton" style={{ width: i === lines - 1 ? '60%' : width, height, borderRadius: radius }} />
        ))}
      </span>
    );
  return <span className={`skeleton ${className ?? ''}`} aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Friendly empty/zero state with optional icon and action. */
export function EmptyState({
  title, description, icon, action, compact,
}: { title: ReactNode; description?: ReactNode; icon?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={`pt-empty ${compact ? 'pt-empty--compact' : ''}`} role="status">
      <div className="pt-empty__icon" aria-hidden="true">
        {icon ?? (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        )}
      </div>
      <div className="pt-empty__title">{title}</div>
      {description && <div className="pt-empty__desc">{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

/**
 * Horizontal progress bar. `value` is 0..100 (e.g. expected vote %).
 * `color` any CSS color; `label` used as aria-label.
 */
export function ProgressBar({
  value, color = 'var(--accent)', height = 6, label = 'Progress', showValue, className,
}: { value: number; color?: string; height?: number; label?: string; showValue?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={`pt-progress ${className ?? ''}`}>
      <div className="pt-progress__track" style={{ height }} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)}>
        <div className="pt-progress__fill" style={{ width: `${v}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
      </div>
      {showValue && <span className="num pt-progress__val">{Math.round(v)}%</span>}
    </div>
  );
}

/**
 * CSS tooltip shown on hover and keyboard focus. Wraps `children` (should be focusable for a11y).
 */
export function Tooltip({ content, children, side = 'top' }: { content: ReactNode; children: ReactNode; side?: 'top' | 'bottom' }) {
  const id = useId();
  return (
    <span className={`pt-tip pt-tip--${side}`} aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="pt-tip__bubble">
        {content}
      </span>
    </span>
  );
}

/** Keyboard key hint, e.g. <Kbd>⌘K</Kbd> */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="pt-kbd">{children}</kbd>;
}
