import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { Action, GameState, GroupId, LawDef, LogEntry, RegionId, RivalId } from '../engine/types';
import {
  api, availableLaws, canDo, CONTENT, eraDef, groupGlyph, groupName, inGovernment, lawById, MAJORITY, partiesLeftToRight,
  partyColor, partyName, RELATION_LABEL, rivalDef, seatList, signed, STAT_ICON, STAT_LABEL, STATS, suggestedLaw, TURNS_TOTAL, turnsToElection,
} from './adapter';
import { Delta, Hemicycle, RegionMap, regionLeader } from './visuals';

export type Sheet = null | { kind: 'map'; region?: RegionId } | { kind: 'court' } | { kind: 'laws'; tab?: 'draft' | 'repeal' } | { kind: 'lobby' };

// ---------------------------------------------------------------- top bar

export function TopBar({ s, rm, muted, onPause, onMute }: { s: GameState; rm: boolean; muted: boolean; onPause: () => void; onMute: () => void }) {
  const era = eraDef(s);
  return (
    <header className="q-top" aria-label="Turn status">
      <div className="q-top__turn">
        <b className="q-num">Turn {s.turn}<span className="q-muted">/{TURNS_TOTAL}</span></b>
        <span className="q-top__era">{era.name}</span>
      </div>
      <dl className="q-top__res">
        <div title="Treasury: income 40 + economy×0.4, minus 30 + law upkeep"><dt><m.span key={rm ? 0 : Math.round(s.treasury)} className="q-coin" aria-hidden="true" initial={rm ? false : { rotateY: 0 }} animate={{ rotateY: 360 }} transition={{ duration: 0.6 }}>◉</m.span><span className="q-sr">Treasury</span></dt><dd className="q-num">{Math.round(s.treasury)}</dd></div>
        <div title="Debt: 6% interest per turn; over 150 hurts the economy; over 300 is bankruptcy" className={s.debt > 150 ? 'is-danger' : ''}><dt><span aria-hidden="true">⛓</span><span className="q-sr">Debt</span></dt><dd className="q-num">{Math.round(s.debt)}</dd></div>
        <div title="Political Capital: spend on whip and lobby (max 8)"><dt><span aria-hidden="true">★</span><span className="q-sr">Political capital</span></dt><dd className="q-num">{s.politicalCapital}</dd></div>
      </dl>
      <div className="q-ap" role="img" aria-label={`${s.ap} of 3 action points left`} data-coach="ap">
        {[0, 1, 2].map((i) => <span key={i} className={`q-ap__pip${i < s.ap ? ' is-on' : ''}`} />)}
      </div>
      <button className="q-iconbtn" onClick={onMute} aria-label={muted ? 'Unmute sound' : 'Mute sound'} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>
      <button className="q-iconbtn" onClick={onPause} aria-label="Pause menu (Esc)">❚❚</button>
    </header>
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
        return (
          <li key={g.id} className="q-bar" title={`${g.name}: ${Math.round(g.share * 100)}% of voters. Wants ${g.wants}.`}>
            <span className="q-bar__ic" aria-hidden="true">{groupGlyph(g.id)}</span>
            <span className="q-bar__name">{g.name}</span>
            <span className="q-bar__track" aria-hidden="true">
              <m.span className="q-bar__fill" initial={false} animate={{ width: `${v}%` }} transition={{ duration: rm ? 0 : 0.5 }} style={{ background: s.player.color }} />
              <span className="q-bar__mid" />
            </span>
            <span className="q-bar__val q-num" aria-label={`${g.name} approval ${v}${tr ? `, ${tr > 0 ? 'up' : 'down'} ${Math.abs(tr)} this turn` : ''}`}>
              {v}<span className={`q-trend ${tr > 0 ? 'is-up' : tr < 0 ? 'is-down' : ''}`} aria-hidden="true">{tr > 0 ? '▲' : tr < 0 ? '▼' : '·'}</span>
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

export function StatChips({ s }: { s: GameState }) {
  return (
    <ul className="q-stats" aria-label="National stats">
      {STATS.map((k) => {
        const v = Math.round(s.stats[k]);
        return <li key={k} className={v < 40 ? 'is-low' : v > 70 ? 'is-high' : ''} title={`${STAT_LABEL[k]} ${v}/100, drifts 1 per turn toward 50`}><span aria-hidden="true">{STAT_ICON[k]}</span><span className="q-stats__k">{STAT_LABEL[k]}</span><b className="q-num">{v}</b></li>;
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- dashboard

export function Dashboard({ s, rm, log, onSheet, onOpenVote, onEndTurn, act }: {
  s: GameState; rm: boolean; log: LogEntry[]; onSheet: (sh: Sheet) => void; onOpenVote: (itemId: string) => void; onEndTurn: () => void; act: (a: Action) => void;
}) {
  const colors = seatList(s).map((p) => (p ? partyColor(s, p) : null));
  const gov = s.government;
  const govLabel = gov.leader ? `${gov.members.map((p) => partyName(s, p)).join(' + ')}${gov.minority ? ' (minority)' : ''}` : 'Founding Assembly';
  const tte = turnsToElection(s.turn);
  const actions: { k: string; label: string; sub: string; a: () => void; dis?: boolean }[] = [
    { k: '1', label: 'Campaign', sub: inGovernment(s) ? '1 AP · 10 treasury' : '1 AP · 10 party funds', a: () => onSheet({ kind: 'map' }) },
    { k: '2', label: 'Court', sub: '1 AP · +5 group', a: () => onSheet({ kind: 'court' }) },
    { k: '3', label: 'Draft law', sub: `1 AP · docket ${s.docket.filter((d) => d.proposer === 'player').length}/2`, a: () => onSheet({ kind: 'laws', tab: 'draft' }) },
    { k: '4', label: 'Lobby', sub: '1 AP · 2 PC', a: () => onSheet({ kind: 'lobby' }) },
    { k: '5', label: 'Repeal', sub: '1 AP', a: () => onSheet({ kind: 'laws', tab: 'repeal' }), dis: !s.enacted.length },
  ];
  return (
    <div className="q-dash">
      <div className="q-dash__main">
        <section className="q-card q-house" aria-label="Assembly seats">
          <Hemicycle colors={colors} rm={rm} popKey={s.elections.length} label={`Assembly: ${partiesLeftToRight(s).map((p) => `${partyName(s, p)} ${s.seats[p] ?? 0}`).join(', ')}`}
            center={<><b className="q-num q-house__n">{s.seats.player ?? 0}</b><span className="q-small q-muted">your seats · {MAJORITY} to govern</span></>} />
          <ul className="q-legend">
            {partiesLeftToRight(s).map((p) => (
              <li key={p}><span className="q-dot" style={{ background: partyColor(s, p) }} /><span className="q-legend__n">{partyName(s, p)}</span><b className="q-num">{s.seats[p] ?? 0}</b>
                <small className="q-muted">{p === 'player' ? 'you' : RELATION_LABEL[s.rivals[p]?.relation ?? 0]}</small></li>
            ))}
          </ul>
          <p className="q-small q-muted">Government: <b className="q-text">{govLabel}</b></p>
        </section>

        <section className="q-card" aria-labelledby="q-acts-h" data-coach="actions">
          <h3 id="q-acts-h" className="q-h3">Actions <span className="q-muted q-small">{s.ap} AP left</span></h3>
          <div className="q-acts">
            {actions.map((x) => (
              <button key={x.k} className="q-act" onClick={x.a} disabled={s.ap <= 0 || x.dis} aria-keyshortcuts={x.k}>
                <kbd aria-hidden="true">{x.k}</kbd><b>{x.label}</b><small>{x.sub}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="q-card" aria-labelledby="q-appr-h">
          <h3 id="q-appr-h" className="q-h3">Interest groups</h3>
          <ApprovalBars s={s} rm={rm} />
        </section>

        <section className="q-card" aria-label="National stats and map">
          <StatChips s={s} />
          <RegionMap s={s} onSelect={(id) => onSheet({ kind: 'map', region: id })} />
        </section>
      </div>

      <aside className="q-dash__rail">
        <section className="q-card" aria-labelledby="q-dock-h" data-coach="docket">
          <h3 id="q-dock-h" className="q-h3">Docket <span className="q-muted q-small">{s.docket.length} bill{s.docket.length === 1 ? '' : 's'}</span></h3>
          {s.docket.length ? (
            <ul className="q-docket">
              {s.docket.map((d) => {
                const law = lawById(d.lawId);
                const f = safeForecast(s, d.id);
                return (
                  <li key={d.id}>
                    <button className="q-docket__item" onClick={() => onOpenVote(d.id)}>
                      <span className="q-dot" style={{ background: partyColor(s, d.proposer) }} />
                      <span className="q-docket__t"><b>{d.kind === 'repeal' ? 'Repeal: ' : ''}{law?.name ?? d.lawId}</b>
                        <small>{partyName(s, d.proposer)}{f ? ` · forecast ${f.yes}–${f.no} ${f.passes ? 'PASS' : 'FAIL'}` : ''}</small></span>
                      <span className="q-docket__go">Vote ›</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="q-muted q-small">No bills on the docket. Draft a law (3) to put one forward.</p>}
        </section>
        <section className="q-card q-news" aria-label="News ticker">
          <h3 className="q-h3">Calderra Gazette</h3>
          <ul aria-live="polite">
            {log.filter((l) => l.kind !== 'error').slice(-6).reverse().map((l, i) => <li key={`${l.turn}-${i}-${l.text}`} className={`q-news__${l.kind}`}><span className="q-num q-muted">T{l.turn}</span> {l.text}</li>)}
          </ul>
        </section>
      </aside>

      <div className="q-endbar" data-coach="endturn">
        <span className="q-small q-muted">{tte === 0 ? 'Election at end of this turn' : `Election in ${tte} turn${tte > 1 ? 's' : ''}`}</span>
        <button className="btn btn--accent q-btn-lg" onClick={onEndTurn} aria-keyshortcuts="e">End Turn <kbd aria-hidden="true">E</kbd></button>
      </div>
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
  return (
    <div className="q-region">
      <RegionMap s={s} selected={sel} onSelect={setSel} />
      <div className="q-region__info" aria-live="polite">
        <h3 className="q-h3">{reg.name} <span className="q-muted q-small">{reg.seats} seats</span></h3>
        <p className="q-muted q-small">{reg.blurb}</p>
        <p className="q-small">{party ? <>Led by <span className="q-dot" style={{ background: partyColor(s, party) }} /> <b>{partyName(s, party)}</b> ({Object.entries(seats ?? {}).filter(([, n]) => n).map(([p, n]) => `${partyName(s, p).split(' ')[0]} ${n}`).join(', ')})</> : 'No election held here yet.'}</p>
        <p className="q-small">Your campaigns here this term: <b className="q-num">{s.campaign[sel] ?? 0}</b></p>
        <div className="q-label">Voter mix</div>
        <ul className="q-mix">
          {Object.entries(mix).sort((x, y) => y[1] - x[1]).map(([g, v]) => (
            <li key={g}><span aria-hidden="true">{groupGlyph(g)}</span><span className="q-mix__n">{groupName(g)}</span><span className="q-mix__bar"><span style={{ width: `${v * 250}%` }} /></span><b className="q-num">{Math.round(v * 100)}%</b><span className="q-num q-muted">{Math.round(s.approval[g] ?? 0)}♥</span></li>
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
              <span className="q-row__t"><b>{g.name}</b><small className="q-muted">Wants {g.wants}</small>
                <span className="q-effects">{deltas.map(([k, n]) => <span key={k}>{groupGlyph(k)} <Delta n={n} /></span>)}</span></span>
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
              <span className="q-dot q-dot--lg" style={{ background: r.color }} />
              <span className="q-row__t"><b>{r.name}</b><small className="q-muted">{r.leader} · {r.aiStyle} · {s.seats[r.id] ?? 0} seats</small>
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

export function LawLibrary({ s, initialTab, act, tutorialSuggest }: { s: GameState; initialTab?: 'draft' | 'repeal'; act: (a: Action) => void; tutorialSuggest?: boolean }) {
  const cats = useMemo(() => ['all', ...Array.from(new Set(CONTENT.laws.map((l) => l.category)))], []);
  const [cat, setCat] = useState('all');
  const [state, setState] = useState<'available' | 'enacted' | 'all'>(initialTab === 'repeal' ? 'enacted' : 'available');
  const [era, setEra] = useState<number>(0);
  const [open, setOpen] = useState<string | null>(null);
  const sug = suggestedLaw(s);
  const avail = new Set(availableLaws(s).map((l) => l.id));
  let laws = CONTENT.laws.filter((l) => (cat === 'all' || l.category === cat) && (!era || l.era === era));
  laws = laws.filter((l) => state === 'all' ? true : state === 'enacted' ? s.enacted.includes(l.id) : avail.has(l.id));
  if (tutorialSuggest && sug) laws = [sug, ...laws.filter((l) => l.id !== sug.id)];
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
        {laws.map((l) => <LawCard key={l.id} s={s} l={l} open={open === l.id} suggested={tutorialSuggest && sug?.id === l.id} onToggle={() => setOpen(open === l.id ? null : l.id)} act={act} />)}
      </ul>
    </div>
  );
}

function LawCard({ s, l, open, suggested, onToggle, act }: { s: GameState; l: LawDef; open: boolean; suggested?: boolean; onToggle: () => void; act: (a: Action) => void }) {
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
        {Object.entries(l.groupEffects).map(([g, n]) => <span key={g} title={groupName(g)}>{groupGlyph(g)} <Delta n={n} /></span>)}
        {Object.entries(l.stats).map(([k, n]) => <span key={k} title={STAT_LABEL[k as keyof typeof STAT_LABEL]}>{STAT_ICON[k as keyof typeof STAT_ICON]} <Delta n={n ?? 0} /></span>)}
        <span title="Upkeep per turn" className={l.upkeep > 0 ? 'q-delta is-down' : l.upkeep < 0 ? 'q-delta is-up' : 'q-delta'}>◉ {l.upkeep > 0 ? `−${l.upkeep}` : l.upkeep < 0 ? `+${-l.upkeep}` : 0}/turn</span>
        {l.oneOff ? <span className="q-delta">◉ {signed(l.oneOff)} once</span> : null}
      </div>
      {open && f && (
        <p className="q-small" aria-live="polite">Forecast if called now: <b className="q-num">{f.yes} YES · {f.no} NO · {f.abstain} abst.</b> — {f.passes ? <span className="q-ok">passes</span> : <span className="q-warn">fails</span>} (needs {f.threshold})</p>
      )}
      <div className="q-law__foot">
        {locked ? <small className="q-muted">Unlocks in era {l.era}</small> : <>
          <button className="btn q-btn-sm btn--accent" disabled={!p?.valid} onClick={() => act(a)}>{enacted ? 'Repeal' : 'Draft'}</button>
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
