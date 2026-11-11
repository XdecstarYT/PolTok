import { useEffect, useLayoutEffect, useState } from 'react';
import { sfx } from '../audio';
import { Num, Tip } from './fx';
import { Portrait } from './portrait';
import { ChallengeNote, wingColor } from './v2';
import { CHARACTERS, WINGS } from '../engine';
import { m } from 'framer-motion';
import type { EraDef, EventDef, GameState, LogEntry } from '../engine/types';
import { CONTENT, groupGlyph, groupName, signed, STAT_ICON, STAT_LABEL, STATS, yearOf } from './adapter';
import { Delta } from './visuals';
import { defaultQuality, hasWebGL } from '../world/support';
import type { Prefs } from './storage';

export function EventCard({ ev, s, rm, onChoose }: { ev: EventDef; s: GameState; rm: boolean; onChoose: (c: 0 | 1) => void }) {
  return (
    <m.div className="q-event" initial={rm ? false : { rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.45 }}>
      <p className="q-kicker">Turn {s.turn} · {ev.character ? 'Party affairs' : 'Dispatch'}{ev.chain && <span className="q-chainbadge">Storyline: {ev.chain}</span>}</p>
      {ev.character && s.eventContext?.characterId && CHARACTERS[s.eventContext.characterId] && (
        <div className="q-event__who"><Portrait seed={CHARACTERS[s.eventContext.characterId].name} color={wingColor(CHARACTERS[s.eventContext.characterId].wing)} size={72} label={CHARACTERS[s.eventContext.characterId].name} /><span className="q-small q-muted">{CHARACTERS[s.eventContext.characterId].bio}</span></div>
      )}
      <h2 className="q-event__t">{ev.title}</h2>
      <ChallengeNote s={s} />
      <p className="q-event__text">{ev.text}</p>
      <div className="q-event__choices">
        {ev.choices.slice(0, 2).map((c, i) => (
          <button key={i} className="q-choice" onClick={() => onChoose(i as 0 | 1)} aria-keyshortcuts={String(i + 1)} {...(i === 0 ? { 'data-autofocus': true } : {})}>
            <span className="q-choice__k" aria-hidden="true">{i + 1}</span>
            <b>{c.label}</b>
            <span className="q-effects">
              {Object.entries(c.groupEffects).map(([g, n]) => <span key={g} title={groupName(g)}>{groupGlyph(g)} <Delta n={n} /></span>)}
              {Object.entries(c.stats).map(([k, n]) => <span key={k}>{STAT_ICON[k as keyof typeof STAT_ICON]} <Delta n={n ?? 0} /></span>)}
              {c.treasury ? <span>◉ <Delta n={c.treasury} /></span> : null}
              {c.politicalCapital ? <span>★ <Delta n={c.politicalCapital} /></span> : null}
              {Object.entries(c.wings ?? {}).map(([w, n]) => <Tip key={w} content={`${WINGS[w]?.name ?? w} happiness ${signed(n ?? 0)}`} className="q-wingchip"><i style={{ background: wingColor(w) }} /><Delta n={n ?? 0} /></Tip>)}
              {c.followUp && <Tip content="This choice may have consequences in a later turn." className="q-muted">⟳ to be continued</Tip>}
            </span>
          </button>
        ))}
      </div>
    </m.div>
  );
}

export interface Head { text: string; tone: 'good' | 'bad' | 'neutral'; paper?: string; topic?: string }

/** Headlines from the turn log when the engine provides none. */
export function fallbackHeadlines(s: GameState, log: LogEntry[]): Head[] {
  const pick = (k: string[]) => log.filter((l) => k.includes(l.kind));
  const out: Head[] = [];
  for (const l of pick(['election'])) out.push({ text: l.text.replace(/^Election: you win/, `${s.player.name} wins`), tone: 'neutral', topic: 'election' });
  for (const l of pick(['law', 'vote'])) out.push({ text: l.text, tone: /fail|defeat|reject/i.test(l.text) ? 'bad' : 'good', topic: 'law' });
  for (const l of pick(['event', 'rival', 'coalition', 'stat', 'era'])) out.push({ text: l.text, tone: 'neutral' });
  for (const l of pick(['budget'])) out.push({ text: l.text, tone: /net -/.test(l.text) ? 'bad' : 'neutral', topic: 'economy' });
  return out.slice(0, 4);
}

function headlineCase(t: string) { return t.replace(/\.$/, ''); }

export function FrontPage({ prev, s, log, heads, rm, onClose }: { prev: GameState; s: GameState; log: LogEntry[]; heads: Head[]; rm: boolean; onClose: () => void }) {
  const dT = Math.round(s.treasury - prev.treasury), dD = Math.round(s.debt - prev.debt);
  const used = new Set(heads.map((h) => h.text));
  const brief = log.filter((l) => l.kind !== 'error' && l.kind !== 'info' && !used.has(l.text)).slice(0, 8);
  const lead = heads[0] ?? { text: `Quiet week in the Assembly`, tone: 'neutral' as const };
  const paper = lead.paper ?? (CONTENT as { papers?: string[] }).papers?.[prev.turn % Math.max(1, (CONTENT as { papers?: string[] }).papers?.length ?? 1)] ?? 'The Calderra Ledger';
  useEffect(() => { sfx.paper(); }, []);
  return (
    <m.article className="q-paper" aria-label={`${paper}, turn ${prev.turn}`}
      initial={rm ? false : { rotate: -400, scale: 0.15, opacity: 0 }} animate={{ rotate: -1.2, scale: 1, opacity: 1 }} transition={{ duration: 0.85, ease: [0.2, 0.9, 0.3, 1] }}>
      <header className="q-paper__mast">
        <p className="q-paper__ears"><span>Vol. {CONTENT.eras.findIndex((e) => e.id === prev.era) + 1}</span><span>No. {prev.turn}</span></p>
        <h2 className="q-paper__name">{paper}</h2>
        <p className="q-paper__date"><span>{yearOf(prev.turn)}</span><span>Calderra’s paper of record</span><span>Two pennies</span></p>
      </header>
      <h3 className={`q-paper__lead is-${lead.tone}`}>{headlineCase(lead.text)}</h3>
      {heads.slice(1, 3).map((h, i) => <p key={i} className={`q-paper__sub is-${h.tone}`}>{headlineCase(h.text)}</p>)}
      <div className="q-paper__cols">
        <section className="q-paper__box" aria-label="The ledger">
          <h4>The Ledger</h4>
          <dl className="q-paper__dl">
            <dt>Treasury</dt><dd><Num value={s.treasury} rm={rm} /> {(dT) !== 0 && <Delta n={dT} />}</dd>
            <dt>Debt</dt><dd><Num value={s.debt} rm={rm} /> {(-dD) !== 0 && <Delta n={-dD} />}</dd>
            <dt>Pol. capital</dt><dd><Num value={s.politicalCapital} rm={rm} /> {(s.politicalCapital - prev.politicalCapital) !== 0 && <Delta n={s.politicalCapital - prev.politicalCapital} />}</dd>
            <dt>Your seats</dt><dd><Num value={s.seats.player ?? 0} rm={rm} /> {((s.seats.player ?? 0) - (prev.seats.player ?? 0)) !== 0 && <Delta n={(s.seats.player ?? 0) - (prev.seats.player ?? 0)} />}</dd>
          </dl>
        </section>
        <section aria-label="Opinion">
          <h4>Opinion</h4>
          <SumChanges label="" items={CONTENT.groups.map((g) => ({ k: g.id, icon: groupGlyph(g.id), name: g.name.split(' ').pop() ?? g.name, full: g.name, n: Math.round((s.approval[g.id] ?? 0) - (prev.approval[g.id] ?? 0)) }))} />
          <h4>The Nation</h4>
          <SumChanges label="" items={STATS.map((k) => ({ k, icon: STAT_ICON[k], name: STAT_LABEL[k], full: STAT_LABEL[k], n: Math.round(s.stats[k] - prev.stats[k]) }))} />
        </section>
        {brief.length > 0 && (
          <section className="q-paper__brief" aria-label="In brief">
            <h4>In Brief</h4>
            <ul>{brief.map((l, i) => <li key={i}>{l.text}</li>)}</ul>
          </section>
        )}
      </div>
      <button className="btn btn--accent q-btn-lg q-wide q-paper__go" onClick={onClose} data-autofocus>Turn the page</button>
    </m.article>
  );
}

function SumChanges({ label, items }: { label: string; items: { k: string; icon: string; name: string; full: string; n: number }[] }) {
  const moved = items.filter((x) => x.n !== 0);
  return (
    <div className="q-sum__row">
      {label && <span className="q-label">{label}</span>}
      {moved.length ? (
        <span className="q-effects">{moved.map((x) => <span key={x.k} title={x.full}><span aria-hidden="true">{x.icon}</span> {x.name} <Delta n={x.n} /></span>)}</span>
      ) : <span className="q-muted q-small">No change</span>}
    </div>
  );
}

export function EraInterstitial({ era, s, rm, onClose }: { era: EraDef; s: GameState; rm: boolean; onClose: () => void }) {
  const laws = CONTENT.laws.filter((l) => l.era === era.id);
  return (
    <m.div className="q-era" initial={rm ? false : { clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: 0.8, ease: 'easeInOut' }}>
      <p className="q-kicker">A new era dawns · {era.years}</p>
      <h2 className="q-era__t">{era.name}</h2>
      <p>{era.blurb}</p>
      <p className="q-small q-muted">So far: {s.enacted.length} laws enacted · {s.seats.player ?? 0} seats · treasury {Math.round(s.treasury)}, debt {Math.round(s.debt)}</p>
      <div className="q-label">Newly unlocked laws</div>
      <ul className="q-era__laws">
        {laws.map((l, i) => <m.li key={l.id} initial={rm ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.08 }}><b>{l.name}</b> <small className="q-muted">{l.category}</small></m.li>)}
      </ul>
      <button className="btn btn--accent q-btn-lg q-wide" onClick={onClose} data-autofocus>Enter {era.name.replace(/^The /, 'the ')}</button>
    </m.div>
  );
}

export function PauseMenu({ prefs, setPrefs, onResume, onSaveQuit, onReset, onHow, inGame }: {
  prefs: Prefs; setPrefs: (p: Prefs) => void; onResume: () => void; onSaveQuit?: () => void; onReset: () => void; onHow: () => void; inGame: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="q-pause">
      <h2>{inGame ? 'Paused' : 'Settings'}</h2>
      <label className="q-toggle"><input type="checkbox" checked={!prefs.muted} onChange={(e) => setPrefs({ ...prefs, muted: !e.target.checked })} /> Sound (all audio)</label>
      <label className="q-field"><span className="q-label">Effects volume {Math.round(prefs.volume * 100)}%</span>
        <input type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => setPrefs({ ...prefs, volume: Number(e.target.value) })} disabled={prefs.muted} /></label>
      <label className="q-toggle"><input type="checkbox" checked={prefs.music} onChange={(e) => setPrefs({ ...prefs, music: e.target.checked })} disabled={prefs.muted} /> Music (adaptive score for each era)</label>
      <label className="q-field"><span className="q-label">Music volume {Math.round(prefs.musicVolume * 100)}%</span>
        <input type="range" min={0} max={1} step={0.05} value={prefs.musicVolume} onChange={(e) => setPrefs({ ...prefs, musicVolume: Number(e.target.value) })} disabled={prefs.muted || !prefs.music} /></label>
      <label className="q-toggle"><input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => setPrefs({ ...prefs, reduceMotion: e.target.checked })} /> Reduce motion</label>
      <label className="q-toggle"><input type="checkbox" checked={prefs.advisor} onChange={(e) => setPrefs({ ...prefs, advisor: e.target.checked })} /> Show the Advisor's hints</label>
      {hasWebGL() ? <>
        <label className="q-toggle"><input type="checkbox" checked={prefs.map3d} onChange={(e) => setPrefs({ ...prefs, map3d: e.target.checked })} /> 3D map and Assembly chamber</label>
        <label className="q-field"><span className="q-label">3D quality{prefs.quality3d === 'auto' ? ` (auto: ${defaultQuality()})` : ''}</span>
          <select className="q-select" value={prefs.quality3d} disabled={!prefs.map3d} onChange={(e) => setPrefs({ ...prefs, quality3d: e.target.value as Prefs['quality3d'] })}>
            <option value="auto">Auto (by device)</option><option value="low">Low: fastest, no shadows</option><option value="medium">Medium</option><option value="high">High: soft shadows, dense forests</option>
          </select></label>
      </> : <p className="q-small q-muted">3D views need WebGL2, which this browser does not offer. The illustrated 2D map is used instead.</p>}
      <div className="q-pause__btns">
        <button className="btn btn--accent q-btn-lg" onClick={onResume} data-autofocus>{inGame ? 'Resume' : 'Done'}</button>
        <button className="btn q-btn-ghost q-btn-lg" onClick={onHow}>How to Play</button>
        {inGame && onSaveQuit && <button className="btn q-btn-ghost q-btn-lg" onClick={onSaveQuit}>Save &amp; quit to title</button>}
        {!confirm ? <button className="btn q-btn-ghost q-btn-lg" onClick={() => setConfirm(true)}>Reset save…</button>
          : <button className="btn q-btn-lg q-danger" onClick={onReset}>Really erase save &amp; records</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- tutorial coach marks

export const TUTORIAL: { target: string; title: string; body: string }[] = [
  { target: 'approval', title: 'These 8 groups vote', body: 'Each bar is how much a group likes your party. Approval is squared at election time, so loyal groups matter most.' },
  { target: 'actions', title: 'Draft a law', body: 'You have 3 Action Points per turn. Press Draft (or 3) — we\'ll highlight the law that best fits your party.' },
  { target: 'docket', title: 'Forecast & whip', body: 'Bills wait on the docket. Open one to see the forecast tally before you call the vote. Spend Political Capital to whip wavering blocs.' },
  { target: 'docket', title: 'Amend a bill that falls short', body: 'On the roll-call screen, "Offer an amendment" attaches one rider to your bill. Each option shows which bloc it wins over and whether it turns a failing bill into a passing one. It costs treasury or Political Capital, and its effects apply only if the law passes.' },
  { target: 'debate|cabinet', title: 'Debates & press conferences', body: 'From turn 2 a debate is often on offer (look for "Take the floor" here). Answering costs 1 AP: bold lines win more approval but can backfire, measured lines are safe. Unanswered debates expire at the end of the turn.' },
  { target: 'cabinet', title: 'Your cabinet & party wings', body: 'Five posts give bonuses each turn: the Purse adds treasury, the Whip builds Political Capital, the Herald boosts debates. Keep every post filled with a good fit, and keep your three party wings above 35 or they rebel on votes and can challenge your leadership.' },
  { target: 'endturn', title: 'End the turn', body: 'Unspent AP is lost. Ending the turn collects income, pays upkeep and holds any uncalled votes.' },
  { target: 'endturn', title: 'First election in 3 turns', body: 'Every 4 turns Calderra votes. Campaign in regions and keep your groups happy before turn 4.' },
];

export function Coach({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const t = TUTORIAL[step];
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    // a target can list fallbacks ("debate|cabinet"): the first one on screen is highlighted
    const el = t.target.split('|').map((id) => document.querySelector(`[data-coach="${id}"]`)).find(Boolean) ?? null;
    el?.scrollIntoView({ block: 'center', behavior: 'auto' });
    const upd = () => setRect(el?.getBoundingClientRect() ?? null);
    upd();
    window.addEventListener('resize', upd); window.addEventListener('scroll', upd, true);
    return () => { window.removeEventListener('resize', upd); window.removeEventListener('scroll', upd, true); };
  }, [t.target]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onSkip(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onSkip]);
  const below = rect ? rect.top < window.innerHeight / 2 : true;
  return (
    <div className="q-coach" role="dialog" aria-label={`Tutorial step ${step + 1} of ${TUTORIAL.length}: ${t.title}`}>
      {rect && <div className="q-coach__hole" style={{ top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: Math.min(rect.height + 12, window.innerHeight * 0.6) }} />}
      <div className="q-coach__card" style={below ? { top: Math.min((rect?.bottom ?? 80) + 14, window.innerHeight - 220) } : { bottom: Math.max(window.innerHeight - (rect?.top ?? 0) + 14, 16) }}>
        <p className="q-kicker">Tutorial {step + 1}/{TUTORIAL.length}</p>
        <h3>{t.title}</h3>
        <p className="q-small">{t.body}</p>
        <div className="q-coach__btns">
          <button className="btn q-btn-ghost q-btn-sm" onClick={onSkip}>Skip tutorial</button>
          <button className="btn btn--accent q-btn-sm" onClick={onNext} autoFocus>{step === TUTORIAL.length - 1 ? 'Got it' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}

export { signed };
