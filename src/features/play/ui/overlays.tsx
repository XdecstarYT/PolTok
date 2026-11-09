import { useEffect, useLayoutEffect, useState } from 'react';
import { m } from 'framer-motion';
import type { EraDef, EventDef, GameState, LogEntry } from '../engine/types';
import { CONTENT, groupGlyph, groupName, signed, STAT_ICON, STAT_LABEL, STATS } from './adapter';
import { Delta } from './visuals';
import type { Prefs } from './storage';

export function EventCard({ ev, s, rm, onChoose }: { ev: EventDef; s: GameState; rm: boolean; onChoose: (c: 0 | 1) => void }) {
  return (
    <m.div className="q-event" initial={rm ? false : { rotateY: 90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ duration: 0.45 }}>
      <p className="q-kicker">Turn {s.turn} · Dispatch</p>
      <h2 className="q-event__t">{ev.title}</h2>
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
            </span>
          </button>
        ))}
      </div>
    </m.div>
  );
}

export function TurnSummary({ prev, s, log, onClose }: { prev: GameState; s: GameState; log: LogEntry[]; onClose: () => void }) {
  const dT = Math.round(s.treasury - prev.treasury), dD = Math.round(s.debt - prev.debt);
  const shown = log.filter((l) => l.kind !== 'error' && l.kind !== 'info').slice(0, 14);
  return (
    <div className="q-sum">
      <p className="q-kicker">End of turn {prev.turn}</p>
      <h2>The Ledger</h2>
      <div className="q-sum__grid">
        <div className="q-stat"><span>Treasury</span><b className="q-num">{Math.round(s.treasury)}</b><Delta n={dT} /></div>
        <div className="q-stat"><span>Debt</span><b className="q-num">{Math.round(s.debt)}</b><Delta n={-dD} /></div>
        <div className="q-stat"><span>Pol. capital</span><b className="q-num">{s.politicalCapital}</b><Delta n={s.politicalCapital - prev.politicalCapital} /></div>
        <div className="q-stat"><span>Seats</span><b className="q-num">{s.seats.player ?? 0}</b><Delta n={(s.seats.player ?? 0) - (prev.seats.player ?? 0)} /></div>
      </div>
      <SumChanges label="Approval" items={CONTENT.groups.map((g) => ({ k: g.id, icon: groupGlyph(g.id), name: g.name.split(' ').pop() ?? g.name, full: g.name, n: Math.round((s.approval[g.id] ?? 0) - (prev.approval[g.id] ?? 0)) }))} />
      <SumChanges label="Nation" items={STATS.map((k) => ({ k, icon: STAT_ICON[k], name: STAT_LABEL[k], full: STAT_LABEL[k], n: Math.round(s.stats[k] - prev.stats[k]) }))} />
      {shown.length > 0 && <ul className="q-sum__log">{shown.map((l, i) => <li key={i} className={`q-news__${l.kind}`}>{l.kind === 'event' && !String(l.text).includes(':') ? `Dispatch: ${l.text}` : l.text}</li>)}</ul>}
      <button className="btn btn--accent q-btn-lg q-wide" onClick={onClose} data-autofocus>Continue</button>
    </div>
  );
}

function SumChanges({ label, items }: { label: string; items: { k: string; icon: string; name: string; full: string; n: number }[] }) {
  const moved = items.filter((x) => x.n !== 0);
  return (
    <div className="q-sum__row">
      <span className="q-label">{label}</span>
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
      <label className="q-toggle"><input type="checkbox" checked={!prefs.muted} onChange={(e) => setPrefs({ ...prefs, muted: !e.target.checked })} /> Sound effects</label>
      <label className="q-field"><span className="q-label">Volume {Math.round(prefs.volume * 100)}%</span>
        <input type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => setPrefs({ ...prefs, volume: Number(e.target.value) })} disabled={prefs.muted} /></label>
      <label className="q-toggle"><input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => setPrefs({ ...prefs, reduceMotion: e.target.checked })} /> Reduce motion</label>
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
  { target: 'endturn', title: 'End the turn', body: 'Unspent AP is lost. Ending the turn collects income, pays upkeep and holds any uncalled votes.' },
  { target: 'endturn', title: 'First election in 3 turns', body: 'Every 4 turns Calderra votes. Campaign in regions and keep your groups happy before turn 4.' },
];

export function Coach({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const t = TUTORIAL[step];
  const [rect, setRect] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const el = document.querySelector(`[data-coach="${t.target}"]`);
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
