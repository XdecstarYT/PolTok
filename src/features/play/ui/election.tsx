import { useEffect, useState } from 'react';
import { m } from 'framer-motion';
import type { Action, ElectionResult, GameState, PartyId, RegionId, RivalId } from '../engine/types';
import { api, CONTENT, MAJORITY, partiesLeftToRight, partyColor, partyName, regionName, RELATION_LABEL, SEATS_TOTAL } from './adapter';
import { Hemicycle, RegionMap } from './visuals';
import { sfx, startBed, stopBed } from '../audio';

export function ElectionNight({ s, result, rm, onDone, onMajority }: {
  s: GameState; result: ElectionResult; rm: boolean; onDone: () => void; onMajority: (color: string) => void;
}) {
  const n = result.regions.length;
  const [k, setK] = useState(rm ? n : 0);
  useEffect(() => {
    if (rm) return;
    startBed();
    const iv = window.setInterval(() => setK((x) => { if (x >= n) { window.clearInterval(iv); return x; } sfx.ballot(); return x + 1; }), 600);
    return () => { window.clearInterval(iv); stopBed(); };
  }, [rm, n]);
  const done = k >= n;
  useEffect(() => { if (done) { stopBed(); } }, [done]);
  const parties = partiesLeftToRight(s);
  const running: Record<string, number> = {};
  const flash: Record<RegionId, string> = {};
  result.regions.slice(0, k).forEach((r) => {
    for (const [p, v] of Object.entries(r.seats)) running[p] = (running[p] ?? 0) + v;
    const lead = Object.entries(r.seats).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (lead) flash[r.regionId] = partyColor(s, lead);
  });
  const hit = (running.player ?? 0) >= MAJORITY;
  useEffect(() => { if (hit) { sfx.cheer(); onMajority(s.player.color); } }, [hit]); // eslint-disable-line react-hooks/exhaustive-deps
  const seatColors: (string | null)[] = [];
  for (const p of parties) for (let i = 0; i < (running[p] ?? 0); i++) seatColors.push(partyColor(s, p));
  while (seatColors.length < SEATS_TOTAL) seatColors.push(null);
  const latest = result.regions[k - 1];
  const sorted = [...parties].sort((a, b) => (running[b] ?? 0) - (running[a] ?? 0));
  return (
    <div className="q-elec">
      <p className="q-kicker q-elec__kick">Election night · Turn {result.turn}</p>
      <div className="q-elec__ticker" aria-live="polite">{latest ? <><b>{regionName(latest.regionId)}</b> declares: {Object.entries(latest.seats).filter(([, v]) => v).map(([p, v]) => `${partyName(s, p)} ${v}`).join(' · ')}</> : 'Polls have closed. Counting begins…'}</div>
      <div className="q-elec__grid">
        <RegionMap s={{ ...s, elections: [] }} flash={flash} />
        <div>
          <Hemicycle colors={seatColors} rm={rm} label={`Seats so far: ${parties.map((p) => `${partyName(s, p)} ${running[p] ?? 0}`).join(', ')}`}
            center={<><b className="q-num q-house__n">{running.player ?? 0}</b><span className="q-small q-muted">your seats</span></>} />
          <ul className="q-race">
            {sorted.map((p) => (
              <li key={p}>
                <span className="q-race__n">{partyName(s, p)}</span>
                <span className="q-race__track"><m.span layout={!rm} className="q-race__bar" animate={{ width: `${((running[p] ?? 0) / SEATS_TOTAL) * 100 * 1.6}%` }} transition={{ duration: rm ? 0 : 0.4 }} style={{ background: partyColor(s, p) }} /></span>
                <b className="q-num">{running[p] ?? 0}</b>
                {done && <small className="q-muted q-num">{Math.round((result.share[p] ?? 0) * 100)}%</small>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {done && <p className="q-elec__gov" role="status">{govLine(s, result)}</p>}
      <div className="q-vote__btns">
        {!done && <button className="btn q-btn-ghost" onClick={() => setK(n)}>Skip count</button>}
        <button className="btn btn--accent q-btn-lg" disabled={!done} onClick={onDone} data-autofocus>{done ? 'Continue' : `Counting ${k}/${n}…`}</button>
      </div>
    </div>
  );
}

/** One line on what the count means for government formation. */
function govLine(s: GameState, result: ElectionResult): string {
  const top = Object.entries(result.seats).sort((a, b) => b[1] - a[1]);
  const [lp, ls] = top[0] ?? ['', 0];
  if (ls >= MAJORITY) return lp === 'player' ? `You win an outright majority: ${ls} seats.` : `${partyName(s, lp)} wins an outright majority (${ls} seats).`;
  if (s.phase === 'coalition' && s.pendingCoalition?.kind === 'offer') return `Hung Assembly. ${partyName(s, s.pendingCoalition.leader)} wants you in its government. Coalition talks next.`;
  if (s.phase === 'coalition') return `Hung Assembly: nobody has ${MAJORITY}. Coalition talks are yours to lead.`;
  const g = s.government;
  if (!g.leader) return '';
  const names = g.members.map((p) => partyName(s, p)).join(' + ');
  return g.members.length > 1 ? `Hung Assembly. Coalition formed: ${names}.` : `Hung Assembly. ${names} governs as a minority.`;
}

export function CoalitionBuilder({ s, act }: { s: GameState; act: (a: Action) => void }) {
  const pc = s.pendingCoalition;
  const [picked, setPicked] = useState<RivalId[]>([]);
  if (!pc) return null;
  if (pc.kind === 'offer') {
    return (
      <div className="q-coal">
        <p className="q-kicker">Government formation</p>
        <h2>{partyName(s, pc.leader)} invites you into government</h2>
        <p>Proposed coalition: {[pc.leader, ...pc.partners, 'player'].map((p) => <span key={p} className="q-pill"><span className="q-dot" style={{ background: partyColor(s, p) }} /> {partyName(s, p)} {s.seats[p] ?? 0}</span>)}</p>
        <p className="q-muted q-small">Joining gives you +0.25 support on government bills and counts as time in government. Their bills will expect your votes.</p>
        <div className="q-vote__btns">
          <button className="btn q-btn-ghost q-btn-lg" onClick={() => act({ type: 'answerOffer', accept: false })}>Stay in opposition</button>
          <button className="btn btn--accent q-btn-lg" onClick={() => act({ type: 'answerOffer', accept: true })} data-autofocus>Join the coalition</button>
        </div>
      </div>
    );
  }
  const seats = pc.seats;
  const total = (seats.player ?? 0) + picked.reduce((a, r) => a + (seats[r] ?? 0), 0);
  const terms = api.coalitionTerms(s);
  const fallback = api.fallbackGovernment(s);
  const passLabel = fallback[0] === 'player' ? 'Govern as minority' : fallback.length > 1 ? 'Pass (they take power)' : `Pass (${partyName(s, fallback[0])} governs)`;
  const passNote = fallback[0] === 'player'
    ? 'Governing as a minority means every bill must still find 37 votes on the floor.'
    : fallback.length > 1
      ? `If you pass, ${fallback.map((p) => partyName(s, p)).join(' and ')} will form a majority without you, and you go into opposition.`
      : `If you pass, ${partyName(s, fallback[0])} governs as a minority and you sit in opposition.`;
  const firstOk = terms.find((t) => t.accepts && t.seats)?.party;
  const lead = Object.entries(seats).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <div className="q-coal">
      <p className="q-kicker">Coalition talks</p>
      <h2>Reach {MAJORITY} seats to govern</h2>
      {lead && lead !== 'player' && <p className="q-small">{partyName(s, lead)} could not find a majority. You get the next try.</p>}
      <div className="q-coal__meter" role="meter" aria-valuemin={0} aria-valuemax={SEATS_TOTAL} aria-valuenow={total} aria-label={`Coalition seats ${total} of ${MAJORITY} needed`}>
        <span style={{ width: `${((seats.player ?? 0) / SEATS_TOTAL) * 100}%`, background: s.player.color }} />
        {picked.map((r) => <span key={r} style={{ width: `${((seats[r] ?? 0) / SEATS_TOTAL) * 100}%`, background: partyColor(s, r) }} />)}
        <i style={{ left: `${(MAJORITY / SEATS_TOTAL) * 100}%` }} />
      </div>
      <p className="q-num"><b>{total}</b> / {MAJORITY} {total >= MAJORITY ? <span className="q-ok">Majority!</span> : <span className="q-muted">short by {MAJORITY - total}</span>}</p>
      <ul className="q-list">
        {terms.map((t) => {
          const r = CONTENT.rivals.find((x) => x.id === t.party)!;
          const rel = s.rivals[t.party]?.relation ?? 0;
          const on = picked.includes(t.party);
          return (
            <li key={t.party}>
              <button className={`q-row${on ? ' is-on' : ''}`} aria-pressed={on} disabled={!t.accepts || !t.seats} {...(firstOk === t.party ? { 'data-autofocus': true } : {})} onClick={() => setPicked(on ? picked.filter((x) => x !== t.party) : [...picked, t.party])}>
                <span className="q-dot q-dot--lg" style={{ background: r.color }} />
                <span className="q-row__t"><b>{r.name}</b>
                  <small className={t.accepts ? 'q-ok' : 'q-warn'}>{RELATION_LABEL[rel]} · {t.accepts ? 'willing to join' : 'refuses'}</small>
                  <small className="q-muted">{t.reasons.join(' ')}</small></span>
                <b className="q-num q-row__v">{t.seats}</b>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="q-small q-muted">{passNote}</p>
      <div className="q-vote__btns">
        <button className="btn q-btn-ghost q-btn-lg" onClick={() => act({ type: 'formCoalition', partners: [] })} {...(firstOk ? {} : { 'data-autofocus': true })}>{passLabel}</button>
        <button className="btn btn--accent q-btn-lg" disabled={!picked.length || total < MAJORITY} onClick={() => act({ type: 'formCoalition', partners: picked })}>{picked.length && total < MAJORITY ? `Need ${MAJORITY - total} more` : 'Propose coalition'}</button>
      </div>
    </div>
  );
}

export type { PartyId };
