import { useEffect, useMemo, useRef, useState } from 'react';
import { m, useAnimationControls } from 'framer-motion';
import type { Action, ApplyResult, BlocStance, GameState, PartyId, Stance, VoteTally } from '../engine/types';
import { canDo, groupGlyph, lawById, MAJORITY, partiesLeftToRight, partyColor, partyName, SEATS_TOTAL } from './adapter';
import { Delta, Hemicycle } from './visuals';
import { safeForecast } from './game';
import { haptic, sfx } from '../audio';

const VOTE_COLOR: Record<BlocStance, string> = { yes: 'var(--ok)', no: 'var(--danger)', abstain: 'var(--text-4)' };

/** Expand a tally into per-seat votes in hemicycle (party left-to-right) order. */
function seatVotes(s: GameState, t: VoteTally): { party: PartyId; vote: BlocStance }[] {
  const order = partiesLeftToRight(s);
  const byParty: Record<string, BlocStance[]> = {};
  if (t.rollCall?.length) for (const r of t.rollCall) (byParty[r.party] ??= []).push(r.vote);
  else for (const b of t.blocs) byParty[b.party] = [...Array(b.yes).fill('yes'), ...Array(b.abstain).fill('abstain'), ...Array(b.no).fill('no')];
  const out: { party: PartyId; vote: BlocStance }[] = [];
  for (const p of order) for (const v of byParty[p] ?? []) out.push({ party: p, vote: v });
  return out;
}

export function VoteScreen({ s, itemId, rm, act, onClose, onPassed }: {
  s: GameState; itemId: string; rm: boolean; act: (a: Action) => ApplyResult | null; onClose: () => void; onPassed: (proposer: PartyId) => void;
}) {
  const item = s.docket.find((d) => d.id === itemId);
  const [result, setResult] = useState<VoteTally | null>(null);
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  const shake = useAnimationControls();
  const law = lawById(item?.lawId ?? result?.lawId ?? '');
  const forecast = item ? safeForecast(s, item.id) : null;
  const tally = result ?? forecast;
  const seats = useMemo(() => (tally ? seatVotes(s, tally) : []), [tally, s]);
  const timer = useRef<number>();

  useEffect(() => () => window.clearInterval(timer.current), []);

  const call = () => {
    if (!item) return;
    sfx.gavel();
    const r = act({ type: 'callVote', itemId: item.id });
    if (!r) return;
    const rec = [...r.state.votes].reverse().find((v) => v.tally.itemId === item.id);
    if (!rec) { onClose(); return; }
    setResult(rec.tally);
    const finish = () => {
      setDone(true); haptic(10);
      if (rec.tally.passes) { sfx.passed(); onPassed(rec.proposer); }
      else { sfx.failed(); if (!rm) void shake.start({ x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.5 } }); }
    };
    if (rm) { setShown(SEATS_TOTAL); finish(); return; }
    const total = seatVotes(r.state, rec.tally);
    let i = 0;
    timer.current = window.setInterval(() => {
      i = Math.min(total.length, i + 1);
      setShown(i);
      const v = total[i - 1]?.vote;
      if (v && v !== 'abstain') sfx.tick(v === 'yes');
      if (i >= total.length) { window.clearInterval(timer.current); window.setTimeout(finish, 250); }
    }, 32);
  };

  if (!tally || !law) return <div className="q-vote"><p>This bill is no longer on the docket.</p><button className="btn" onClick={onClose}>Back</button></div>;

  const live = result ? seats.slice(0, shown) : seats;
  const cnt = { yes: 0, no: 0, abstain: 0 } as Record<BlocStance, number>;
  for (const v of live) cnt[v.vote]++;
  const colors = Array.from({ length: SEATS_TOTAL }, (_, i) => {
    const v = seats[i]; if (!v) return null;
    if (result && i >= shown) return 'var(--bg-3)';
    return VOTE_COLOR[v.vote];
  });
  const need = tally.threshold;
  const setStance = (st: Stance) => { if (item) { sfx.click(); act({ type: 'setStance', itemId: item.id, stance: st }); } };

  return (
    <m.div className="q-vote" animate={shake}>
      <header className="q-vote__head">
        <p className="q-kicker">{item?.kind === 'repeal' || result?.kind === 'repeal' ? 'Repeal bill' : 'Bill'} · proposed by {partyName(s, item?.proposer ?? 'player')}</p>
        <h2 className="q-vote__t">{law.name}</h2>
        <p className="q-small q-muted">{law.desc}</p>
        <div className="q-effects">{Object.entries(law.groupEffects).map(([g, n]) => <span key={g}>{groupGlyph(g)} <Delta n={(item?.kind ?? result?.kind) === 'repeal' ? -n : n} /></span>)}</div>
      </header>

      <div className="q-vote__chamber">
        <Hemicycle colors={colors} rm label={`Roll call: ${cnt.yes} yes, ${cnt.no} no, ${cnt.abstain} abstain`}
          center={<div className="q-tallynum" aria-live="polite"><b className="q-num is-yes">{cnt.yes}</b><span>–</span><b className="q-num is-no">{cnt.no}</b></div>} />
        {done && result && (
          <m.div className={`q-stamp ${result.passes ? 'is-pass' : 'is-fail'}`} role="status"
            initial={rm ? false : { scale: 2.4, rotate: -24, opacity: 0 }} animate={{ scale: 1, rotate: -8, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 18 }}>{result.passes ? 'PASSED' : 'FAILED'}</m.div>
        )}
      </div>

      <div className="q-tally" role="img" aria-label={`${result ? 'Result' : 'Forecast'}: ${cnt.yes} yes, ${cnt.no} no, ${cnt.abstain} abstain. Needs ${need} yes and more yes than no.`}>
        <span className="q-tally__yes" style={{ width: `${(cnt.yes / SEATS_TOTAL) * 100}%` }} />
        <span className="q-tally__abs" style={{ width: `${(cnt.abstain / SEATS_TOTAL) * 100}%` }} />
        <span className="q-tally__no" style={{ width: `${(cnt.no / SEATS_TOTAL) * 100}%` }} />
        <span className="q-tally__line" style={{ left: `${(need / SEATS_TOTAL) * 100}%` }}><small>{need}</small></span>
        <span className="q-tally__line is-maj" style={{ left: `${(MAJORITY / SEATS_TOTAL) * 100}%` }}><small>{MAJORITY}</small></span>
      </div>
      <p className="q-small q-muted q-tally__lbl">{result ? 'Roll call' : 'Forecast (no dice)'}: <b className="q-num">{cnt.yes} YES · {cnt.no} NO · {cnt.abstain} ABST</b> · needs {need} YES and YES &gt; NO</p>

      {!result && item && (
        <>
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
              return (
                <li key={b.party} className="q-bloc">
                  <span className="q-dot q-dot--lg" style={{ background: partyColor(s, b.party) }} />
                  <span className="q-bloc__t"><b>{partyName(s, b.party)}</b>
                    <small className="q-muted">{b.seats} seats · support {b.support.toFixed(2)} {b.support >= 0.55 ? '≥ 0.55' : b.support <= 0.35 ? '≤ 0.35' : '(wavering)'}{b.defectors ? ` · ~${b.defectors} defect` : ''}{b.rebels ? ` · ${b.rebels} rebels` : ''}{b.whipped ? ' · whipped' : ''}</small></span>
                  <span className={`q-stance is-${b.stance}`}>{b.stance.toUpperCase()}</span>
                  {canWhip && <button className="btn q-btn-sm" disabled={!wp.valid} title={wp.reason} onClick={() => { sfx.click(); act(wa); }}>Whip · 1 PC</button>}
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
      {result && (
        <div className="q-vote__btns">
          <button className="btn btn--accent q-btn-lg" onClick={onClose} disabled={!done} data-autofocus>{done ? 'Back to the chamber' : 'Counting…'}</button>
        </div>
      )}
    </m.div>
  );
}
