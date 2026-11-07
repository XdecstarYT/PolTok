/** Rich inline cards for Ask PolTok answers. The model emits tokens like [[race:GA-SEN]]; we render them
 *  from the app's own live data. Unknown / invalid ids fall back to plain text (never a fake card). */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar, BalanceBar, Sparkline } from '../../components';
import { useLive } from '../../lib/live';
import { raceById, stateByAbbr } from '../../data';
import { pollSeriesById } from '../../data/polls';
import { FEDERAL, VICTORIA, auPartyColor } from '../../data/au';
import { PARTY_COLOR } from '../../lib/format';
import { USMap } from '../map/USMap';
import { api, countryOf } from '../parliament/api';
import type { Market } from '../../types';

export const TOKEN_RE = /\[\[(race|balance|seat|market|bill|poll|state):([A-Za-z0-9:_.-]{1,48})\]\]/g;
const SIDE = (p: string) => (p === 'I' ? 'D' : p);
const AU_SEATS = new Map([...FEDERAL.seats, ...VICTORIA.seats].map((s) => [s.id, s]));

/** Is this token renderable from app data right now (sync check; bills/AU markets resolve async)? */
export function validToken(kind: string, id: string) {
  switch (kind) {
    case 'race': return raceById.has(id);
    case 'balance': return id === 'senate' || id === 'house';
    case 'seat': return AU_SEATS.has(id);
    case 'poll': return pollSeriesById.has(id);
    case 'state': return stateByAbbr.has(id.toUpperCase());
    case 'market': case 'bill': return /^[\w:.-]+$/.test(id);
    default: return false;
  }
}

function Shell({ to, kicker, children, label }: { to?: string; kicker: string; children: ReactNode; label: string }) {
  const body = (
    <>
      <span className="ask-ec-kicker">{kicker}</span>
      {children}
    </>
  );
  return to ? (
    <Link to={to} className="ask-ec" aria-label={label}>{body}</Link>
  ) : (
    <div className="ask-ec" role="group" aria-label={label}>{body}</div>
  );
}

function RaceCard({ id }: { id: string }) {
  const live = useLive();
  const race = raceById.get(id)!;
  const r = live.results[id];
  const cands = r?.candidates?.length ? r.candidates : race.candidates;
  const total = r ? Object.values(r.votes).reduce((a, b) => a + b, 0) : 0;
  const rows = cands
    .map((c) => ({ c, pct: total && r ? (100 * (r.votes[c.id] || 0)) / total : 0 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2);
  const winner = r?.calledFor ? cands.find((c) => c.id === r.calledFor) : undefined;
  const flip = winner && SIDE(winner.party) !== SIDE(race.incumbentParty);
  return (
    <Shell to={`/race/${id}`} kicker={race.title} label={`${race.title} results`}>
      <span className="ask-ec-rows">
        {rows.map(({ c, pct }) => (
          <span key={c.id} className="ask-ec-cand">
            <Avatar name={c.name} party={c.party} src={c.photo} size={28} />
            <span className="ask-ec-name">{c.name}{winner?.id === c.id && <span className="ask-ec-check" aria-label="winner"> ✓</span>}</span>
            <span className="ask-ec-num">{total ? `${pct.toFixed(1)}%` : '—'}</span>
            <span className="ask-ec-bar" aria-hidden><span style={{ width: `${pct}%`, background: PARTY_COLOR[c.party] }} /></span>
          </span>
        ))}
      </span>
      <span className="ask-ec-meta">
        <span>{r ? `${Math.round(r.expectedPct)}% in` : 'No results yet'}</span>
        {winner ? <span className="ask-badge ask-badge--called">Called · {winner.party}</span> : r && <span className="ask-badge">Not called</span>}
        {flip && <span className="ask-badge ask-badge--flip">Flip</span>}
      </span>
    </Shell>
  );
}

function BalanceCard({ id }: { id: 'senate' | 'house' }) {
  const live = useLive();
  return (
    <Shell to={id === 'house' ? '/house' : '/'} kicker={id === 'senate' ? 'Senate balance of power' : 'House balance of power'} label={`${id} balance of power`}>
      <BalanceBar balance={live.balance[id]} compact showProjected={false} />
    </Shell>
  );
}

function SeatCard({ id }: { id: string }) {
  const s = AU_SEATS.get(id)!;
  return (
    <Shell to={`/au/seat/${id}`} kicker={s.chamber === 'vic' ? 'Victorian district' : `Federal seat · ${s.state}`} label={`${s.name} seat`}>
      <span className="ask-ec-seat">
        <span className="ask-ec-swatch" style={{ background: auPartyColor(s.party) }} aria-hidden />
        <span className="ask-ec-name"><strong>{s.name}</strong> · {s.member || 'vacant'} ({s.party})</span>
        <span className="ask-ec-num">{s.margin != null ? `${s.margin.toFixed(1)}%` : '—'}</span>
      </span>
      <span className="ask-ec-meta"><span>Margin{s.contest ? ` · ${s.contest}` : s.vs ? ` vs ${s.vs}` : ''}</span></span>
    </Shell>
  );
}

let auMarketsP: Promise<Market[]> | null = null;
function MarketCard({ id, fallback }: { id: string; fallback: ReactNode }) {
  const live = useLive();
  const local = live.markets.find((m) => m.id === id || m.id === `race:${id}` || m.raceId === id);
  const [au, setAu] = useState<Market | null | undefined>(local ? null : undefined);
  useEffect(() => {
    if (local || !id.startsWith('au:')) return setAu(null);
    auMarketsP ??= fetch('/api/au/markets').then((r) => (r.ok ? r.json() : { markets: [] })).then((d) => d.markets ?? []).catch(() => []);
    let on = true;
    auMarketsP.then((ms) => on && setAu(ms.find((m) => m.id === id) ?? null));
    return () => { on = false; };
  }, [id, local]);
  const m = local ?? au;
  if (!m) return au === undefined ? <span className="ask-ec ask-ec--loading" aria-busy="true" /> : <>{fallback}</>;
  return (
    <Shell kicker={`Market · ${m.source}`} label={m.question}>
      <span className="ask-ec-q">{m.question}</span>
      <span className="ask-ec-rows">
        {m.outcomes.slice(0, 3).map((o) => (
          <span key={o.label} className="ask-ec-cand">
            <span className="ask-ec-name">{o.label}</span>
            <span className="ask-ec-num">{Math.round(o.prob * 100)}%</span>
            <span className="ask-ec-bar" aria-hidden><span style={{ width: `${o.prob * 100}%`, background: o.color || 'var(--accent)' }} /></span>
          </span>
        ))}
      </span>
      {m.history && m.history.length > 2 && <Sparkline values={m.history.map((h) => h.p * 100)} width={220} height={26} ariaLabel="7-day price history" />}
    </Shell>
  );
}

function BillCard({ id, fallback }: { id: string; fallback: ReactNode }) {
  const [b, setB] = useState<{ label: string; title: string; stage: number; stages: string[]; stageLabel: string } | null | undefined>(undefined);
  useEffect(() => {
    let on = true;
    api.bill(countryOf(id), id).then((x) => on && setB(x), () => on && setB(null));
    return () => { on = false; };
  }, [id]);
  if (b === undefined) return <span className="ask-ec ask-ec--loading" aria-busy="true" />;
  if (!b) return <>{fallback}</>;
  return (
    <Shell to={`/parliament/bill/${encodeURIComponent(id)}`} kicker={`Bill · ${b.label}`} label={`${b.label} progress`}>
      <span className="ask-ec-q">{b.title}</span>
      <span className="ask-ec-steps" aria-label={`Stage: ${b.stageLabel}`}>
        {b.stages.map((s, i) => <span key={s} className={i <= b.stage ? 'on' : ''} title={s} />)}
      </span>
      <span className="ask-ec-meta"><span>{b.stageLabel}</span></span>
    </Shell>
  );
}

function PollCard({ id }: { id: string }) {
  const s = pollSeriesById.get(id)!;
  const last = s.polls[s.polls.length - 1];
  return (
    <Shell to="/polls" kicker={`Polls · ${s.polls.length}`} label={`${s.title} polls`}>
      <span className="ask-ec-q">{s.title}</span>
      <span className="ask-ec-rows">
        {s.keys.slice(0, 2).map((k) => (
          <span key={k.key} className="ask-ec-cand ask-ec-cand--spark">
            <span className="ask-ec-name">{k.label}</span>
            <Sparkline values={s.polls.slice(-20).map((p) => Number(p.values[k.key]) || 0)} width={90} height={20} color={k.color} dot={false} fill={false} ariaLabel={`${k.label} trend`} />
            <span className="ask-ec-num">{last?.values[k.key] ?? '—'}</span>
          </span>
        ))}
      </span>
      {last && <span className="ask-ec-meta"><span>Latest: {last.pollster}, {last.date}</span></span>}
    </Shell>
  );
}

function StateCard({ id }: { id: string }) {
  const abbr = id.toUpperCase();
  const st = stateByAbbr.get(abbr)!;
  return (
    <Shell to={`/state/${abbr}`} kicker="State" label={`${st.name} state page`}>
      <span className="ask-ec-state">
        <USMap focus={[abbr]} highlight={[abbr]} fills={{ [abbr]: 'var(--accent)' }} className="ask-ec-map" title={`${st.name} on the US map`} />
        <strong>{st.name}</strong>
      </span>
    </Shell>
  );
}

/** Render one token; invalid → plain text. */
export function EntityCard({ kind, id, raw }: { kind: string; id: string; raw: string }) {
  const fallback = <span className="ask-ec-plain">{id}</span>;
  if (!validToken(kind, id)) return raw ? fallback : null;
  switch (kind) {
    case 'race': return <RaceCard id={id} />;
    case 'balance': return <BalanceCard id={id as 'senate' | 'house'} />;
    case 'seat': return <SeatCard id={id} />;
    case 'market': return <MarketCard id={id} fallback={fallback} />;
    case 'bill': return <BillCard id={id} fallback={fallback} />;
    case 'poll': return <PollCard id={id} />;
    case 'state': return <StateCard id={id} />;
  }
  return fallback;
}
