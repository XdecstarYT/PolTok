/**
 * /flips — Seats that changed hands. Real AP calls via the NYT results JSON (senate, governor,
 * all 435 House seats), polled every 60s. Owned by src/features/flips/**.
 */
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LiveDot, fmtTime, tzAbbr, useReducedMotion } from '../../components';
import { PARTY_HEX } from '../../lib/format';
import { USMap } from '../map/USMap';
import { stateShape } from '../map/geometry';
import { ATTRIBUTION, useFlipsData, type FlipRace, type Office, type P } from './data';
import './flips.css';

const OFFICES: { id: Office; label: string }[] = [
  { id: 'senate', label: 'Senate' },
  { id: 'governor', label: 'Governor' },
  { id: 'house', label: 'House' },
];
const HEX: Record<P, string> = { D: PARTY_HEX.D, R: PARTY_HEX.R, I: PARTY_HEX.I ?? '#a78bfa', O: '#8a8f98' };
const PNAME: Record<P, string> = { D: 'Democrats', R: 'Republicans', I: 'Independents', O: 'Other' };
const pshort = (p?: P) => (p === 'D' ? 'Dem' : p === 'R' ? 'GOP' : p === 'I' ? 'Ind' : '?');
const COMPETITIVE = new Set(['tossup', 'lean-dem', 'lean-rep', 'likely-dem', 'likely-rep']);

type OfficeFilter = Office | 'all';
type PartyFilter = 'all' | 'D' | 'R';

export default function FlipsPage() {
  const { data, loading } = useFlipsData(60000);
  const [office, setOffice] = useState<OfficeFilter>('all');
  const [party, setParty] = useState<PartyFilter>('all');
  const [state, setState] = useState<string | null>(null);
  const races = data?.races ?? [];

  const flips = useMemo(
    () => races.filter((r) => r.flipped).sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0)),
    [races],
  );
  const tally = useMemo(() => {
    const t = {} as Record<Office, { D: number; R: number; I: number; called: number; total: number }>;
    for (const o of OFFICES) t[o.id] = { D: 0, R: 0, I: 0, called: 0, total: 0 };
    for (const r of races) {
      const x = t[r.office];
      x.total++;
      if (r.called) x.called++;
      if (!r.flipped || !r.winner) continue;
      const w = r.winner.party;
      if (w === 'D' || w === 'R' || w === 'I') x[w]++;
      if (r.before === 'D' || r.before === 'R' || r.before === 'I') x[r.before]--;
    }
    return t;
  }, [races]);

  const shown = flips.filter(
    (r) => (office === 'all' || r.office === office) && (party === 'all' || r.winner?.party === party) && (!state || r.state === state),
  );

  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    const count: Record<string, Record<string, number>> = {};
    for (const r of flips) {
      if (office !== 'all' && r.office !== office) continue;
      if (party !== 'all' && r.winner?.party !== party) continue;
      const p = r.winner?.party ?? 'O';
      (count[r.state] ??= {})[p] = (count[r.state][p] ?? 0) + 1;
    }
    for (const [st, c] of Object.entries(count)) {
      const d = c.D ?? 0, rr = c.R ?? 0;
      f[st] = d && rr ? '#8b5cf6' : d ? HEX.D : rr ? HEX.R : HEX.I;
    }
    return { f, count };
  }, [flips, office, party]);

  const watch = useMemo(
    () =>
      races
        .filter((r) => !r.called && (office === 'all' || r.office === office) && (!state || r.state === state))
        .map((r) => ({ r, margin: r.cands.length > 1 ? r.cands[0].pct - r.cands[1].pct : 100 }))
        .sort((a, b) => {
          const ca = COMPETITIVE.has(a.r.rating || '') ? 0 : 1, cb = COMPETITIVE.has(b.r.rating || '') ? 0 : 1;
          const oa = a.r.office === 'house' ? 1 : 0, ob = b.r.office === 'house' ? 1 : 0;
          return oa - ob || ca - cb || a.margin - b.margin;
        }),
    [races, office, state],
  );
  const [watchAll, setWatchAll] = useState(false);

  return (
    <div className="page fl-page">
      <header className="fl-head">
        <div className="fl-kicker mono">
          <LiveDot /> <span>MIDTERMS 2026 · REAL AP CALLS</span>
        </div>
        <h1>Seats that changed hands</h1>
        <p className="fl-sub">
          Every Senate, governor and House race where AP has called a winner from a different party than the one that held
          the seat. {ATTRIBUTION}.{' '}
          <span className="mono fl-upd">
            {loading ? 'Loading…' : data ? `Updated ${fmtTime(data.updatedAt, true)} ${tzAbbr()} · refreshes every 60s` : ''}
            {data?.errors.length ? ` · ${data.errors.join(', ')} feed unavailable` : ''}
          </span>
        </p>
      </header>

      <section className="fl-tally" aria-label="Net gains by chamber">
        {OFFICES.map((o) => {
          const t = tally[o.id];
          const lead: P | null = t.D > t.R ? 'D' : t.R > t.D ? 'R' : null;
          return (
            <div key={o.id} className="fl-tcard">
              <div className="fl-tcard-h mono">{o.label}</div>
              <div className="fl-tnums">
                <span style={{ color: HEX.D }}>D {fmtNet(t.D)}</span>
                <span style={{ color: HEX.R }}>R {fmtNet(t.R)}</span>
                {t.I !== 0 && <span style={{ color: HEX.I }}>I {fmtNet(t.I)}</span>}
              </div>
              <div className="fl-tfoot mono">
                {lead ? `${PNAME[lead]} net +${t[lead]}` : 'No net change'} ·{' '}
                {t.called}/{t.total} called
              </div>
            </div>
          );
        })}
      </section>

      <div className="fl-filters" role="toolbar" aria-label="Filters">
        <Seg value={office} onChange={setOffice} opts={[['all', 'All'], ['senate', 'Senate'], ['governor', 'Governor'], ['house', 'House']]} />
        <Seg value={party} onChange={setParty} opts={[['all', 'Any party'], ['D', 'Dem gains'], ['R', 'GOP gains']]} />
        {state && (
          <button className="fl-chip" onClick={() => setState(null)}>
            {state} ✕
          </button>
        )}
      </div>

      <div className="fl-grid">
        <section className="fl-cards" aria-label="Flipped seats">
          <h2 className="fl-h2 mono">
            {shown.length} flip{shown.length === 1 ? '' : 's'}
            {state ? ` in ${state}` : ''}
          </h2>
          {loading && !data && <div className="fl-empty">Loading AP results…</div>}
          {data && shown.length === 0 && <div className="fl-empty">No called flips match these filters yet.</div>}
          <div className="fl-cardgrid">
            <AnimatePresence initial={false}>
              {shown.map((r, i) => (
                <FlipCard key={r.id} r={r} i={i} />
              ))}
            </AnimatePresence>
          </div>
        </section>

        <aside className="fl-side">
          <div className="fl-panel">
            <h2 className="fl-h2 mono">Map of flips</h2>
            <USMap
              fills={fills.f}
              highlight={Object.keys(fills.f)}
              selected={state}
              onStateClick={(a) => setState((s) => (s === a ? null : a))}
              renderTooltip={(a) => {
                const c = fills.count[a];
                return c ? `${a}: ${Object.entries(c).map(([p, n]) => `${n} ${pshort(p as P)} gain${n > 1 ? 's' : ''}`).join(', ')}` : `${a}: no flips`;
              }}
              describe={(a) => (fills.count[a] ? `${a} has flipped seats` : `${a} no flips`)}
              title="States with flipped seats"
            />
            <div className="fl-legend mono">
              <span><i style={{ background: HEX.D }} />Dem gain</span>
              <span><i style={{ background: HEX.R }} />GOP gain</span>
              <span><i style={{ background: '#8b5cf6' }} />Both</span>
            </div>
          </div>

          <div className="fl-panel">
            <h2 className="fl-h2 mono">Uncalled races to watch · {watch.length}</h2>
            <ul className="fl-watch">
              {(watchAll ? watch : watch.slice(0, 12)).map(({ r, margin }) => {
                const lead = r.cands[0];
                return (
                  <li key={r.id}>
                    <span className="fl-wl">
                      <b>{r.label}</b>
                      <small className="mono">{r.status === 'runoff' ? 'Runoff' : `${Math.round(r.eevp)}% in`}</small>
                    </span>
                    {lead && lead.votes > 0 ? (
                      <span className="fl-wr mono" style={{ color: HEX[lead.party] }}>
                        {lead.name.split(' ').slice(-1)[0]} +{margin.toFixed(1)}
                      </span>
                    ) : (
                      <span className="fl-wr mono muted">no votes yet</span>
                    )}
                  </li>
                );
              })}
            </ul>
            {watch.length > 12 && (
              <button className="fl-more" onClick={() => setWatchAll((v) => !v)}>
                {watchAll ? 'Show fewer' : `Show all ${watch.length}`}
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function fmtNet(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0';
}

function Seg<T extends string>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: [T, string][] }) {
  return (
    <div className="fl-seg">
      {opts.map(([v, l]) => (
        <button key={v} aria-pressed={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

function FlipCard({ r, i }: { r: FlipRace; i: number }) {
  const reduce = useReducedMotion();
  const shape = useMemo(() => stateShape(r.state, 72, 56, 4), [r.state]);
  const from = HEX[r.before ?? 'O'];
  const to = HEX[r.winner?.party ?? 'O'];
  const w = r.winner!;
  const second = r.cands.find((c) => c.id !== w.id);
  return (
    <motion.article
      layout={!reduce}
      className="fl-card"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
      style={{ ['--fl-to' as string]: to }}
    >
      <svg className="fl-shape" viewBox="0 0 72 56" aria-hidden="true">
        {shape && (
          <motion.path
            d={shape.d}
            initial={reduce ? { fill: to } : { fill: from }}
            animate={{ fill: to }}
            transition={{ duration: 1.1, delay: reduce ? 0 : 0.4 + Math.min(i, 12) * 0.03 }}
            stroke="var(--bg)"
            strokeWidth={0.6}
          />
        )}
      </svg>
      <div className="fl-cbody">
        <div className="fl-ctop">
          <b>{r.label}</b>
          <span className="fl-swap mono">
            <i style={{ background: from }}>{pshort(r.before)}</i>→<i style={{ background: to }}>{pshort(w.party)}</i>
          </span>
        </div>
        <div className="fl-cwin">
          {w.name} <span className="muted">{w.pct.toFixed(1)}%</span>
        </div>
        <div className="fl-cmeta mono">
          {second ? `def. ${second.name}${second.incumbent ? ' (inc.)' : ''} ${second.pct.toFixed(1)}%` : ''}
          {r.calledAt ? ` · called ${fmtTime(r.calledAt)}` : ''}
        </div>
      </div>
    </motion.article>
  );
}
