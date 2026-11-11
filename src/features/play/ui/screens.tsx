import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { m } from 'framer-motion';
import type { AchievementId, GameState, NewGameOptions } from '../engine/types';
import { achGlyph, api, CONTENT, groupGlyph, lawById, PARTY_SWATCHES, partyColor, partyName, SEATS_TOTAL } from './adapter';
import { seeded } from './fx';
import { Portrait } from './portrait';
import { ScenarioPicker, type V2Options } from './v2';
import { sfx } from '../audio';

// ---------------------------------------------------------------- Title

const STARS = (() => { const r = seeded('quorum-sky'); return Array.from({ length: 70 }, () => ({ x: r.range(0, 1200), y: r.range(0, 380), s: r.range(0.4, 1.6), d: r.range(0, 4) })); })();
const WINDOWS = (() => { const r = seeded('quorum-windows'); const out: { x: number; y: number; on: boolean; d: number }[] = []; for (let row = 0; row < 2; row++) for (let c = 0; c < 14; c++) out.push({ x: 404 + c * 28, y: 468 + row * 44, on: r.next() < 0.7, d: r.range(0, 6) }); return out; })();

function TitleScene({ rm }: { rm: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (rm) return;
    const el = ref.current; if (!el) return;
    const mv = (e: PointerEvent) => { if (e.pointerType !== 'mouse') return; const x = e.clientX / window.innerWidth - 0.5, y = e.clientY / window.innerHeight - 0.5; el.style.setProperty('--px', x.toFixed(3)); el.style.setProperty('--py', y.toFixed(3)); };
    window.addEventListener('pointermove', mv);
    return () => window.removeEventListener('pointermove', mv);
  }, [rm]);
  return (
    <div ref={ref} className={`q-scene${rm ? '' : ' is-anim'}`} aria-hidden="true">
      <svg className="q-scene__sky q-par q-par--1" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id="q-moon" cx="50%" cy="50%" r="50%"><stop offset="0%" className="q-scene__glow0" /><stop offset="100%" className="q-scene__glow1" /></radialGradient>
        </defs>
        {STARS.map((t, i) => <circle key={i} cx={t.x} cy={t.y} r={t.s} className="q-scene__star" style={{ animationDelay: `${t.d}s` }} />)}
        <circle cx="1010" cy="120" r="190" fill="url(#q-moon)" />
        <circle cx="1010" cy="120" r="40" className="q-scene__moon" />
      </svg>
      <svg className="q-scene__hills q-par q-par--2" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMax slice">
        <path d="M0,520 C140,470 260,500 380,470 C520,430 640,480 760,455 C900,425 1040,470 1200,440 L1200,700 L0,700 Z" className="q-scene__hill1" />
        <path d="M0,590 C200,560 320,585 480,570 C640,555 760,590 940,575 C1060,565 1140,580 1200,575 L1200,700 L0,700 Z" className="q-scene__hill2" />
      </svg>
      <svg className="q-scene__hall q-par q-par--3" viewBox="0 -60 1200 760" preserveAspectRatio="xMidYMax slice">
        {/* The Assembly of Calderra (original illustration) */}
        <g className="q-scene__bldg">
          <rect x="470" y="300" width="260" height="40" />
          <path d="M500,300 Q600,180 700,300 Z" />
          <rect x="590" y="160" width="20" height="40" />
          <path d="M600,120 L604,160 L596,160 Z" />
          <rect x="380" y="380" width="440" height="160" />
          <path d="M370,384 L600,318 L830,384 Z" />
          <rect x="360" y="540" width="480" height="18" />
          <rect x="340" y="558" width="520" height="16" />
          <rect x="320" y="574" width="560" height="16" />
        </g>
        <circle cx="600" cy="356" r="16" className="q-scene__clock" />
        <path d="M600,356 L600,346 M600,356 L607,360" className="q-scene__hands" />
        {Array.from({ length: 9 }, (_, i) => <rect key={i} x={392 + i * 50} y="392" width="14" height="148" className="q-scene__col" />)}
        {WINDOWS.map((w, i) => w.on && <rect key={i} x={w.x} y={w.y} width="9" height="18" rx="4" className="q-scene__win" style={{ animationDelay: `${w.d}s` }} />)}
        <g className="q-scene__flag"><line x1="600" y1="120" x2="600" y2="70" /><path d="M600,72 Q626,66 650,76 Q626,86 600,90 Z" className="q-scene__banner" /></g>
        {[250, 950].map((x) => <g key={x} className="q-scene__lamp"><rect x={x - 3} y="470" width="6" height="120" /><circle cx={x} cy="466" r="9" className="q-scene__lampglow" /><circle cx={x} cy="466" r="44" className="q-scene__lamphalo" /></g>)}
      </svg>
      <div className="q-scene__fog q-par q-par--4" />
      <div className="q-scene__vignette" />
    </div>
  );
}

function Seal() {
  return (
    <svg className="q-seal" viewBox="-50 -50 100 100" aria-hidden="true">
      <path d={Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; const r = i % 2 ? 44 : 48; return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`; }).join('') + 'Z'} className="q-seal__wax" />
      <circle r="34" className="q-seal__ring" />
      {Array.from({ length: 9 }, (_, i) => { const a = Math.PI * 0.62 + (i / 8) * Math.PI * 0.76; return <g key={i}><ellipse cx={Math.cos(a) * 26} cy={Math.sin(a) * 26} rx="5" ry="2.2" transform={`rotate(${(a * 180) / Math.PI + 70} ${Math.cos(a) * 26} ${Math.sin(a) * 26})`} className="q-seal__leaf" /><ellipse cx={-Math.cos(a) * 26} cy={Math.sin(a) * 26} rx="5" ry="2.2" transform={`rotate(${-(a * 180) / Math.PI - 70} ${-Math.cos(a) * 26} ${Math.sin(a) * 26})`} className="q-seal__leaf" /></g>; })}
      <text y="12" textAnchor="middle" className="q-seal__q">Q</text>
    </svg>
  );
}

export function TitleScreen({ canContinue, continueLabel = 'Continue', best, muted, rm, onContinue, onNew, onHow, onToggleMute, onSettings, extra }: {
  canContinue: boolean; continueLabel?: string; best: number; muted: boolean; rm: boolean;
  onContinue: () => void; onNew: () => void; onHow: () => void; onToggleMute: () => void; onSettings: () => void; extra?: ReactNode;
}) {
  const word = 'QUORUM';
  return (
    <section className="q-title" aria-labelledby="q-logo">
      <TitleScene rm={rm} />
      <div className="q-title__body">
        <m.div initial={rm ? false : { scale: 0.4, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ delay: 0.2, type: 'spring', stiffness: 160, damping: 14 }}><Seal /></m.div>
        <p className="q-kicker q-title__kick">A PolTok original strategy game</p>
        <h1 id="q-logo" className="q-logo" aria-label={word}>
          {word.split('').map((ch, i) => (
            <m.span key={i} aria-hidden="true" initial={rm ? false : { opacity: 0, y: 30, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.45 + i * 0.09, duration: 0.6, ease: [0.2, 0.9, 0.3, 1] }}>{ch}</m.span>
          ))}
        </h1>
        <m.p className="q-logo__sub" initial={rm ? false : { opacity: 0, letterSpacing: '0.9em' }} animate={{ opacity: 1, letterSpacing: '0.32em' }} transition={{ delay: 1.1, duration: 1 }}>The Calderra Ledger</m.p>
        <m.div initial={rm ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4, duration: 0.5 }}>
          <p className="q-title__pitch">Found a party in a newborn harbor republic. Three eras, 1871 to 1918. Seventy-two seats. Thirty-seven to pass anything.</p>
          <div className="q-title__btns">
            {canContinue && <button className="btn btn--accent q-btn-lg" onClick={onContinue} data-autofocus>{continueLabel}</button>}
            <button className={`btn q-btn-lg${canContinue ? ' q-btn-ghost' : ' btn--accent'}`} onClick={onNew} {...(canContinue ? {} : { 'data-autofocus': true })}>New Game</button>
            {extra}
            <button className="btn q-btn-ghost q-btn-lg" onClick={onHow}>How to Play</button>
          </div>
          <div className="q-title__foot">
            <button className="q-iconbtn" onClick={onToggleMute} aria-pressed={!muted} aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Mute'}>{muted ? '🔇' : '🔊'}</button>
            <button className="q-iconbtn" onClick={onSettings} aria-label="Settings">⚙</button>
            {best > 0 && <span className="q-muted">Best score <b className="q-num">{best}</b></span>}
          </div>
        </m.div>
      </div>
    </section>
  );
}

export function HowToPlay() {
  return (
    <div className="q-how">
      <h2>How to play</h2>
      <ol>
        <li><b>Found a party</b> and pick its place on two axes: economic (left–right) and social (traditional–progressive).</li>
        <li>Each turn you have <b>3 Action Points</b>: campaign in a region, court an interest group, draft a law, lobby a rival or repeal a law.</li>
        <li>Bills go to the <b>Assembly</b>. You see the forecast first. Spend <b>Political Capital</b> to whip wavering blocs. A bill needs more YES than NO and at least 25 YES (48 for entrenched laws).</li>
        <li>A bill short of votes can take one <b>amendment</b> on the roll-call screen: it wins over a target bloc, at a cost in treasury or Political Capital.</li>
        <li>Most turns bring a <b>debate</b> or press conference (1 AP). Bold answers win more but can backfire.</li>
        <li>Your <b>cabinet</b> (Cabinet &amp; Party tab) gives a bonus per filled post. Keep your three party <b>wings</b> content or they rebel, defect or challenge your leadership.</li>
        <li>Every 4 turns there's an <b>election</b>. 37 of 72 seats governs alone; otherwise build a coalition.</li>
        <li>Watch the <b>budget</b>: debt over 300 bankrupts the republic.</li>
      </ol>
      <p className="q-muted">Keys: <kbd>1</kbd>–<kbd>5</kbd> actions, <kbd>E</kbd> end turn, <kbd>Z</kbd> undo, <kbd>M</kbd> map, <kbd>Esc</kbd> pause. Hover, focus or long-press any number for details.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Party founding

export function SetupScreen({ onStart, onBack, achievements = [] }: { onStart: (o: NewGameOptions) => void; onBack: () => void; achievements?: string[] }) {
  const [v2, setV2] = useState<V2Options>({ scenarioId: 'sandbox', difficulty: 'normal', perks: [] });
  const [name, setName] = useState('Lantern Union');
  const [color, setColor] = useState(PARTY_SWATCHES[0]);
  const [ideo, setIdeo] = useState('commonwealth');
  const [custom, setCustom] = useState<[number, number]>([0, 0]);
  const pad = useRef<HTMLDivElement>(null);
  const axes = ideo === 'custom' ? custom : (() => { const d = CONTENT.ideologies.find((i) => i.id === ideo)!; return [d.economic ?? 0, d.social ?? 0] as [number, number]; })();
  const opts: NewGameOptions = { partyName: name.trim() || 'Unnamed Party', color, ideologyId: ideo, economic: axes[0], social: axes[1], ...v2 };
  const preview = useMemo(() => { try { return api.newGame({ ...opts, seed: 1 }).approval; } catch { return null; } }, [ideo, axes[0], axes[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const setFromPointer = (e: React.PointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
    setCustom([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
  };
  return (
    <section className="q-setup" aria-labelledby="q-setup-h">
      <header className="q-setup__head">
        <button className="q-iconbtn" onClick={onBack} aria-label="Back to title">←</button>
        <h2 id="q-setup-h">Found your party</h2>
      </header>
      <div className="q-setup__grid">
        <div className="q-card">
          <div className="q-setup__leader"><Portrait seed={`${name.trim() || 'Unnamed Party'}·leader`} color={color} size={64} label="Your party leader" /><p className="q-small q-muted">Your party leader. The face follows the name you choose.</p></div>
          <label className="q-field">
            <span className="q-label">Party name</span>
            <input className="q-input" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
            <span className="q-muted q-small">{name.length}/24</span>
          </label>
          <div className="q-label" id="q-sw">Color</div>
          <div className="q-swatches" role="radiogroup" aria-labelledby="q-sw">
            {PARTY_SWATCHES.map((c, i) => (
              <button key={c} role="radio" aria-checked={color === c} aria-label={`Color ${i + 1}`} className={`q-swatch${color === c ? ' is-on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); sfx.click(); }} />
            ))}
          </div>
          <div className="q-label" id="q-ideo">Ideology</div>
          <div className="q-ideos" role="radiogroup" aria-labelledby="q-ideo">
            {CONTENT.ideologies.map((d) => {
              const [n, sub] = d.name.split(' (');
              return (
                <button key={d.id} role="radio" aria-checked={ideo === d.id} className={`q-ideo${ideo === d.id ? ' is-on' : ''}`} onClick={() => { setIdeo(d.id); sfx.click(); }}>
                  <b>{n}</b><span>{sub ? sub.replace(')', '') : 'drag the pad'}</span>
                </button>
              );
            })}
          </div>
          {ideo === 'custom' && (
            <div className="q-pad-wrap">
              <div ref={pad} className="q-pad" role="slider" tabIndex={0} aria-label="Custom ideology"
                aria-valuetext={`Economic ${custom[0]}, social ${custom[1]}`} aria-valuenow={custom[0]} aria-valuemin={-1} aria-valuemax={1}
                onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); setFromPointer(e); }}
                onPointerMove={(e) => { if (e.buttons) setFromPointer(e); }}
                onKeyDown={(e) => {
                  const st = 0.1; const [x, y] = custom; const c = (v: number) => Math.round(Math.max(-1, Math.min(1, v)) * 10) / 10;
                  const mv: Record<string, [number, number]> = { ArrowLeft: [c(x - st), y], ArrowRight: [c(x + st), y], ArrowUp: [x, c(y + st)], ArrowDown: [x, c(y - st)] };
                  if (mv[e.key]) { e.preventDefault(); setCustom(mv[e.key]); }
                }}>
                <span className="q-pad__ax q-pad__ax--t">Progressive</span><span className="q-pad__ax q-pad__ax--b">Traditional</span>
                <span className="q-pad__ax q-pad__ax--l">Left</span><span className="q-pad__ax q-pad__ax--r">Right</span>
                {CONTENT.rivals.map((r) => <span key={r.id} className="q-pad__rival" style={{ left: `${(r.economic + 1) * 50}%`, top: `${(1 - r.social) * 50}%`, background: r.color }} title={r.name} />)}
                <span className="q-pad__dot" style={{ left: `${(custom[0] + 1) * 50}%`, top: `${(1 - custom[1]) * 50}%`, background: color }} />
              </div>
              <p className="q-muted q-small">Economic {custom[0]}, social {custom[1]}. Arrow keys work too.</p>
            </div>
          )}
        </div>
        <ScenarioPicker value={v2} onChange={setV2} achievements={achievements} />
        <div className="q-card">
          <div className="q-label">Starting approval</div>
          <ul className="q-bars" aria-label="Starting approval by group">
            {CONTENT.groups.map((g) => {
              const v = Math.round(preview?.[g.id] ?? 50);
              return (
                <li key={g.id} className="q-bar">
                  <span className="q-bar__ic" aria-hidden="true">{groupGlyph(g.id)}</span>
                  <span className="q-bar__name">{g.name}</span>
                  <span className="q-bar__track"><m.span className="q-bar__fill" animate={{ width: `${v}%` }} style={{ background: color }} /></span>
                  <span className="q-bar__val q-num">{v}</span>
                </li>
              );
            })}
          </ul>
          <button className="btn btn--accent q-btn-lg q-wide" onClick={() => onStart(opts)}>Found the Party</button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- End screen

export const ACHIEVEMENTS: Record<AchievementId, { name: string; desc: string; icon: string }> = {
  unanimous: { name: 'Unanimous', desc: 'A vote with 0 NO', icon: '✋' },
  kingmaker: { name: 'Kingmaker', desc: 'In coalition for 3 terms', icon: '♛' },
  balanced_books: { name: 'Balanced Books', desc: 'Debt 0 at the end', icon: '⚖' },
  green_republic: { name: 'Green Republic', desc: 'Environment above 80', icon: '❦' },
  iron_majority: { name: 'Iron Majority', desc: '40+ seats', icon: '⛨' },
  comeback: { name: 'Comeback', desc: 'From under 10 seats to government', icon: '↺' },
  clean_hands: { name: 'Clean Hands', desc: 'Never whipped', icon: '✧' },
  long_memory: { name: 'Long Memory', desc: 'Never repealed a law', icon: '∞' },
};
const OUTCOME: Record<string, string> = {
  majority: 'Governing majority', coalition: 'Leading a coalition government', minority: 'Governing as a minority',
  junior: 'Junior partner in government', opposition: 'In opposition',
  bankrupt: 'The Republic went bankrupt', collapse: 'National collapse', dissolved: 'Party dissolved', ousted: 'Ousted by your own party',
};

/** Outcomes that end the game early, with a line on what happened. */
const LOSS_NOTE: Record<string, (s: GameState) => string> = {
  bankrupt: () => 'Debt passed the limit and the Treasury defaulted. Creditors took the Republic\'s accounts out of your hands.',
  collapse: () => 'The state of the nation fell apart. The Assembly was suspended.',
  dissolved: () => 'Two elections in a row below the threshold. Your party was wound up.',
  ousted: (s) => `Your own party voted you out as leader in turn ${s.lastChallenge || s.turn}${s.challengesSurvived ? `, after surviving ${s.challengesSurvived} earlier challenge${s.challengesSurvived > 1 ? 's' : ''}` : ''}. The score counts up to that day.`,
};

export function EndScreen({ s, best, onNew, onTitle }: { s: GameState; best: number; onNew: () => void; onTitle: () => void }) {
  const sc = api.score(s);
  const [copied, setCopied] = useState(false);
  const seatsSeries = s.elections.map((e) => e.seats.player ?? 0);
  const laws = s.votes.filter((v) => v.tally.passes);
  const share = async () => {
    const txt = `QUORUM: The Calderra Ledger — ${s.player.name}${s.daily ? ` · Daily ${s.daily}` : ''}\n${sc.rank} · ${sc.total} pts · ${OUTCOME[s.outcome ?? ''] ?? ''}\nSeats by election: ${seatsSeries.join(' → ') || '—'}\nLaws enacted: ${s.enacted.length}\nAchievements: ${(sc.allAchievements ?? sc.achievements).map((a) => CONTENT.achievements.find((x) => x.id === a)?.name ?? a).join(', ') || 'none'}`;
    try { await navigator.clipboard.writeText(txt); setCopied(true); } catch { setCopied(false); }
  };
  const W = 240, H = 56, max = 72;
  const path = seatsSeries.map((v, i) => `${i ? 'L' : 'M'}${(seatsSeries.length < 2 ? W / 2 : (i * W) / (seatsSeries.length - 1)).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`).join('');
  return (
    <section className={`q-end${s.outcome && LOSS_NOTE[s.outcome] ? ' is-loss' : ''}`} aria-labelledby="q-end-h" data-outcome={s.outcome ?? undefined}>
      <p className="q-kicker">{OUTCOME[s.outcome ?? ''] ?? 'Game over'}</p>
      <h2 id="q-end-h" className="q-end__rank">{sc.rank}</h2>
      {s.outcome && LOSS_NOTE[s.outcome] && <p className="q-end__loss" role="status">{LOSS_NOTE[s.outcome](s)}</p>}
      <div className="q-end__score"><span className="q-num">{sc.total}</span> points {sc.total >= best && sc.total > 0 && <span className="q-pill">New best</span>}</div>
      <div className="q-end__grid">
        <div className="q-card">
          <div className="q-label">Score</div>
          <dl className="q-dl">
            <dt>Laws as proposer</dt><dd className="q-num">{sc.laws}</dd>
            <dt>Seats over elections</dt><dd className="q-num">{sc.seats}</dd>
            <dt>Time in government</dt><dd className="q-num">{sc.government}</dd>
            <dt>State of the nation</dt><dd className="q-num">{sc.stats}</dd>
            <dt>Debt</dt><dd className="q-num">{sc.debt > 0 ? -sc.debt : sc.debt}</dd>
            {sc.bonus ? <><dt>Scenario goals</dt><dd className="q-num">+{sc.bonus}</dd></> : null}
            {sc.multiplier && sc.multiplier !== 1 ? <><dt>Difficulty</dt><dd className="q-num">×{sc.multiplier}</dd></> : null}
          </dl>
          {sc.goals?.length ? <><div className="q-label">Goals</div><ul className="q-goals__list">{sc.goals.map((g) => <li key={g.id} className={g.done ? 'is-done' : ''}><span aria-hidden="true">{g.done ? '✔' : '○'}</span> {g.text} <small className="q-muted">+{g.bonus}</small></li>)}</ul></> : null}
          <div className="q-label">Seats over time</div>
          <svg viewBox={`-4 -4 ${W + 8} ${H + 8}`} className="q-spark" role="img" aria-label={`Seats by election: ${seatsSeries.join(', ') || 'no elections'}`}>
            <line x1="0" x2={W} y1={H - (37 / max) * H} y2={H - (37 / max) * H} className="q-spark__maj" />
            {path && <path d={path} style={{ stroke: s.player.color }} />}
            {seatsSeries.map((v, i) => <circle key={i} cx={seatsSeries.length < 2 ? W / 2 : (i * W) / (seatsSeries.length - 1)} cy={H - (v / max) * H} r="3" style={{ fill: s.player.color }} />)}
          </svg>
        </div>
        <div className="q-card">
          <div className="q-label">Achievements</div>
          <ul className="q-ach">
            {CONTENT.achievements.map((a) => {
              const on = (sc.allAchievements ?? sc.achievements).includes(a.id);
              return <li key={a.id} className={on ? 'is-on' : ''}><span aria-hidden="true">{achGlyph(a.icon)}</span><b>{a.name}</b><small>{a.desc}</small><span className="q-sr">{on ? 'earned' : 'not earned'}</span></li>;
            })}
          </ul>
        </div>
        <div className="q-card q-end__laws">
          <div className="q-label">Timeline of laws</div>
          {laws.length ? (
            <ol className="q-timeline">
              {laws.map((v, i) => (
                <li key={i}><span className="q-num">T{v.turn}</span> {v.tally.kind === 'repeal' ? 'Repealed ' : ''}{lawById(v.tally.lawId)?.name ?? v.tally.lawId}
                  <span className="q-dot" style={{ background: partyColor(s, v.proposer) }} title={partyName(s, v.proposer)} /></li>
              ))}
            </ol>
          ) : <p className="q-muted">No laws passed.</p>}
        </div>
      </div>
      <div className="q-end__btns">
        <button className="btn btn--accent q-btn-lg" onClick={onNew} data-autofocus>New Game</button>
        <button className="btn q-btn-ghost q-btn-lg" onClick={share}>{copied ? 'Copied!' : 'Share'}</button>
        <button className="btn q-btn-ghost q-btn-lg" onClick={onTitle}>Title</button>
      </div>
    </section>
  );
}
