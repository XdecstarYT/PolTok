/** Clickable faces that morph into a full candidate profile (framer-motion shared layout), plus the profile itself.
 *  <Face person ctx/> anywhere → tap → <ProfileHost/> (mounted once per page) expands the face into the profile sheet. */
import { useEffect, useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { PersonAvatar } from '../../../components/PersonAvatar';
import { personPhoto } from '../../../data/photos';
import { usePhotoIndex } from '../../../data/photos/store';
import { useAuResults } from '../api';
import { partyKey } from '../model';
import { VIC_NAME, useVicLive, vicColor } from '../vicLive';
import { candidates, member2022, personFor, seatById, type Person } from './people';
import { FollowButton } from './components';
import PEOPLE from '../../../data/vic-people.json';
import './profile.css';

/* ── store ── */
type Open = { p: Person; lid: string } | null;
let cur: Open = null;
const subs = new Set<() => void>();
export const openProfile = (p: Person, lid: string) => { cur = { p, lid }; subs.forEach((f) => f()); };
export const closeProfile = () => { cur = null; subs.forEach((f) => f()); };
export const useOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur, () => null);

export const slugName = (n: string) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const profileUrl = (p: Person) => `/au/victoria/candidate/${p.seatId.replace(/^vic-/, '')}/${slugName(p.name)}`;
const grp = (x?: string | null) => { if (!x) return 'OTH'; const k = partyKey(x); return ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; };
const pctTxt = (x: number) => (x >= 0.995 ? '>99%' : x <= 0.005 ? '<1%' : `${Math.round(x * 100)}%`);

/** A face that opens the profile. ctx keeps layout ids unique when the same person appears twice on a page. */
export function Face({ p, ctx, size = 44, color, className, children, label }: { p: Person; ctx: string; size?: number; color?: string; className?: string; children?: ReactNode; label?: string }) {
  const open = useOpen();
  const lid = `${ctx}:${p.seatId}:${p.name}`;
  const hidden = open?.lid === lid;
  return (
    <m.button type="button" layoutId={hidden ? undefined : lid} className={`face ${className ?? ''}`} style={{ ['--c' as string]: color ?? vicColor(p.bucket), visibility: hidden ? 'hidden' : undefined } as CSSProperties}
      onClick={(e) => { e.stopPropagation(); openProfile(p, lid); }} aria-label={label ?? `Open ${p.name}'s profile`} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.96 }}>
      {children ?? <PersonAvatar name={p.name} color={color ?? vicColor(p.bucket)} lookup={{ name: p.name, scope: 'au' }} size={size} />}
    </m.button>
  );
}

/* ── the profile body (used in the overlay and on the standalone page) ── */
export function ProfileBody({ p, lid, onSwitch }: { p: Person; lid?: string; onSwitch?: (q: Person) => void }) {
  usePhotoIndex('au');
  const { data } = useVicLive();
  const res = useAuResults('vic2026');
  const ph = personPhoto({ name: p.name, scope: 'au' });
  const seat = seatById.get(p.seatId);
  const ms = data?.model?.seats[p.seatId];
  const pend = data?.projection?.seats[p.seatId];
  const rep = ms ? personFor(p.seatId, p.bucket, data?.model) : null;
  const isRep = rep?.name === p.name;
  const chance = ms && isRep ? ms.prob[p.bucket] ?? 0 : null;
  const est = ms && isRep ? ms.primaries[p.bucket] : null;
  const live = res.data && res.data.status !== 'pre-election' ? res.data.seats[p.seatId] : undefined;
  const liveFp = live?.fp?.find((f) => f.name && slugName(f.name) === slugName(p.name)) ?? live?.fp?.find((f) => grp(f.party) === p.bucket && isRep);
  const liveTcp = live?.tcp?.find((t) => (t.name ? slugName(t.name) === slugName(p.name) : grp(t.party) === p.bucket && isRep));
  const won = live?.called && grp(live.called) === p.bucket && isRep;
  const mem = member2022(p.seatId);
  const rivals = useMemo(() => candidates(p.seatId).filter((c) => c.name !== p.name), [p.seatId, p.name]);
  const c = vicColor(p.bucket);
  const R = 46, C = 2 * Math.PI * R;
  const share = () => { const u = location.origin + profileUrl(p); (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share?.({ title: `${p.name} · ${p.seatName}`, url: u }).catch(() => navigator.clipboard?.writeText(u)) ?? navigator.clipboard?.writeText(u); };
  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.15 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } } };
  return (
    <div className="pf" style={{ ['--c' as string]: c } as CSSProperties}>
      <div className="pf__band" aria-hidden="true" />
      <div className="pf__hero">
        <m.div className="pf__portrait" layoutId={lid} transition={{ type: 'spring', stiffness: 220, damping: 26 }}>
          <PersonAvatar name={p.name} color={c} lookup={{ name: p.name, scope: 'au' }} size={168} shape="portrait" />
          {won && <span className="pf__won">✓ Elected</span>}
        </m.div>
        <m.div className="pf__id" variants={stagger} initial="hidden" animate="show">
          <m.span variants={item} className="pf__kicker">{p.seatName} · ballot #{p.ballot ?? '—'}</m.span>
          <m.h2 variants={item}>{p.name}</m.h2>
          <m.p variants={item} className="pf__party"><i />{p.partyName}</m.p>
          <m.div variants={item} className="pf__badges">
            {p.leader && <span className="is-lead">★ {p.leader}</span>}
            {p.sitting && <span>Sitting MP for {p.seatName}</span>}
            {won && <span className="is-won">Won {p.seatName}</span>}
          </m.div>
        </m.div>
      </div>

      {(() => { const b = (PEOPLE as unknown as { people: Record<string, { summary: string | null }> }).people[`${p.seatId}|${p.name}`]; return b?.summary ? <p className="pf__bio">{b.summary.split(/(?<=\.)\s+/).slice(0, 2).join(' ')} <span className="faint">(Wikipedia)</span></p> : null; })()}
      <Link to={profileUrl(p)} className="lg-immersive pf__more" onClick={() => closeProfile()}><span className="lg-immersive__icon" aria-hidden="true">📖</span><span><small>Full profile</small>Who they are, what they stand for</span></Link>
      <m.div className="pf__grid" variants={stagger} initial="hidden" animate="show">
        {chance != null && (
          <m.section variants={item} className="pf__tile lg">
            <h4>Model win chance</h4>
            <div className="pf__ring">
              <svg viewBox="0 0 110 110" aria-hidden="true"><circle cx="55" cy="55" r={R} className="pf__ring-bg" /><m.circle cx="55" cy="55" r={R} className="pf__ring-fg" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - chance) }} transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }} /></svg>
              <b className="num">{pctTxt(chance)}</b>
            </div>
            <small>{ms ? `${ms.rating === 'tossup' ? 'Toss-up' : ms.rating[0].toUpperCase() + ms.rating.slice(1)} seat · PolTok model` : ''}</small>
          </m.section>
        )}
        {live && (
          <m.section variants={item} className="pf__tile lg">
            <h4>Live count</h4>
            <p className="pf__big num">{liveTcp ? `${liveTcp.pct.toFixed(1)}%` : liveFp ? `${liveFp.pct}%` : '—'}</p>
            <small>{liveTcp ? 'two-candidate preferred' : liveFp ? 'first preferences' : 'not in the leading two'} · {live.counted <= 100 ? `${live.counted}% counted` : `${live.counted.toLocaleString()} votes`}</small>
          </m.section>
        )}
        {est != null && (
          <m.section variants={item} className="pf__tile lg">
            <h4>Est. first preferences</h4>
            <p className="pf__big num">{est}%</p>
            <small>PolTok model, central estimate</small>
          </m.section>
        )}
        {data?.polls?.average && p.bucket in data.polls.average && (
          <m.section variants={item} className="pf__tile lg">
            <h4>{VIC_NAME[p.bucket]} statewide</h4>
            <p className="pf__big num">{data.polls.average[p.bucket as 'ALP']}%</p>
            <small>Average of the latest 4 polls</small>
          </m.section>
        )}
        <m.section variants={item} className="pf__tile lg pf__tile--wide">
          <h4>The seat: {seat?.name}</h4>
          <p>{mem ? <>Won by <b style={{ color: vicColor(mem.bucket) }}>{mem.name}</b> ({mem.partyName}) in 2022{pend ? <>, margin <b>{pend.margin}%</b> v {VIC_NAME[pend.vs] ?? pend.vs}</> : null}.</> : 'Held seat.'}{ms ? <> PolTok model favourite: <b style={{ color: vicColor(ms.fav) }}>{VIC_NAME[ms.fav] ?? ms.fav}</b> ({pctTxt(ms.prob[ms.fav] ?? 0)}).</> : null}</p>
        </m.section>
        <m.section variants={item} className="pf__tile lg pf__tile--wide">
          <h4>Running against · {rivals.length} candidates</h4>
          <div className="pf__rivals">
            {rivals.map((r) => (
              <button key={r.name} type="button" className="pf__rival" onClick={() => onSwitch?.(r)} style={{ ['--c' as string]: vicColor(r.bucket) } as CSSProperties} title={`${r.name} · ${r.partyName}`}>
                <PersonAvatar name={r.name} color={vicColor(r.bucket)} lookup={{ name: r.name, scope: 'au' }} size={46} />
                <span>{r.name.split(' ').slice(-1)[0]}</span>
              </button>
            ))}
          </div>
        </m.section>
      </m.div>

      <div className="pf__actions">
        <FollowButton id={p.seatId} />
        <Link to={`/au/victoria/parliament?seat=${p.seatId}`} className="lg lg--pill lg-btn" onClick={() => closeProfile()}>Seat profile →</Link>
        <Link to={profileUrl(p)} className="lg lg--pill lg-btn" onClick={() => closeProfile()}>Profile page</Link>
        <button type="button" className="lg lg--pill lg-btn" onClick={share}>🔗 Share</button>
      </div>
      <p className="pf__credit">{ph ? `Photo: ${ph.credit}. ` : 'No freely licensed photo available; initials shown. '}Candidate details: Victorian Electoral Commission (name, party, ballot position).</p>
    </div>
  );
}

/** Mount once per page: renders the open profile as a morphing overlay. */
export function ProfileHost() {
  const open = useOpen();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeProfile(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [open]);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div key="pfback" className="pf-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeProfile} role="presentation">
          <m.div className="pf-sheet lg" role="dialog" aria-modal="true" aria-label={`${open.p.name} profile`} onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.97 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}>
            <button type="button" className="pf-x" onClick={closeProfile} aria-label="Close profile">✕</button>
            <ProfileBody key={open.p.name} p={open.p} lid={open.lid} onSwitch={(q) => openProfile(q, `rival:${q.seatId}:${q.name}`)} />
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
