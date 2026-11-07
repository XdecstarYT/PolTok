import { useState, type CSSProperties } from 'react';
import type { Party } from '../types';
import { initials, PARTY_COLOR } from '../lib/format';
import { photoFromUrl, type PersonPhoto } from '../data/photos';
import './person-avatar.css';

/**
 * The one avatar for any candidate / member / leader. Shows a licensed portrait (with its credit as a tooltip)
 * or, when none is known or the image fails, an initials badge on a party-colour gradient ring — clearly not a photo.
 */
export function PersonAvatar({ name, party, color, photo, size = 40, shape = 'circle', className }: {
  name: string; party?: Party; color?: string; photo?: PersonPhoto | string | null; size?: number;
  shape?: 'circle' | 'portrait'; className?: string;
}) {
  const [bad, setBad] = useState<string | null>(null);
  const c = color || (party ? PARTY_COLOR[party] : undefined) || '#8a8f98';
  const ph = typeof photo === 'string' ? photoFromUrl(photo) : photo || undefined;
  const show = ph && bad !== ph.url;
  const h = shape === 'portrait' ? Math.round(size * 1.22) : size;
  const style = { width: size, height: h, fontSize: Math.max(9, size * 0.36), '--pa-c': c } as CSSProperties;
  return (
    <span className={`pa pa--${shape} ${show ? 'pa--photo' : 'pa--ini'} pt-avatar ${className ?? ''}`} style={style} title={show ? `${name} — ${ph!.credit}` : name}>
      {show ? (
        <img src={ph!.url} alt={name} width={size} height={h} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(ph!.url)} />
      ) : (
        <><span className="pa__ini" aria-hidden="true">{initials(name || '?')}</span><span className="sr-only">{name}</span></>
      )}
    </span>
  );
}
