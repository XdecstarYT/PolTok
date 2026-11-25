/** Live Parliament + model widgets for Victoria 2026. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { PersonAvatar } from '../../../components/PersonAvatar';
import { personPhoto } from '../../../data/photos';
import { usePhotoIndex } from '../../../data/photos/store';
import { VIC_NAME, vicColor, type Rating, type VicLive, type VicModel } from '../vicLive';
import { candidates, member2022, personFor, seatById, type Person } from './people';
import './parliament.css';

export const RATING_LABEL: Record<Rating, string> = { safe: 'Safe', likely: 'Likely', leans: 'Leans', tossup: 'Toss-up' };
const pct = (x: number) => (x >= 0.995 ? '>99%' : x <= 0.005 ? '<1%' : `${Math.round(x * 100)}%`);
const ORDER = ['GRN', 'ALP', 'IND', 'OTH', 'ONP', 'LNP'];

/* ───────── Candidate profile card ───────── */
export function ProfileCard({ p, model, compact }: { p: Person; model?: VicModel | null; compact?: boolean }) {
  usePhotoIndex('au');
  const ph = personPhoto({ name: p.name, scope: 'au' });
  const ms = model?.seats[p.seatId];
  const rep = ms ? personFor(p.seatId, p.bucket, model) : null;
  const raw = ms && rep?.name === p.name ? ms.prob[p.bucket] ?? 0 : null;
  const chance = raw != null && raw >= 0.01 ? raw : null;
  return (
    <article className={`pc lg${compact ? ' pc--compact' : ''}`} style={{ ['--pc' as string]: vicColor(p.bucket) } as CSSProperties}>
      <div className="pc__top">
        <PersonAvatar name={p.name} color={vicColor(p.bucket)} lookup={{ name: p.name, scope: 'au' }} size={compact ? 52 : 76} shape={compact ? 'circle' : 'portrait'} />
        <div className="pc__id">
          <h3>{p.name}</h3>
          <p className="pc__party"><i />{p.partyName}</p>
          <p className="pc__seat"><Link to={`/au/seat/${p.seatId}`}>{p.seatName}</Link>{p.ballot ? <span className="faint"> · ballot #{p.ballot}</span> : null}</p>
        </div>
      </div>
      <div className="pc__badges">
        {p.leader && <span className="pc__badge is-lead">★ {p.leader}</span>}
        {p.sitting && <span className="pc__badge">Sitting MP</span>}
        {chance != null && <span className="pc__badge is-chance">Model win chance {pct(chance)}</span>}
      </div>
      {!compact && ph && <p className="pc__credit">Photo: {ph.credit}</p>}
    </article>
  );
}

/* ───────── Seat profile (modal) ───────── */
export function SeatProfile({ id, data, onClose }: { id: string; data: VicLive | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const seat = seatById.get(id);
  const ms = data?.model?.seats[id];
  const pend = data?.projection?.seats[id];
  const list = useMemo(() => candidates(id), [id]);
  const mem = member2022(id);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!seat) return null;
  const probs = ms ? Object.entries(ms.prob).filter(([, v]) => v >= 0.005) : [];
  const prims = ms ? Object.entries(ms.primaries).sort((a, b) => b[1] - a[1]) : [];
  return (
    <div className="sp-back" onClick={onClose} role="presentation">
      <div className="sp lg" role="dialog" aria-modal="true" aria-label={`${seat.name} seat profile`} ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="sp__x" onClick={onClose} aria-label="Close">✕</button>
        <header className="sp__head" style={{ ['--pc' as string]: vicColor(ms?.fav ?? 'OTH') } as CSSProperties}>
          <span className="sp__kicker">District of</span>
          <h2>{seat.name}</h2>
          {ms && <span className={`sp__rating r-${ms.rating}`}>{RATING_LABEL[ms.rating]} {VIC_NAME[ms.fav] ?? ms.fav}</span>}
        </header>
        <div className="sp__grid">
          <section>
            <h3>2022 result</h3>
            {mem && <div className="sp__mem"><PersonAvatar name={mem.name} color={vicColor(mem.bucket)} lookup={{ name: mem.name, scope: 'au' }} size={40} /><span><b>{mem.name}</b><br /><span className="faint">{mem.partyName}{pend ? ` · margin ${pend.margin}% v ${VIC_NAME[pend.vs] ?? pend.vs}` : ''}</span></span></div>}
          </section>
          {ms && (
            <section>
              <h3>PolTok model · win chance</h3>
              <ul className="sp__bars">{probs.map(([k, v]) => <li key={k} style={{ ['--c' as string]: vicColor(k), ['--w' as string]: `${v * 100}%` } as CSSProperties}><span>{VIC_NAME[k] ?? k}</span><b>{pct(v)}</b><i /></li>)}</ul>
            </section>
          )}
          {ms && (
            <section>
              <h3>Estimated first preferences</h3>
              <ul className="sp__bars is-small">{prims.map(([k, v]) => <li key={k} style={{ ['--c' as string]: vicColor(k), ['--w' as string]: `${Math.min(100, v * 1.6)}%` } as CSSProperties}><span>{k === 'IND' && ms.ind ? ms.ind.n : VIC_NAME[k] ?? k}</span><b>{v}%</b><i /></li>)}</ul>
              <p className="sp__ftwo">Final two (central estimate): {ms.finalTwo.map(([k, v]) => <b key={k} style={{ color: vicColor(k) }}>{VIC_NAME[k] ?? k} {v}%</b>).reduce((a, b) => <>{a} v {b}</>)}</p>
            </section>
          )}
        </div>
        <section className="sp__cands">
          <h3>{list.length} candidates · ballot-paper order</h3>
          <div className="sp__clist">{list.map((p) => <ProfileCard key={p.name} p={p} model={data?.model} compact />)}</div>
        </section>
        <footer className="sp__foot">
          <Link to={`/au/seat/${id}`} className="lg lg--pill lg-btn">Full seat page →</Link>
          <span className="faint">Model estimates are illustrative, not predictions. Candidates: Victorian Electoral Commission.</span>
        </footer>
      </div>
    </div>
  );
}

/* ───────── Model summary ───────── */
export function ModelSummary({ m }: { m: VicModel }) {
  const parties = ORDER.filter((k) => m.range[k] && m.range[k].p90 > 0).reverse();
  const h = m.hist.LNP ?? {};
  const xs = Object.keys(h).map(Number);
  const lo = Math.min(30, ...xs), hi = Math.max(70, ...xs);
  const maxH = Math.max(...Object.values(h), 1);
  return (
    <div className="ms">
      <div className="ms__maj lg" role="img" aria-label={`Coalition majority ${pct(m.majority.LNP)}, hung parliament ${pct(m.majority.hung)}, Labor majority ${pct(m.majority.ALP)}`}>
        <div className="ms__majbar">
          <span style={{ flex: m.majority.ALP, background: vicColor('ALP') }} />
          <span style={{ flex: m.majority.hung, background: 'repeating-linear-gradient(45deg,#6b7385 0 6px,#4a5160 6px 12px)' }} />
          <span style={{ flex: m.majority.LNP, background: vicColor('LNP') }} />
        </div>
        <div className="ms__majlab">
          <span><b style={{ color: vicColor('ALP') }}>{pct(m.majority.ALP)}</b> Labor majority</span>
          <span><b>{pct(m.majority.hung)}</b> Hung parliament</span>
          <span><b style={{ color: vicColor('LNP') }}>{pct(m.majority.LNP)}</b> Coalition majority</span>
        </div>
      </div>
      <ul className="ms__ranges" aria-label="Projected seats, median and 80% range">
        {parties.map((k) => { const r = m.range[k]; return (
          <li key={k} style={{ ['--c' as string]: vicColor(k) } as CSSProperties}>
            <span className="ms__name">{VIC_NAME[k] ?? k}</span>
            <b className="ms__med num">{r.median}</b>
            <span className="ms__track"><i style={{ left: `${(r.p10 / 88) * 100}%`, width: `${((r.p90 - r.p10) / 88) * 100}%` }} /><em style={{ left: `${(r.median / 88) * 100}%` }} /><u style={{ left: `${(45 / 88) * 100}%` }} /></span>
            <span className="ms__rng faint num">{r.p10}–{r.p90}</span>
          </li>
        ); })}
      </ul>
      <figure className="ms__hist">
        <figcaption>Coalition seats across {m.sims.toLocaleString()} simulations</figcaption>
        <div className="ms__bars">{Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((n) => (
          <span key={n} title={`${n} seats: ${pct((h[n] ?? 0) / m.sims)}`} style={{ height: `${((h[n] ?? 0) / maxH) * 100}%`, background: n >= 45 ? vicColor('LNP') : '#6b7385' }} />
        ))}<i style={{ left: `${((45 - lo) / (hi - lo + 1)) * 100}%` }}><em>45</em></i></div>
        <div className="ms__axis faint"><span>{lo}</span><span>{hi}</span></div>
      </figure>
    </div>
  );
}

/* ───────── Hemicycle of faces ───────── */
export type HView = 'model' | '2022' | 'live';
export function Hemicycle({ data, view, live, onPick }: { data: VicLive | null; view: HView; live?: Record<string, string>; onPick: (id: string) => void }) {
  usePhotoIndex('au');
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const seats = useMemo(() => {
    const m = data?.model;
    return [...seatById.keys()].map((id) => {
      let group = 'OTH', person: Person | null = null, rating: Rating | null = null, chance: number | null = null;
      if (view === '2022') { person = member2022(id); group = person?.bucket ?? 'OTH'; }
      else if (view === 'live' && live?.[id]) { group = live[id]; person = personFor(id, group, m); }
      else if (m?.seats[id]) { const s = m.seats[id]; group = s.fav; person = personFor(id, group, m); rating = s.rating; chance = s.prob[group] ?? null; }
      return { id, group, person, rating, chance };
    });
  }, [data, view, live]);
  const pos = useMemo(() => {
    const n = seats.length, rows = 6, r0 = 0.36, r1 = 0.97;
    const radii = Array.from({ length: rows }, (_, i) => r0 + ((r1 - r0) * i) / (rows - 1));
    const tot = radii.reduce((a, b) => a + b, 0);
    const counts = radii.map((r) => Math.round((n * r) / tot)); counts[rows - 1] += n - counts.reduce((a, b) => a + b, 0);
    const spots: { x: number; y: number; a: number }[] = [];
    radii.forEach((r, ri) => { const c = counts[ri]; for (let j = 0; j < c; j++) { const a = Math.PI - (Math.PI * (j + 0.5)) / c; spots.push({ x: 0.5 + (Math.cos(a) * r) / 2, y: 1 - Math.sin(a) * r, a }); } });
    return spots.sort((p, q) => q.a - p.a);
  }, [seats.length]);
  const ordered = useMemo(() => [...seats].sort((a, b) => ORDER.indexOf(a.group) - ORDER.indexOf(b.group) || (b.chance ?? 0) - (a.chance ?? 0)), [seats]);
  const tally = useMemo(() => { const o: Record<string, number> = {}; for (const s of seats) o[s.group] = (o[s.group] ?? 0) + 1; return o; }, [seats]);
  const hv = hover ? seats.find((s) => s.id === hover.id) : null;
  return (
    <div className="hc">
      <div className="hc__stage" onMouseLeave={() => setHover(null)}>
        {ordered.map((s, i) => {
          const p = pos[i]; if (!p) return null;
          return (
            <button key={s.id} type="button" className={`hc__seat${s.rating === 'tossup' ? ' is-tossup' : ''}`}
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, ['--c' as string]: vicColor(s.group), ['--d' as string]: `${i * 9}ms` } as CSSProperties}
              onMouseEnter={(e) => { const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); const b = e.currentTarget.getBoundingClientRect(); setHover({ id: s.id, x: b.left - r.left + b.width / 2, y: b.top - r.top }); }}
              onFocus={(e) => { const r = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); const b = e.currentTarget.getBoundingClientRect(); setHover({ id: s.id, x: b.left - r.left + b.width / 2, y: b.top - r.top }); }}
              onClick={() => onPick(s.id)}
              aria-label={`${seatById.get(s.id)?.name}: ${s.person?.name ?? 'unknown'} (${VIC_NAME[s.group] ?? s.group})${s.chance != null ? `, ${pct(s.chance)}` : ''}`}>
              {s.person ? <PersonAvatar name={s.person.name} color={vicColor(s.group)} lookup={{ name: s.person.name, scope: 'au' }} size={64} /> : <span className="hc__empty" />}
            </button>
          );
        })}
        <div className="hc__centre">
          <div className="hc__tally">{ORDER.filter((k) => tally[k]).reverse().map((k) => <span key={k}><b className="num" style={{ color: vicColor(k) }}>{tally[k]}</b><small>{VIC_NAME[k] ?? k}</small></span>)}</div>
          <span className="hc__maj">45 for a majority</span>
        </div>
        {hv && hover && hv.person && (
          <div className="hc__pop" style={{ left: hover.x, top: hover.y }}>
            <ProfileCard p={hv.person} model={data?.model} compact />
            <span className="hc__popseat">{seatById.get(hv.id)?.name}{hv.rating ? ` · ${RATING_LABEL[hv.rating]}` : ''} · tap for the seat profile</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Ratings board ───────── */
export function RatingsBoard({ m, onPick }: { m: VicModel; onPick: (id: string) => void }) {
  const cols: Rating[] = ['safe', 'likely', 'leans', 'tossup'];
  const groups = ORDER.filter((k) => Object.values(m.seats).some((s) => s.fav === k)).reverse();
  return (
    <div className="rb">
      {groups.map((g) => (
        <div key={g} className="rb__row" style={{ ['--c' as string]: vicColor(g) } as CSSProperties}>
          <h4>{VIC_NAME[g] ?? g} <span className="faint num">{Object.values(m.seats).filter((s) => s.fav === g).length}</span></h4>
          <div className="rb__cols">
            {cols.map((c) => {
              const ids = Object.entries(m.seats).filter(([, s]) => s.fav === g && s.rating === c).sort((a, b) => (b[1].prob[g] ?? 0) - (a[1].prob[g] ?? 0));
              return (
                <div key={c} className={`rb__col r-${c}`}>
                  <span className="rb__lab">{RATING_LABEL[c]} <b className="num">{ids.length}</b></span>
                  <div className="rb__chips">{ids.map(([id, s]) => <button key={id} type="button" onClick={() => onPick(id)} title={`${pct(s.prob[g] ?? 0)}`}>{seatById.get(id)?.name ?? id}</button>)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
