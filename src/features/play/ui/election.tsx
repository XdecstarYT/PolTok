import { useEffect, useMemo, useState } from 'react';
import { m } from 'framer-motion';
import type { Action, ElectionResult, GameState, PartyId, RegionId, RivalId } from '../engine/types';
import { api, CONTENT, dhondt, MAJORITY, partiesLeftToRight, partyColor, partyName, regionName, regionSharesNow, RELATION_LABEL, rivalDef, SEATS_TOTAL, yearOf } from './adapter';
import { Hemicycle } from './visuals';
import { MapView } from '../world';
import { Num, tip } from './fx';
import { Portrait } from './portrait';
import { music, sfx, startBed, stopBed } from '../audio';

function Swingometer({ swing, label, rm }: { swing: number; label: string; rm: boolean }) {
  const max = 12;
  const v = Math.max(-max, Math.min(max, swing));
  const ang = (v / max) * 80;
  return (
    <div className="q-swing" role="meter" aria-valuemin={-max} aria-valuemax={max} aria-valuenow={Math.round(swing * 10) / 10} aria-label={label}
      {...tip(<span className="q-tip__body"><b>Swingometer</b><span className="q-tip__row">{label}</span><span className="q-tip__row">Change in your vote share in the regions declared so far, against the same regions last time.</span></span>)}>
      <svg viewBox="-60 -56 120 66" aria-hidden="true">
        <path d="M-50,0 A50,50 0 0 1 0,-50 L0,-36 A36,36 0 0 0 -36,0 Z" className="q-swing__neg" />
        <path d="M0,-50 A50,50 0 0 1 50,0 L36,0 A36,36 0 0 0 0,-36 Z" className="q-swing__pos" />
        {Array.from({ length: 13 }, (_, i) => { const a = ((i * 160) / 12 - 80) * (Math.PI / 180); const r1 = 50, r2 = i % 3 === 0 ? 42 : 46; return <line key={i} x1={Math.sin(a) * r1} y1={-Math.cos(a) * r1} x2={Math.sin(a) * r2} y2={-Math.cos(a) * r2} className="q-swing__tick" />; })}
        <g className="q-swing__arm" style={{ transform: `rotate(${ang}deg)`, transition: rm ? 'none' : undefined }}>
          <path d="M-2.4,0 L0,-47 L2.4,0 Z" className="q-swing__needle" />
        </g>
        <circle r="5" className="q-swing__hub" />
        <text x="-48" y="9" className="q-swing__lbl">−{max}</text><text x="48" y="9" className="q-swing__lbl" textAnchor="end">+{max}</text>
      </svg>
      <b className={`q-num q-swing__v ${swing > 0.05 ? 'q-ok' : swing < -0.05 ? 'q-warn' : ''}`}>{swing > 0 ? '+' : ''}{swing.toFixed(1)}%</b>
      <small className="q-muted">swing to you</small>
    </div>
  );
}

export function ElectionNight({ s, result, rm, onDone, onMajority }: {
  s: GameState; result: ElectionResult; rm: boolean; onDone: () => void; onMajority: (color: string) => void;
}) {
  const n = result.regions.length;
  const [k, setK] = useState(rm ? n : 0);
  useEffect(() => {
    if (rm) return;
    startBed(); music.setTension(0.7);
    let x = 0;
    const iv = window.setInterval(() => { x = Math.min(n, x + 1); setK(x); sfx.ballot(); if (x >= n) window.clearInterval(iv); }, 1050);
    return () => { window.clearInterval(iv); stopBed(); music.setTension(0); };
  }, [rm, n]);
  const done = k >= n;
  useEffect(() => { if (done) { stopBed(); music.setTension(0.15); } }, [done]);
  const parties = partiesLeftToRight(s);
  const idx = s.elections.findIndex((e) => e.turn === result.turn);
  const prev = idx > 0 ? s.elections[idx - 1] : null;
  const running: Record<string, number> = {};
  const flash: Record<RegionId, string> = {};
  const declared = result.regions.slice(0, k);
  declared.forEach((r) => {
    for (const [p, v] of Object.entries(r.seats)) running[p] = (running[p] ?? 0) + v;
    const lead = Object.entries(r.seats).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (lead) flash[r.regionId] = partyColor(s, lead);
  });
  // live projection: declared seats + a no-noise projection of the regions still counting
  const projection = useMemo(() => {
    const out: Record<string, number> = { ...running };
    for (const r of result.regions.slice(k)) {
      let rs: Record<string, number>;
      try { rs = dhondt(regionSharesNow(s, r.regionId), CONTENT.regions.find((x) => x.id === r.regionId)?.seats ?? 0); } catch { rs = {}; }
      for (const [p, v] of Object.entries(rs)) out[p] = (out[p] ?? 0) + v;
    }
    return out;
  }, [k]); // eslint-disable-line react-hooks/exhaustive-deps
  // swing in the declared regions vs the previous election (or vs an even split at the founding)
  let swing = 0;
  if (declared.length) {
    let now = 0, before = 0, w = 0;
    for (const r of declared) {
      const seatsN = CONTENT.regions.find((x) => x.id === r.regionId)?.seats ?? 1;
      now += (r.share.player ?? 0) * seatsN; w += seatsN;
      const pr = prev?.regions.find((x) => x.regionId === r.regionId);
      before += (pr ? pr.share.player ?? 0 : 1 / parties.length) * seatsN;
    }
    swing = ((now - before) / w) * 100;
  }
  const hit = (running.player ?? 0) >= MAJORITY;
  useEffect(() => { if (hit) { sfx.cheer(); onMajority(s.player.color); } }, [hit]); // eslint-disable-line react-hooks/exhaustive-deps
  const seatColors: (string | null)[] = [];
  const seatParty: string[] = [];
  for (const p of parties) for (let i = 0; i < (running[p] ?? 0); i++) { seatColors.push(partyColor(s, p)); seatParty.push(p); }
  while (seatColors.length < SEATS_TOTAL) { seatColors.push(null); seatParty.push(''); }
  const latest = result.regions[k - 1];
  const sorted = [...parties].sort((a, b) => (projection[b] ?? 0) - (projection[a] ?? 0));
  const projTotal = Object.values(projection).reduce((a, b) => a + b, 0) || SEATS_TOTAL;
  return (
    <div className="q-elec">
      <header className="q-elec__head">
        <span className="q-elec__live">{done ? 'Final' : 'Live'}</span>
        <p className="q-kicker q-elec__kick">Election night · {yearOf(result.turn || 1)}{result.turn === 0 ? ' · Founding Assembly' : ''}</p>
        <span className="q-num q-muted q-small">{k}/{n} declared</span>
      </header>
      <div className="q-elec__ticker" aria-live="polite">{latest ? <><b>{regionName(latest.regionId)}</b> declares: {Object.entries(latest.seats).filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([p, v]) => `${partyName(s, p)} ${v}`).join(' · ')}</> : 'Polls have closed. Counting begins…'}</div>
      <div className="q-elec__grid">
        <div className="q-elec__mapwrap">
          <MapView night s={{ ...s, elections: [], campaign: {} as GameState['campaign'] }} flash={flash} pulse={latest?.regionId ?? null} compact
            info={(id) => { const r = declared.find((x) => x.regionId === id); return r ? <span className="q-tip__row">Declared: {Object.entries(r.seats).filter(([, v]) => v).map(([p, v]) => `${partyName(s, p).split(' ')[0]} ${v}`).join(', ')}</span> : <span className="q-tip__row q-muted">Still counting</span>; }} />
        </div>
        <div className="q-elec__side">
          <Hemicycle colors={seatColors} rm={rm} seatTip={(i) => seatParty[i] ? <span><i className="q-dot" style={{ background: partyColor(s, seatParty[i]) }} /> {partyName(s, seatParty[i])}</span> : 'Not yet declared'}
            label={`Seats so far: ${parties.map((p) => `${partyName(s, p)} ${running[p] ?? 0}`).join(', ')}`}
            center={<><b className="q-house__n"><Num value={running.player ?? 0} rm={rm} /></b><span className="q-hemi__sub">your seats</span></>} />
          <div className="q-proj" {...tip(<span className="q-tip__body"><b>Live projection</b><span className="q-tip__row">Declared seats plus a projection of the regions still counting.</span></span>)}>
            <div className="q-label">{done ? 'Final result' : 'Projected Assembly'}</div>
            <div className="q-proj__bar" role="img" aria-label={`Projection: ${sorted.map((p) => `${partyName(s, p)} ${projection[p] ?? 0}`).join(', ')}`}>
              {parties.map((p) => <m.span key={p} initial={false} animate={{ width: `${((projection[p] ?? 0) / projTotal) * 100}%` }} transition={{ duration: rm ? 0 : 0.6 }} style={{ background: partyColor(s, p) }} />)}
              <i style={{ left: `${(MAJORITY / SEATS_TOTAL) * 100}%` }} />
            </div>
          </div>
          <ul className="q-race">
            {sorted.map((p) => (
              <li key={p}>
                <span className="q-race__n"><i className="q-dot" style={{ background: partyColor(s, p) }} /> {partyName(s, p)}</span>
                <span className="q-race__track"><m.span className="q-race__bar" initial={false} animate={{ width: `${((running[p] ?? 0) / MAJORITY) * 100}%` }} transition={{ duration: rm ? 0 : 0.4 }} style={{ background: partyColor(s, p) }} /><i className="q-race__proj" style={{ left: `${Math.min(100, ((projection[p] ?? 0) / MAJORITY) * 100)}%` }} /></span>
                <b className="q-num"><Num value={running[p] ?? 0} rm={rm} /></b>
                <small className="q-muted q-num" {...tip(done ? `National vote share ${Math.round((result.share[p] ?? 0) * 100)}%` : `Projected ${projection[p] ?? 0} seats`)}>{done ? `${Math.round((result.share[p] ?? 0) * 100)}%` : `→${projection[p] ?? 0}`}</small>
              </li>
            ))}
          </ul>
          <Swingometer swing={swing} rm={rm} label={prev ? `${swing >= 0 ? '+' : ''}${swing.toFixed(1)} points against the last election` : `${swing >= 0 ? '+' : ''}${swing.toFixed(1)} points against an even split`} />
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
        <div className="q-coal__invite"><Portrait seed={rivalDef(pc.leader)?.leader ?? pc.leader} color={partyColor(s, pc.leader)} size={72} label={rivalDef(pc.leader)?.leader} />
        <h2>{partyName(s, pc.leader)} invites you into government</h2></div>
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
                <Portrait seed={r.leader} color={r.color} size={44} />
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
