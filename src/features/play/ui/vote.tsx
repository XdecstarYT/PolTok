import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { m, useAnimationControls } from 'framer-motion';
import type { Action, ApplyResult, BlocStance, GameState, PartyId, Stance, VoteTally } from '../engine/types';
import { canDo, groupGlyph, groupName, lawById, MAJORITY, partiesLeftToRight, partyColor, partyName, rivalDef, SEATS_TOTAL, signed } from './adapter';
import { Delta, Hemicycle, type SeatView } from './visuals';
import { safeForecast, leaderSeed } from './game';
import { Num, Tip, tip } from './fx';
import { Portrait } from './portrait';
import { haptic, music, sfx } from '../audio';

const VOTE_COLOR: Record<BlocStance, string> = { yes: 'var(--q-yes)', no: 'var(--q-no)', abstain: 'var(--q-abs)' };
const VOTE_WORD: Record<BlocStance, string> = { yes: 'YES', no: 'NO', abstain: 'ABSTAIN' };

/** Per-seat votes in hemicycle order; within each party YES, ABSTAIN, NO so a forecast and a result line up seat by seat. */
function seatVotes(s: GameState, t: VoteTally): { party: PartyId; vote: BlocStance }[] {
  const cnt: Record<string, Record<BlocStance, number>> = {};
  if (t.rollCall?.length) for (const r of t.rollCall) { const c = (cnt[r.party] ??= { yes: 0, no: 0, abstain: 0 }); c[r.vote]++; }
  else for (const b of t.blocs) cnt[b.party] = { yes: b.yes, no: b.no, abstain: b.abstain };
  const out: { party: PartyId; vote: BlocStance }[] = [];
  for (const p of partiesLeftToRight(s)) {
    const c = cnt[p]; if (!c) continue;
    (['yes', 'abstain', 'no'] as BlocStance[]).forEach((v) => { for (let i = 0; i < c[v]; i++) out.push({ party: p, vote: v }); });
  }
  return out;
}

interface Swing { party: PartyId; from: BlocStance; to: BlocStance; n: number }
function swings(fc: { party: PartyId; vote: BlocStance }[], res: { party: PartyId; vote: BlocStance }[]): { idx: Set<number>; list: Swing[] } {
  const idx = new Set<number>(); const agg: Record<string, Swing> = {};
  res.forEach((r, i) => {
    const f = fc[i];
    if (f && f.party === r.party && f.vote !== r.vote) {
      idx.add(i);
      const k = `${r.party}|${f.vote}|${r.vote}`;
      (agg[k] ??= { party: r.party, from: f.vote, to: r.vote, n: 0 }).n++;
    }
  });
  return { idx, list: Object.values(agg) };
}

export function VoteScreen({ s, itemId, rm, act, onClose, onPassed, amendSlot, wingNote }: {
  s: GameState; itemId: string; rm: boolean; act: (a: Action) => ApplyResult | null; onClose: () => void; onPassed: (proposer: PartyId) => void;
  amendSlot?: ReactNode; wingNote?: (b: VoteTally['blocs'][number]) => ReactNode;
}) {
  const item = s.docket.find((d) => d.id === itemId);
  const [result, setResult] = useState<{ tally: VoteTally; proposer: PartyId; fc: { party: PartyId; vote: BlocStance }[] } | null>(null);
  const [shown, setShown] = useState(0);
  const [stage, setStage] = useState<'pre' | 'call' | 'count' | 'done'>('pre');
  const shake = useAnimationControls();
  const law = lawById(item?.lawId ?? result?.tally.lawId ?? '');
  const forecast = item ? safeForecast(s, item.id) : null;
  const tally = result?.tally ?? forecast;
  const seats = useMemo(() => (tally ? seatVotes(s, tally) : []), [tally, s]);
  const sw = useMemo(() => (result ? swings(result.fc, seats) : { idx: new Set<number>(), list: [] }), [result, seats]);
  const timer = useRef<number>();
  const finished = useRef(false);
  const finishRef = useRef<() => void>(() => {});
  const kind = item?.kind ?? result?.tally.kind;

  useEffect(() => { music.setTension(0.45); return () => { window.clearTimeout(timer.current); music.setTension(0); }; }, []);

  const call = () => {
    if (!item || !forecast) return;
    const fc = seatVotes(s, forecast);
    sfx.gavel();
    const r = act({ type: 'callVote', itemId: item.id });
    if (!r) return;
    const rec = [...r.state.votes].reverse().find((v) => v.tally.itemId === item.id);
    if (!rec) { onClose(); return; }
    setResult({ tally: rec.tally, proposer: rec.proposer, fc });
    const finish = () => {
      if (finished.current) return; finished.current = true;
      window.clearTimeout(timer.current);
      setShown(SEATS_TOTAL); setStage('done'); haptic(14); music.setTension(0.1);
      if (rec.tally.passes) { sfx.passed(); onPassed(rec.proposer); }
      else { sfx.failed(); if (!rm) void shake.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.5 } }); }
    };
    finishRef.current = finish;
    if (rm) { setShown(SEATS_TOTAL); finish(); return; }
    setStage('call'); music.setTension(0.8);
    const total = seatVotes(r.state, rec.tally);
    const swingIdx = swings(fc, total).idx;
    let i = 0;
    const step = () => {
      i = Math.min(total.length, i + 1);
      setShown(i);
      const v = total[i - 1]?.vote;
      if (swingIdx.has(i - 1)) { sfx.flip(); haptic(6); } else if (v && v !== 'abstain') sfx.tick(v === 'yes');
      if (i >= total.length) { music.setTension(1); timer.current = window.setTimeout(finish, 420); return; }
      const k = i / total.length;
      timer.current = window.setTimeout(step, (swingIdx.has(i - 1) ? 220 : 0) + 22 + 70 * Math.pow(1 - k, 2));
    };
    timer.current = window.setTimeout(() => { setStage('count'); music.setTension(0.95); step(); }, 700);
  };

  // watchdog: once every seat has been called, always land on the result even if a timer was dropped
  useEffect(() => {
    if (!result || stage === 'done' || shown < seats.length) return;
    const t = window.setTimeout(() => finishRef.current(), 900);
    return () => window.clearTimeout(t);
  }, [result, stage, shown, seats.length]);

  if (!tally || !law) return <div className="q-vote"><p>This bill is no longer on the docket.</p><button className="btn" onClick={onClose}>Back</button></div>;

  const counting = !!result;
  const live = counting ? seats.slice(0, shown) : seats;
  const cnt = { yes: 0, no: 0, abstain: 0 } as Record<BlocStance, number>;
  for (const v of live) cnt[v.vote]++;
  const view: SeatView[] = Array.from({ length: SEATS_TOTAL }, (_, i) => {
    const v = seats[i]; if (!v) return { color: null };
    if (counting && i >= shown) return { color: stage === 'call' ? 'var(--q-seat-wait)' : result!.fc[i] ? VOTE_COLOR[result!.fc[i].vote] : null, dim: true };
    const flip = counting && sw.idx.has(i);
    return { color: VOTE_COLOR[v.vote], flip, ring: flip ? 'var(--q-swing)' : partyColor(s, v.party) };
  });
  const need = tally.threshold;
  const setStance = (st: Stance) => { if (item) { sfx.click(); act({ type: 'setStance', itemId: item.id, stance: st }); } };
  const yesPct = (cnt.yes / SEATS_TOTAL) * 100, noPct = (cnt.no / SEATS_TOTAL) * 100, absPct = (cnt.abstain / SEATS_TOTAL) * 100;
  const reached = cnt.yes >= need && cnt.yes > cnt.no;
  const seatTip = (i: number) => {
    const v = seats[i]; if (!v) return 'Vacant';
    const f = result?.fc[i];
    return <span className="q-tip__body"><span className="q-tip__row"><i className="q-dot" style={{ background: partyColor(s, v.party) }} /> <b>{partyName(s, v.party)}</b></span>
      {counting && i >= shown ? <span className="q-tip__row">Not yet called</span> : <span className="q-tip__row">{counting ? 'Voted' : 'Expected'} <b>{VOTE_WORD[v.vote]}</b></span>}
      {f && sw.idx.has(i) && i < shown && <span className="q-tip__row q-swingtxt">Swing seat: forecast {VOTE_WORD[f.vote]}</span>}</span>;
  };

  return (
    <m.div className={`q-vote is-${stage}`} animate={shake}>
      <header className="q-vote__head">
        <p className="q-kicker">{kind === 'repeal' ? 'Repeal bill' : 'Bill'} · proposed by {partyName(s, item?.proposer ?? result?.proposer ?? 'player')}{item?.amendment ? ` · amended` : ''}</p>
        <h2 className="q-vote__t">{law.name}</h2>
        {!counting && <p className="q-small q-muted">{law.desc}</p>}
        <div className="q-effects">{Object.entries(law.groupEffects).map(([g, n]) => <Tip key={g} content={`${groupName(g)} ${signed(kind === 'repeal' ? -n : n)} if it passes`}>{groupGlyph(g)} <Delta n={kind === 'repeal' ? -n : n} /></Tip>)}</div>
      </header>

      <div className="q-vote__chamber">
        {stage === 'call' && <m.div className="q-vote__banner" initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 1, scale: 1 }}>Order! The Speaker calls the roll.</m.div>}
        <Hemicycle seats={view} rm label={`${counting ? 'Roll call' : 'Forecast'}: ${cnt.yes} yes, ${cnt.no} no, ${cnt.abstain} abstain`} seatTip={seatTip}
          center={<div className="q-tallynum" aria-live="polite"><b className="is-yes"><Num value={cnt.yes} rm dur={0} /></b><span>–</span><b className="is-no"><Num value={cnt.no} rm dur={0} /></b></div>} />
        {stage === 'done' && result && (
          <m.div className={`q-stamp ${result.tally.passes ? 'is-pass' : 'is-fail'}`} role="status"
            initial={rm ? false : { scale: 2.6, rotate: -24, opacity: 0 }} animate={{ scale: 1, rotate: -8, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 18 }}>{result.tally.passes ? 'PASSED' : 'FAILED'}</m.div>
        )}
      </div>

      <div className={`q-tally${reached ? ' is-reached' : ''}`} role="img" aria-label={`${counting ? 'Result' : 'Forecast'}: ${cnt.yes} yes, ${cnt.no} no, ${cnt.abstain} abstain. Needs ${need} yes and more yes than no.`}>
        <span className="q-tally__yes" style={{ width: `${yesPct}%` }} />
        <span className="q-tally__abs" style={{ left: `${yesPct}%`, width: `${absPct}%` }} />
        <span className="q-tally__no" style={{ width: `${noPct}%` }} />
        <span className="q-tally__line" style={{ left: `${(need / SEATS_TOTAL) * 100}%` }} {...tip(`${need} YES votes needed${need > 25 ? ' (entrenched law: supermajority)' : ' (quorum)'}`)}><small>{need}</small></span>
        <span className="q-tally__line is-maj" style={{ left: `${(MAJORITY / SEATS_TOTAL) * 100}%` }} {...tip(`${MAJORITY}: an absolute majority of the chamber`)}><small>{MAJORITY}</small></span>
      </div>
      <p className="q-small q-muted q-tally__lbl">{counting ? 'Roll call' : 'Forecast (no dice yet)'}: <b className="q-num">{cnt.yes} YES · {cnt.no} NO · {cnt.abstain} ABST</b> · needs {need} YES and YES &gt; NO</p>

      {counting && sw.list.length > 0 && (
        <div className="q-swings" aria-live="polite">
          <span className="q-label">Swing seats</span>
          {sw.list.map((x, i) => (shown >= SEATS_TOTAL || stage === 'done') && (
            <span key={i} className="q-pill"><i className="q-dot" style={{ background: partyColor(s, x.party) }} /> {x.n} {partyName(s, x.party)} {x.from.toUpperCase()} → <b style={{ color: VOTE_COLOR[x.to] }}>{x.to.toUpperCase()}</b></span>
          ))}
        </div>
      )}
      {stage === 'done' && result && sw.list.length === 0 && <p className="q-small q-muted">Every seat voted as forecast.</p>}

      {!counting && item && (
        <>
          {amendSlot}
          <div className="q-label" id="q-stance">Your bloc votes</div>
          <div className="q-seg" role="radiogroup" aria-labelledby="q-stance">
            {(['yes', 'abstain', 'no'] as Stance[]).map((st) => (
              <button key={st} role="radio" aria-checked={item.playerStance === st} className={`q-seg__b is-${st}${item.playerStance === st ? ' is-on' : ''}`} onClick={() => setStance(st)}>{st.toUpperCase()}</button>
            ))}
          </div>
          <ul className="q-blocs" data-coach="whip" aria-label="Party blocs">
            {tally.blocs.map((b) => {
              const wa: Action = { type: 'whip', itemId: item.id, party: b.party };
              const wp = canDo(s, wa);
              const canWhip = !b.whipped && (b.stance === 'abstain' || (b.party === 'player' && b.rebels > 0));
              const r = b.party === 'player' ? null : rivalDef(b.party);
              return (
                <li key={b.party} className={`q-bloc is-${b.stance}`}>
                  <Portrait seed={b.party === 'player' ? leaderSeed(s) : r?.leader ?? b.party} color={partyColor(s, b.party)} size={40} />
                  <span className="q-bloc__t"><b>{partyName(s, b.party)}</b>
                    <small className="q-muted">{b.seats} seats{b.defectors ? ` · ~${b.defectors} defect` : ''}{b.rebels ? ` · ${b.rebels} rebels` : ''}{b.whipped ? ' · whipped' : ''}</small>
                    {b.party !== 'player' && (
                      <span className="q-support" {...tip(`Support ${b.supportPct}%. YES at 55% or more, NO at 35% or less, otherwise they abstain.`)}>
                        <span className="q-support__fill" style={{ width: `${b.supportPct}%`, background: VOTE_COLOR[b.stance] }} /><i style={{ left: '35%' }} /><i style={{ left: '55%' }} />
                      </span>
                    )}
                    {wingNote?.(b)}
                  </span>
                  <span className={`q-stance is-${b.stance}`}>{b.stance.toUpperCase()}</span>
                  {canWhip && <button className="btn q-btn-sm" disabled={!wp.valid} {...tip(wp.valid ? (b.party === 'player' ? 'Bring your rebels into line' : 'Turn this wavering bloc to YES') : wp.reason ?? '')} onClick={() => { sfx.click(); act(wa); }}>Whip · 1 PC</button>}
                </li>
              );
            })}
          </ul>
          <div className="q-vote__btns">
            <button className="btn q-btn-ghost q-btn-lg" onClick={onClose}>Later</button>
            <button className="btn btn--accent q-btn-lg" onClick={call} data-autofocus>Call the Vote</button>
          </div>
        </>
      )}
      {counting && (
        <div className="q-vote__btns">
          {stage !== 'done' && <button className="btn q-btn-ghost q-btn-lg" onClick={() => finishRef.current()}>Skip</button>}
          <button className="btn btn--accent q-btn-lg" onClick={onClose} disabled={stage !== 'done'} data-autofocus>{stage === 'done' ? 'Back to the chamber' : 'Counting…'}</button>
        </div>
      )}
    </m.div>
  );
}

