import { useMemo, useState } from 'react';
import { RACES } from '../../data';
import { VICTORIA, FEDERAL } from '../../data/au';
import { ImagePanel } from './ImagePanel';
import { useDesigns } from './TweetKit';
import type { Subject } from './cards';

const PROMOS = ['default', 'live', 'map', 'au'];

export function CardStudio() {
  const ds = useDesigns();
  const [kind, setKind] = useState<Subject['kind']>('race');
  const options = useMemo(() => {
    if (kind === 'race' || kind === 'flip') return [...RACES].sort((a, b) => Number(!!b.key) - Number(!!a.key) || a.title.localeCompare(b.title)).map((r) => ({ id: r.id, label: `${r.key ? '★ ' : ''}${r.title}` }));
    if (kind === 'balance') return [{ id: 'senate', label: 'Senate' }, { id: 'house', label: 'House' }];
    if (kind === 'au-seat') return [...VICTORIA.seats, ...FEDERAL.seats].map((s) => ({ id: s.id, label: `${s.name} (${s.chamber === 'vic' ? 'Vic' : s.state} · ${s.party})` }));
    return PROMOS.map((p) => ({ id: p, label: p }));
  }, [kind]);
  const [id, setId] = useState('');
  const subjId = options.some((o) => o.id === id) ? id : options[0]?.id ?? '';
  const [design, setDesign] = useState('');
  if (!ds) return <p className="ow-muted">Loading designs…</p>;
  const sel = ds.designs.find((d) => d.id === design) ?? ds.designs[0];
  return (
    <section>
      <div className="ow-studio__ctl">
        <label>Subject type
          <select className="ow-select" value={kind} onChange={(e) => setKind(e.target.value as Subject['kind'])}>
            <option value="race">Race</option><option value="balance">Balance of power</option><option value="au-seat">AU seat</option><option value="promo">Promo</option><option value="flip">Flip</option>
          </select>
        </label>
        <label>Subject
          <select className="ow-select" value={subjId} onChange={(e) => setId(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
      </div>
      <p className="ow-muted">{ds.designs.length} designs{ds.shared ? '' : ' (classic fallback — shared card system not found)'}</p>
      <div className="ow-designs" role="listbox" aria-label="Designs">
        {ds.designs.map((d) => (
          <button key={d.id} type="button" role="option" aria-selected={d.id === sel.id} className={`ow-pill ${d.id === sel.id ? 'is-on' : ''}`} onClick={() => setDesign(d.id)}>
            {d.name}{d.w && d.h && !d.name.includes('×') ? ` · ${d.w}×${d.h}` : ''}
          </button>
        ))}
      </div>
      <ImagePanel designId={sel.id} subject={{ kind, id: subjId }} name={`poltok-${sel.id}-${subjId}`.replace(/[^a-z0-9-]+/gi, '-')} />
    </section>
  );
}
