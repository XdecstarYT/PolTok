// Shared primitives. Design/Shell agent may restyle & extend but MUST keep these exports & props.
import type { CSSProperties, ReactNode } from 'react';
import type { Party, Rating } from '../types';
import { initials, PARTY_COLOR, RATING_HEX } from '../lib/format';

export function PartyDot({ party, size = 10 }: { party: Party; size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: 99, background: PARTY_COLOR[party] }} />;
}

export function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: RATING_HEX[rating] + '33', color: RATING_HEX[rating], border: `1px solid ${RATING_HEX[rating]}66`, whiteSpace: 'nowrap' }}>
      {rating}
    </span>
  );
}

export function Avatar({ name, party, src, size = 40 }: { name: string; party: Party; src?: string; size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 99, display: 'inline-grid', placeItems: 'center', flex: 'none', background: `linear-gradient(135deg, ${PARTY_COLOR[party]}, #000)`, fontWeight: 700, fontSize: size * 0.36, overflow: 'hidden', border: `2px solid ${PARTY_COLOR[party]}` }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
    </span>
  );
}

export function LiveDot({ label = 'LIVE' }: { label?: string }) {
  return <span className="mono" style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 700 }}>● {label}</span>;
}

export function Card({ children, style, className, title, action }: { children: ReactNode; style?: CSSProperties; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${className ?? ''}`} style={{ padding: 16, ...style }}>
      {(title || action) && (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-2)' }}>{title}</h3>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function SimBadge() {
  return <span className="mono" title="Results are simulated for demonstration; plug in a live results feed in server/ to go live." style={{ fontSize: 10, letterSpacing: '0.1em', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--line-2)', color: 'var(--text-3)' }}>SIMULATED</span>;
}
