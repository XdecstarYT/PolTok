import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { Action, GameState, GroupId, LawDef, LogEntry, RegionId, RivalId } from '../engine/types';
import {
  api, approvalIndex, availableLaws, budgetOf, canDo, CONTENT, electionTurnsOf, eraDef, groupGlyph, groupName, inGovernment, lawById, MAJORITY, nextElectionIn,
  partiesLeftToRight, partyColor, partyName, projectSeats, RELATION_LABEL, rivalDef, seatList, signed, STAT_ICON, STAT_LABEL, STATS, suggestedLaw, totalTurns, yearOf,
} from './adapter';
import { Delta, Hemicycle } from './visuals';
import { CalderraMap, regionLeader } from './map';
import { Num, Tip, tip } from './fx';
import { Portrait } from './portrait';
import type { Advice } from './advisor';
import { WingChips } from './v2';

export type Sheet = null | { kind: 'map'; region?: RegionId } | { kind: 'court' } | { kind: 'laws'; tab?: 'draft' | 'repeal' } | { kind: 'lobby' };
export type View = 'chamber' | 'stats' | 'cabinet';

export const leaderSeed = (s: GameState) => `${s.player.name}·leader·${s.seed}`;

// ---------------------------------------------------------------- top bar

function TurnTrack({ s }: { s: GameState }) {
  const total = totalTurns(s);
  const elect = new Set(electionTurnsOf(s));
  return (
    <ol className="q-track" aria-label={`Turn ${s.turn} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const t = i + 1;
        const era = CONTENT.eras.find((e) => t >= e.turns[0] && t <= e.turns[1])?.id ?? 1;
        return (
          <li key={t} className={`q-track__t is-era${era}${t < s.turn ? ' is-past' : t === s.turn ? ' is-now' : ''}${elect.has(t) ? ' is-elect' : ''}`}
            {...tip(<span><b>Turn {t}</b> · {yearOf(t)}{elect.has(t) ? <><br />Election at the end of this turn</> : null}</span>)} />
        );
      })}
    </ol>
  );
}

export function TopBar({ s, rm, muted, onPause, onMute }: { s: GameState; rm: boolean; muted: boolean; onPause: () => void; onMute: () => void }) {
  const era = eraDef(s);
  const b = budgetOf(s);
  const ai = approvalIndex(s);
  const res: { k: string; icon: string; label: string; v: number; tipBody: ReactNode; cls?: string }[] = [
    { k: 'treasury', icon: '◉', label: 'Treasury', v: s.treasury, tipBody: <span className="q-tip__body"><b>Treasury {Math.round(s.treasury)}</b><span className="q-tip__row">Income <b className="q-num">+{b.income}</b> (40 + economy × 0.4)</span><span className="q-tip__row">Running costs <b className="q-num">−{b.baseExpenses}</b></span><span className="q-tip__row">Law upkeep <b className="q-num">{b.upkeep > 0 ? '−' : '+'}{Math.abs(b.upkeep)}</b></span>{b.timed ? <span className="q-tip__row">Temporary effects <b className="q-num">{signed(b.timed)}</b></span> : null}<span className="q-tip__row">Net per turn <b className={`q-num ${b.net >= 0 ? 'q-ok' : 'q-warn'}`}>{signed(b.net)}</b></span></span> },
    { k: 'debt', icon: '⛓', label: 'Debt', v: s.debt, cls: s.debt > 150 ? 'is-danger' : '', tipBody: <span className="q-tip__body"><b>Debt {Math.round(s.debt)}</b><span className="q-tip__row">Interest {Math.round(b.interestRate * 100)}% = <b className="q-num">{b.interest}</b> per turn</span><span className="q-tip__row">Over 150 drags the economy. 300 is bankruptcy.</span></span> },
    { k: 'pc', icon: '★', label: 'Political capital', v: s.politicalCapital, tipBody: <span className="q-tip__body"><b>Political Capital {s.politicalCapital}</b><span className="q-tip__row">Whip a bloc: 1 · Lobby a rival: 2</span><span className="q-tip__row">Maximum {s.mods?.maxPc ?? 8}</span></span> },
    { k: 'funds', icon: '❖', label: 'Party funds', v: s.partyFunds, tipBody: <span className="q-tip__body"><b>Party funds {Math.round(s.partyFunds)}</b><span className="q-tip__row">Pays for campaigns while in opposition. +0.5 per seat each turn.</span></span> },
    { k: 'approval', icon: '♥', label: 'Approval', v: ai, tipBody: <span className="q-tip__body"><b>National approval {Math.round(ai)}</b><span className="q-tip__row">Your approval across all groups, weighted by population.</span></span> },
  ];
  return (
    <header className="q-top" aria-label="Turn status">
      <div className="q-top__turn">
        <span className="q-top__year q-num">{yearOf(s.turn)}</span>
        <b className="q-top__tn">Turn <Num value={s.turn} rm={rm} /><span className="q-muted">/{totalTurns(s)}</span></b>
        <span className="q-top__era">{era.name}</span>
      </div>
      <dl className="q-top__res">
        {res.map((r) => (
          <div key={r.k} className={`q-res q-res--${r.k} ${r.cls ?? ''}`} tabIndex={0} {...tip(r.tipBody)}>
            <dt><span aria-hidden="true" className="q-res__ic">{r.icon}</span><span className="q-sr">{r.label}</span></dt>
            <dd><Num value={r.v} rm={rm} /></dd>
          </div>
        ))}
      </dl>
      <div className="q-ap" role="img" aria-label={`${s.ap} of 3 action points left`} data-coach="ap" {...tip(<span><b>{s.ap} Action Point{s.ap === 1 ? '' : 's'} left</b><br />Most actions cost 1. Unspent AP is lost at the end of the turn.</span>)}>
        {[0, 1, 2].map((i) => <span key={i} className={`q-ap__pip${i < s.ap ? ' is-on' : ''}`} />)}
      </div>
      <div className="q-top__btns">
        <button className="q-iconbtn" onClick={onMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>
        <button className="q-iconbtn" onClick={onPause} aria-label="Pause menu (Esc)">❚❚</button>
      </div>
      <TurnTrack s={s} />
    </header>
  );
}

// ---------------------------------------------------------------- view tabs

export function ViewTabs({ view, setView, tabs }: { view: View; setView: (v: View) => void; tabs: { id: View; label: string; badge?: string }[] }) {
  return (
    <nav className="q-views" role="tablist" aria-label="Game views">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={view === t.id} className={`q-view${view === t.id ? ' is-on' : ''}`} onClick={() => setView(t.id)}>
          {t.label}{t.badge ? <span className="q-view__badge">{t.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------- approval bars

export function ApprovalBars({ s, rm, compact }: { s: GameState; rm: boolean; compact?: boolean }) {
  const prev = useRef(s.approval);
  const [floats, setFloats] = useState<{ id: number; g: GroupId; n: number }[]>([]);
  useEffect(() => {
    const d = CONTENT.groups.map((g) => ({ g: g.id, n: Math.round((s.approval[g.id] ?? 0) - (prev.current[g.id] ?? 0)) })).filter((x) => x.n !== 0);
    prev.current = s.approval;
    if (!d.length || rm) return;
    const now = Date.now();
    setFloats((f) => [...f, ...d.map((x, i) => ({ id: now + i, ...x }))]);
    const t = window.setTimeout(() => setFloats((f) => f.filter((x) => x.id < now)), 1400);
    return () => window.clearTimeout(t);
  }, [s.approval, rm]);
  return (
    <ul className={`q-bars${compact ? ' is-compact' : ''}`} aria-label="Group approval of your party" data-coach="approval">
      {CONTENT.groups.map((g) => {
        const v = Math.round(s.approval[g.id] ?? 0);
        const tr = v - Math.round(s.approvalStart?.[g.id] ?? v);
        const sh = Math.round((s.shares?.[g.id] ?? g.share) * 100);
        const body = (
          <span className="q-tip__body"><b>{g.name}</b> · {sh}% of voters<span className="q-tip__row">Wants {g.wants}</span>
            <span className="q-tip__row"><i className="q-dot" style={{ background: s.player.color }} /> You <b className="q-num">{v}</b>{tr ? <> ({signed(tr)} this turn)</> : null}</span>
            {CONTENT.rivals.map((r) => <span key={r.id} className="q-tip__row"><i className="q-dot" style={{ background: r.color }} /> {r.name} <b className="q-num">{Math.round(s.rivals[r.id]?.approval[g.id] ?? 0)}</b></span>)}
            <span className="q-tip__row q-muted">Approval is squared at the polls: loyal groups matter most.</span></span>
        );
        return (
          <li key={g.id} className="q-bar" tabIndex={0} {...tip(body)}>
            <span className="q-bar__ic" aria-hidden="true">{groupGlyph(g.id)}</span>
            <span className="q-bar__name">{g.name}<small className="q-num">{sh}%</small></span>
            <span className="q-bar__track" aria-hidden="true">
              <m.span className="q-bar__fill" initial={false} animate={{ width: `${v}%` }} transition={{ duration: rm ? 0 : 0.5 }} style={{ background: s.player.color }} />
              <span className="q-bar__mid" />
            </span>
            <span className="q-bar__val" aria-label={`${g.name} approval ${v}${tr ? `, ${tr > 0 ? 'up' : 'down'} ${Math.abs(tr)} this turn` : ''}`}>
              <Num value={v} rm={rm} /><span className={`q-trend ${tr > 0 ? 'is-up' : tr < 0 ? 'is-down' : ''}`} aria-hidden="true">{tr > 0 ? '▲' : tr < 0 ? '▼' : '·'}</span>
            </span>
            <AnimatePresence>
              {floats.filter((f) => f.g === g.id).map((f) => (
                <m.span key={f.id} className={`q-float ${f.n > 0 ? 'is-up' : 'is-down'}`} aria-hidden="true"
                  initial={{ y: 0, opacity: 1 }} animate={{ y: -22, opacity: 0 }} transition={{ duration: 1.2 }}>{signed(f.n)}</m.span>
              ))}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}

const STAT_BLURB: Record<string, string> = {
  economy: 'Drives income: +0.4 treasury per point.', order: 'Public safety and the courts.', liberty: 'Civil rights and a free press.',
  environment: 'Air, water and the Greenward.', health: 'Hospitals, pensions and long lives.',
};
export function StatChips({ s, rm }: { s: GameState; rm: boolean }) {
  return (
    <ul className="q-stats" aria-label="National stats">
      {STATS.map((k) => {
        const v = Math.round(s.stats[k]);
        return (
          <li key={k} className={v < 40 ? 'is-low' : v > 70 ? 'is-high' : ''} tabIndex={0}
            {...tip(<span className="q-tip__body"><b>{STAT_LABEL[k]} {v}/100</b><span className="q-tip__row">{STAT_BLURB[k]}</span><span className="q-tip__row">Drifts 1 per turn toward 50. At 0 for long, the nation collapses.</span></span>)}>
            <span aria-hidden="true" className="q-stats__ic">{STAT_ICON[k]}</span><span className="q-stats__k">{k === 'environment' ? 'Environ.' : STAT_LABEL[k]}</span>
            <b><Num value={v} rm={rm} /></b>
            <span className="q-stats__bar" aria-hidden="true"><span style={{ width: `${v}%` }} /></span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- chamber

export function seatTipFor(s: GameState, list: string[]) {
  return (i: number) => {
    const p = list[i];
    if (!p) return <span>Vacant seat</span>;
    const idx = list.slice(0, i + 1).filter((x) => x === p).length;
    return <span className="q-tip__body"><span className="q-tip__row"><i className="q-dot" style={{ background: partyColor(s, p) }} /> <b>{partyName(s, p)}</b></span>
      <span className="q-tip__row">Seat {idx} of {s.seats[p] ?? 0} · chamber seat {i + 1}/72</span>
      {p !== 'player' && <span className="q-tip__row">Relation: {RELATION_LABEL[s.rivals[p]?.relation ?? 0]}</span>}</span>;
  };
}

function Chamber({ s, rm }: { s: GameState; rm: boolean }) {
  const list = seatList(s);
  const colors = list.map((p) => (p ? partyColor(s, p) : null));
  const gov = s.government;
  const govLabel = gov.leader ? `${gov.members.map((p) => partyName(s, p)).join(' + ')}${gov.minority ? ' (minority)' : ''}` : 'Founding Assembly';
  const proj = useMemo(() => { try { return projectSeats(s); } catch { return null; } }, [s]);
  const govSeats = gov.members.reduce((a, p) => a + (s.seats[p] ?? 0), 0);
  return (
    <section className="q-card q-house" aria-labelledby="q-house-h">
      <h3 id="q-house-h" className="q-h3">The Assembly <Tip content={`The governing side holds ${govSeats} of 72 seats. ${MAJORITY} is a majority.`}><span className="q-muted q-small q-num">{govSeats}/72 gov.</span></Tip></h3>
      <Hemicycle colors={colors} rm={rm} popKey={s.elections.length} seatTip={seatTipFor(s, list)} label={`Assembly: ${partiesLeftToRight(s).map((p) => `${partyName(s, p)} ${s.seats[p] ?? 0}`).join(', ')}`}
        center={<><b className="q-house__n"><Num value={s.seats.player ?? 0} rm={rm} /></b><span className="q-hemi__sub">your seats</span></>} />
      <ul className="q-legend">
        {partiesLeftToRight(s).map((p) => {
          const r = p === 'player' ? null : rivalDef(p);
          const pr = proj?.[p] ?? 0; const d = pr - (s.seats[p] ?? 0);
          return (
            <li key={p} className={gov.members.includes(p) ? 'is-gov' : ''} tabIndex={0}
              {...tip(<span className="q-tip__body"><b>{partyName(s, p)}</b>{r ? <span className="q-tip__row">Led by {r.leader} · {r.aiStyle}</span> : <span className="q-tip__row">Your party</span>}
                <span className="q-tip__row">Seats now <b className="q-num">{s.seats[p] ?? 0}</b> · if Calderra voted today <b className="q-num">{pr}</b></span>
                {r && <span className="q-tip__row">{r.personality}</span>}</span>)}>
              <Portrait seed={p === 'player' ? leaderSeed(s) : r?.leader ?? p} color={partyColor(s, p)} size={30} />
              <span className="q-legend__n">{partyName(s, p)}<small className="q-muted">{p === 'player' ? 'you' : RELATION_LABEL[s.rivals[p]?.relation ?? 0]}{gov.members.includes(p) ? ' · in government' : ''}</small></span>
              <b className="q-num">{s.seats[p] ?? 0}</b>
              <small className={`q-num q-legend__proj ${d > 0 ? 'is-up' : d < 0 ? 'is-down' : ''}`} aria-label={`Projected ${pr}`}>{d ? signed(d) : '·'}</small>
            </li>
          );
        })}
      </ul>
      <p className="q-small q-muted q-house__gov">Government: <b className="q-text">{govLabel}</b></p>
    </section>
  );
}

// ---------------------------------------------------------------- advisor card

export function AdvisorCard({ s, advice, onDo, onOpenVote, onDismiss }: { s: GameState; advice: Advice | null; onDo: (a: Action) => void; onOpenVote: (id: string) => void; onDismiss: () => void }) {
  if (!advice) return null;
  return (
    <section className={`q-card q-advisor is-${advice.tone}`} aria-label="Advisor" aria-live="polite">
      <Portrait seed={`advisor·${s.seed}·Secretary Wren`} color="#8a6d3b" size={44} mood="calm" />
      <div className="q-advisor__t">
        <p className="q-kicker">Your advisor suggests</p>
        <b>{advice.title}</b>
        <small>{advice.why}</small>
      </div>
      <div className="q-advisor__btns">
        {advice.action && <button className="btn btn--accent q-btn-sm" onClick={() => onDo(advice.action!)}>Do it</button>}
        {advice.vote && <button className="btn btn--accent q-btn-sm" onClick={() => onOpenVote(advice.vote!)}>Open vote</button>}
        <button className="q-iconbtn q-iconbtn--sm" onClick={onDismiss} aria-label="Hide advisor">✕</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- dashboard

const ACT_ICON: Record<string, string> = { '1': '⚑', '2': '❀', '3': '✎', '4': '⚖', '5': '✂' };

export function Dashboard({ s, rm, log, onSheet, onOpenVote, advisor, extra }: {
  s: GameState; rm: boolean; log: LogEntry[]; onSheet: (sh: Sheet) => void; onOpenVote: (itemId: string) => void; advisor: ReactNode; extra?: ReactNode;
}) {
  const actions: { k: string; label: string; sub: string; a: () => void; dis?: boolean; tipText: string }[] = [
    { k: '1', label: 'Campaign', sub: inGovernment(s) ? '10 treasury' : '10 party funds', a: () => onSheet({ kind: 'map' }), tipText: 'Rally in one region. Each campaign adds about 3% to your vote there until the next election.' },
    { k: '2', label: 'Court', sub: '+5 one group', a: () => onSheet({ kind: 'court' }), tipText: 'Win over an interest group (+5, or +2 above 75). Its rival group cools on you by 2.' },
    { k: '3', label: 'Draft law', sub: `docket ${s.docket.filter((d) => d.proposer === 'player').length}/2`, a: () => onSheet({ kind: 'laws', tab: 'draft' }), tipText: 'Put a law on the docket. In opposition you may draft one per turn.' },
    { k: '4', label: 'Lobby', sub: '2 PC', a: () => onSheet({ kind: 'lobby' }), tipText: 'Warm relations with a rival by one step. Friendly rivals join coalitions and back your bills.' },
    { k: '5', label: 'Repeal', sub: 'enacted law', a: () => onSheet({ kind: 'laws', tab: 'repeal' }), dis: !s.enacted.length, tipText: 'Put the repeal of an enacted law on the docket.' },
  ];
  return (
    <div className="q-dash">
      <div className="q-dash__lead">
        {advisor}
        <section className="q-card q-actcard" aria-labelledby="q-acts-h" data-coach="actions">
          <h3 id="q-acts-h" className="q-h3">Actions <span className="q-muted q-small">{s.ap} AP left · 1 AP each</span></h3>
          <div className="q-acts">
            {actions.map((x) => (
              <button key={x.k} className="q-act" onClick={x.a} disabled={s.ap <= 0 || x.dis} aria-keyshortcuts={x.k} {...tip(x.tipText)}>
                <span className="q-act__ic" aria-hidden="true">{ACT_ICON[x.k]}</span>
                <b>{x.label}</b><small>{x.sub}</small><kbd aria-hidden="true">{x.k}</kbd>
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="q-dash__main">
        <Chamber s={s} rm={rm} />
        <section className="q-card q-mapcard" aria-labelledby="q-map-h">
          <h3 id="q-map-h" className="q-h3">Calderra <span className="q-muted q-small">tap a region to campaign</span></h3>
          <CalderraMap s={s} onSelect={(id) => onSheet({ kind: 'map', region: id })} />
        </section>
        <section className="q-card" aria-labelledby="q-appr-h">
          <h3 id="q-appr-h" className="q-h3">Interest groups <span className="q-muted q-small">approval of you</span></h3>
          <ApprovalBars s={s} rm={rm} />
        </section>
        <section className="q-card" aria-labelledby="q-nat-h">
          <h3 id="q-nat-h" className="q-h3">State of the nation</h3>
          <StatChips s={s} rm={rm} />
          {extra}
        </section>
      </div>
      <aside className="q-dash__rail">
        <Docket s={s} onOpenVote={onOpenVote} />
        <section className="q-card q-news" aria-label="News ticker">
          <h3 className="q-h3 q-news__mast">The Calderra Gazette <span className="q-muted q-small q-num">{yearOf(s.turn)}</span></h3>
          <ul aria-live="polite">
            {log.filter((l) => l.kind !== 'error' && l.kind !== 'info').slice(-7).reverse().map((l, i) => <li key={`${l.turn}-${i}-${l.text}`} className={`q-news__${l.kind}`}><span className="q-num q-muted">T{l.turn}</span> {l.text}</li>)}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function Docket({ s, onOpenVote }: { s: GameState; onOpenVote: (id: string) => void }) {
  return (
    <section className="q-card q-ledger" aria-labelledby="q-dock-h" data-coach="docket">
      <h3 id="q-dock-h" className="q-h3">The Docket <span className="q-muted q-small">{s.docket.length} bill{s.docket.length === 1 ? '' : 's'}</span></h3>
      {s.docket.length ? (
        <ul className="q-docket">
          {s.docket.map((d) => {
            const law = lawById(d.lawId);
            const f = safeForecast(s, d.id);
            const am = d.amendment ? CONTENT.amendments?.find((a) => a.id === d.amendment) : undefined;
            return (
              <li key={d.id}>
                <button className="q-docket__item" onClick={() => onOpenVote(d.id)}>
                  <span className="q-docket__seal" style={{ background: partyColor(s, d.proposer) }} aria-hidden="true">{d.kind === 'repeal' ? '✂' : '§'}</span>
                  <span className="q-docket__t"><b>{d.kind === 'repeal' ? 'Repeal: ' : ''}{law?.name ?? d.lawId}</b>
                    <small>{partyName(s, d.proposer)}{am ? ` · amended: ${am.name}` : ''}</small>
                    {f && <span className="q-docket__fc" aria-label={`Forecast ${f.yes} yes, ${f.no} no, ${f.passes ? 'passes' : 'fails'}`}>
                      <span className="q-docket__bar"><span className="is-yes" style={{ width: `${(f.yes / 72) * 100}%` }} /><span className="is-no" style={{ width: `${(f.no / 72) * 100}%` }} /><i style={{ left: `${(f.threshold / 72) * 100}%` }} /></span>
                      <span className={`q-num ${f.passes ? 'q-ok' : 'q-warn'}`}>{f.yes}–{f.no} {f.passes ? 'PASS' : 'FAIL'}</span></span>}
                  </span>
                  <span className="q-docket__go">Vote ›</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="q-muted q-small">No bills on the docket. Draft a law (3) to put one forward.</p>}
    </section>
  );
}

export function EndBar({ s, onEndTurn, undo, onUndo }: { s: GameState; onEndTurn: () => void; undo: string | null; onUndo: () => void }) {
  const next = nextElectionIn(s);
  return (
    <div className="q-endbar" data-coach="endturn">
      <span className="q-small q-endbar__info">{next === null ? 'No elections remain' : next === 0 ? <b className="q-endbar__elect">Election at the end of this turn</b> : `Election in ${next} turn${next > 1 ? 's' : ''}`}</span>
      {undo && <button className="btn q-btn-ghost q-btn-lg q-endbar__undo" onClick={onUndo} aria-keyshortcuts="z" {...tip(`Undo: ${undo}`)}>↶ Undo <kbd aria-hidden="true">Z</kbd></button>}
      <button className="btn btn--accent q-btn-lg q-endbar__go" onClick={onEndTurn} aria-keyshortcuts="e">End Turn <kbd aria-hidden="true">E</kbd></button>
    </div>
  );
}

export function safeForecast(s: GameState, id: string) { try { return api.forecastVote(s, id); } catch { return null; } }

// ---------------------------------------------------------------- sheets

function Cost({ s, a }: { s: GameState; a: Action }) {
  const p = canDo(s, a);
  if (!p.valid) return <small className="q-warn">{p.reason ?? 'Unavailable'}</small>;
  const bits = [p.cost.ap && `${p.cost.ap} AP`, p.cost.pc && `${p.cost.pc} PC`, p.cost.treasury && `${p.cost.treasury} treasury`, p.cost.partyFunds && `${p.cost.partyFunds} funds`].filter(Boolean);
  return <small className="q-muted">{bits.join(' · ') || 'Free'}</small>;
}

export function RegionPanel({ s, initial, act }: { s: GameState; initial?: RegionId; act: (a: Action) => void }) {
  const [sel, setSel] = useState<RegionId>(initial ?? CONTENT.regions[0].id);
  const reg = CONTENT.regions.find((r) => r.id === sel)!;
  const { party, seats } = regionLeader(s, sel);
  const mix = s.mixes?.[sel] ?? reg.mix;
  const a: Action = { type: 'campaign', regionId: sel };
  const pv = canDo(s, a);
  const gain = useMemo(() => {
    try { const before = projectSeats(s).player ?? 0; const r = api.apply(s, a); return (projectSeats(r.state).player ?? 0) - before; } catch { return 0; }
  }, [s, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="q-region">
      <CalderraMap s={s} selected={sel} onSelect={setSel} />
      <div className="q-region__info" aria-live="polite">
        <h3 className="q-h3">{reg.name} <span className="q-muted q-small">{reg.seats} seats</span></h3>
        <p className="q-muted q-small">{reg.blurb}</p>
        <p className="q-small">{party ? <>Led by <span className="q-dot" style={{ background: partyColor(s, party) }} /> <b>{partyName(s, party)}</b> ({Object.entries(seats ?? {}).filter(([, n]) => n).map(([p, n]) => `${partyName(s, p).split(' ')[0]} ${n}`).join(', ')})</> : 'No election held here yet.'}</p>
        <p className="q-small">Your campaigns here this term: <b className="q-num">{s.campaign[sel] ?? 0}</b> · <Tip content="Seats you would win nationally if the election were held after this campaign, compared with now.">projected effect <b className={`q-num ${gain > 0 ? 'q-ok' : ''}`}>{gain > 0 ? `+${gain} seat${gain > 1 ? 's' : ''}` : 'no seat change yet'}</b></Tip></p>
        <div className="q-label">Voter mix</div>
        <ul className="q-mix">
          {Object.entries(mix).sort((x, y) => y[1] - x[1]).map(([g, v]) => (
            <li key={g} tabIndex={0} {...tip(`${groupName(g)}: ${Math.round(v * 100)}% of this region. They rate you ${Math.round(s.approval[g] ?? 0)}/100.`)}><span aria-hidden="true">{groupGlyph(g)}</span><span className="q-mix__n">{groupName(g)}</span><span className="q-mix__bar"><span style={{ width: `${v * 250}%` }} /></span><b className="q-num">{Math.round(v * 100)}%</b><span className="q-num q-muted">{Math.round(s.approval[g] ?? 0)}♥</span></li>
          ))}
        </ul>
        <button className="btn btn--accent q-btn-lg q-wide" disabled={!pv.valid} onClick={() => act(a)}>Campaign in {reg.name.split(' ')[0]}</button>
        <Cost s={s} a={a} />
      </div>
    </div>
  );
}

export function CourtPanel({ s, act }: { s: GameState; act: (a: Action) => void }) {
  return (
    <ul className="q-list">
      {CONTENT.groups.map((g, i) => {
        const a: Action = { type: 'court', groupId: g.id };
        const p = canDo(s, a);
        const deltas = Object.entries(p.approvalDelta ?? {}).filter(([, n]) => n);
        return (
          <li key={g.id}>
            <button className="q-row" disabled={!p.valid} onClick={() => act(a)} aria-keyshortcuts={String(i + 1)}>
              <span className="q-bar__ic" aria-hidden="true">{groupGlyph(g.id)}</span>
              <span className="q-row__t"><b>{g.name}</b><small className="q-muted">Wants {g.wants} · {Math.round((s.shares?.[g.id] ?? g.share) * 100)}% of voters</small>
                <span className="q-effects">{deltas.map(([k, n]) => <span key={k}>{groupGlyph(k)} {groupName(k).split(' ').pop()} <Delta n={n} /></span>)}</span></span>
              <span className="q-num q-row__v">{Math.round(s.approval[g.id] ?? 0)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LobbyPanel({ s, act }: { s: GameState; act: (a: Action) => void }) {
  return (
    <ul className="q-list">
      {CONTENT.rivals.map((r) => {
        const a: Action = { type: 'lobby', rivalId: r.id as RivalId };
        const rel = s.rivals[r.id]?.relation ?? 0;
        return (
          <li key={r.id}>
            <div className="q-row q-row--static">
              <Portrait seed={r.leader} color={r.color} size={52} label={r.leader} />
              <span className="q-row__t"><b>{r.name}</b><small className="q-muted">{r.leader} · {r.aiStyle} · {s.seats[r.id] ?? 0} seats</small>
                <small className="q-muted q-row__desc">{r.personality}</small>
                <span className="q-rel" aria-label={`Relation ${RELATION_LABEL[rel]}`}>{[-2, -1, 0, 1, 2].map((st) => <span key={st} className={st <= rel ? 'is-on' : ''} />)} <small>{RELATION_LABEL[rel]}</small></span>
                <Cost s={s} a={a} /></span>
              <button className="btn q-btn-sm" disabled={!canDo(s, a).valid} onClick={() => act(a)}>Lobby</button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function LawLibrary({ s, initialTab, act, tutorialSuggest, amendPicker }: {
  s: GameState; initialTab?: 'draft' | 'repeal'; act: (a: Action) => void; tutorialSuggest?: boolean;
  amendPicker?: (law: LawDef, close: () => void) => ReactNode;
}) {
  const cats = useMemo(() => ['all', ...Array.from(new Set(CONTENT.laws.map((l) => l.category)))], []);
  const [cat, setCat] = useState('all');
  const [state, setState] = useState<'available' | 'enacted' | 'all'>(initialTab === 'repeal' ? 'enacted' : 'available');
  const [era, setEra] = useState<number>(0);
  const [open, setOpen] = useState<string | null>(null);
  const [amending, setAmending] = useState<string | null>(null);
  const sug = suggestedLaw(s);
  const avail = new Set(availableLaws(s).map((l) => l.id));
  let laws = CONTENT.laws.filter((l) => (cat === 'all' || l.category === cat) && (!era || l.era === era));
  laws = laws.filter((l) => state === 'all' ? true : state === 'enacted' ? s.enacted.includes(l.id) : avail.has(l.id));
  if (tutorialSuggest && sug) laws = [sug, ...laws.filter((l) => l.id !== sug.id)];
  const amLaw = amending ? lawById(amending) : undefined;
  if (amLaw && amendPicker) return <>{amendPicker(amLaw, () => setAmending(null))}</>;
  return (
    <div className="q-laws">
      <div className="q-tabs" role="tablist" aria-label="Law categories">
        {cats.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={`q-chip${cat === c ? ' is-on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="q-filters">
        <label><span className="q-sr">State</span><select className="q-input q-input--sm" value={state} onChange={(e) => setState(e.target.value as typeof state)}><option value="available">Available</option><option value="enacted">Enacted</option><option value="all">All</option></select></label>
        <label><span className="q-sr">Era</span><select className="q-input q-input--sm" value={era} onChange={(e) => setEra(Number(e.target.value))}><option value={0}>All eras</option>{CONTENT.eras.map((e) => <option key={e.id} value={e.id} disabled={e.id > s.era}>{e.name}{e.id > s.era ? ' (locked)' : ''}</option>)}</select></label>
      </div>
      {!laws.length && <p className="q-muted">No laws match.</p>}
      <ul className="q-lawlist">
        {laws.map((l) => <LawCard key={l.id} s={s} l={l} open={open === l.id} suggested={tutorialSuggest && sug?.id === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} act={act} onAmend={amendPicker ? () => setAmending(l.id) : undefined} />)}
      </ul>
    </div>
  );
}

function LawCard({ s, l, open, suggested, onToggle, act, onAmend }: { s: GameState; l: LawDef; open: boolean; suggested?: boolean; onToggle: () => void; act: (a: Action) => void; onAmend?: () => void }) {
  const enacted = s.enacted.includes(l.id);
  const locked = l.era > s.era;
  const a: Action = enacted ? { type: 'repeal', lawId: l.id } : { type: 'draft', lawId: l.id };
  const p = locked ? null : canDo(s, a);
  const f = open && !locked && !enacted ? safeForecast(s, l.id) : null;
  return (
    <li className={`q-law${suggested ? ' is-suggest' : ''}${enacted ? ' is-enacted' : ''}`} data-coach={suggested ? 'suggest' : undefined}>
      <button className="q-law__head" onClick={onToggle} aria-expanded={open}>
        <span className="q-law__t"><b>{l.name}</b><small className="q-muted">{l.category} · era {l.era}{enacted ? ' · enacted' : ''}{!l.repealable ? ' · entrenched (48)' : ''}</small></span>
        <AxisDot s={s} axis={l.axis} />
      </button>
      <p className="q-small">{l.desc}</p>
      <div className="q-effects" aria-label="Group effects">
        {Object.entries(l.groupEffects).map(([g, n]) => <Tip key={g} content={`${groupName(g)} ${signed(n)} approval if enacted`}>{groupGlyph(g)} <Delta n={n} /></Tip>)}
        {Object.entries(l.stats).map(([k, n]) => <Tip key={k} content={`${STAT_LABEL[k as keyof typeof STAT_LABEL]} ${signed(n ?? 0)}`}>{STAT_ICON[k as keyof typeof STAT_ICON]} <Delta n={n ?? 0} /></Tip>)}
        <Tip content={l.upkeep > 0 ? `Costs ${l.upkeep} treasury every turn while in force` : l.upkeep < 0 ? `Raises ${-l.upkeep} treasury every turn` : 'No running cost'} className={l.upkeep > 0 ? 'q-delta is-down' : l.upkeep < 0 ? 'q-delta is-up' : 'q-delta'}>◉ {l.upkeep > 0 ? `−${l.upkeep}` : l.upkeep < 0 ? `+${-l.upkeep}` : 0}/turn</Tip>
        {l.oneOff ? <Tip content="One-off treasury change on enactment" className="q-delta">◉ {signed(l.oneOff)} once</Tip> : null}
      </div>
      {!locked && <WingChips s={s} lawId={l.id} kind={enacted ? 'repeal' : 'enact'} />}
      {open && f && (
        <p className="q-small" aria-live="polite">Forecast if called now: <b className="q-num">{f.yes} YES · {f.no} NO · {f.abstain} abst.</b> — {f.passes ? <span className="q-ok">passes</span> : <span className="q-warn">fails</span>} (needs {f.threshold})</p>
      )}
      <div className="q-law__foot">
        {locked ? <small className="q-muted">Unlocks in era {l.era}</small> : <>
          <button className="btn q-btn-sm btn--accent" disabled={!p?.valid} onClick={() => act(a)}>{enacted ? 'Repeal' : 'Draft'}</button>
          {!enacted && onAmend && p?.valid && <button className="btn q-btn-sm q-btn-ghost" onClick={onAmend}>Draft with amendment…</button>}
          {p && !p.valid && <small className="q-warn">{p.reason}</small>}
          {!open && !enacted && <button className="q-link" onClick={onToggle}>Preview vote</button>}
        </>}
      </div>
    </li>
  );
}

export function AxisDot({ s, axis }: { s: GameState; axis: [number, number] }) {
  return (
    <svg className="q-axis" viewBox="-1.1 -1.1 2.2 2.2" role="img" aria-label={`Position: economic ${axis[0]}, social ${axis[1]}`}>
      <rect x="-1" y="-1" width="2" height="2" />
      <line x1="-1" x2="1" y1="0" y2="0" /><line y1="-1" y2="1" x1="0" x2="0" />
      <circle cx={s.player.economic} cy={-s.player.social} r="0.16" style={{ fill: s.player.color }} />
      <circle cx={axis[0]} cy={-axis[1]} r="0.2" className="q-axis__law" />
    </svg>
  );
}
