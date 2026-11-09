import { useMemo, useRef, useState } from 'react';
import { m } from 'framer-motion';
import type { AchievementId, GameState, NewGameOptions } from '../engine/types';
import { api, CONTENT, groupGlyph, lawById, PARTY_SWATCHES, partyColor, partyName, SEATS_TOTAL } from './adapter';
import { Hemicycle } from './visuals';
import { sfx } from '../audio';

// ---------------------------------------------------------------- Title

export function TitleScreen({ canContinue, best, muted, rm, onContinue, onNew, onHow, onToggleMute, onSettings }: {
  canContinue: boolean; best: number; muted: boolean; rm: boolean;
  onContinue: () => void; onNew: () => void; onHow: () => void; onToggleMute: () => void; onSettings: () => void;
}) {
  const colors = useMemo(() => Array.from({ length: SEATS_TOTAL }, (_, i) => [CONTENT.rivals[0].color, PARTY_SWATCHES[0], CONTENT.rivals[1].color, CONTENT.rivals[2].color][Math.floor((i / SEATS_TOTAL) * 4)]), []);
  return (
    <section className="q-title" aria-labelledby="q-logo">
      <div className={`q-title__bg${rm ? '' : ' is-anim'}`} aria-hidden="true"><Hemicycle colors={colors} label="" rm={rm} /></div>
      <div className="q-title__body">
        <p className="q-kicker">A PolTok original strategy game</p>
        <h1 id="q-logo" className="q-logo">QUORUM</h1>
        <p className="q-logo__sub">The Calderra Ledger</p>
        <p className="q-title__pitch">Found a party in a newborn harbor republic. 24 turns. 72 seats. 37 to pass anything.</p>
        <div className="q-title__btns">
          {canContinue && <button className="btn btn--accent q-btn-lg" onClick={onContinue} data-autofocus>Continue</button>}
          <button className={`btn q-btn-lg${canContinue ? ' q-btn-ghost' : ' btn--accent'}`} onClick={onNew}>New Game</button>
          <button className="btn q-btn-ghost q-btn-lg" onClick={onHow}>How to Play</button>
        </div>
        <div className="q-title__foot">
          <button className="q-iconbtn" onClick={onToggleMute} aria-pressed={!muted} aria-label={muted ? 'Sound off. Turn sound on' : 'Sound on. Mute'}>{muted ? '🔇' : '🔊'}</button>
          <button className="q-iconbtn" onClick={onSettings} aria-label="Settings">⚙</button>
          {best > 0 && <span className="q-muted">Best score <b className="q-num">{best}</b></span>}
        </div>
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
        <li>Every 4 turns there's an <b>election</b>. 37 of 72 seats governs alone; otherwise build a coalition.</li>
        <li>Watch the <b>budget</b>: debt over 300 bankrupts the republic.</li>
      </ol>
      <p className="q-muted">Keys: <kbd>1</kbd>–<kbd>5</kbd> actions, <kbd>E</kbd> end turn, <kbd>M</kbd> map, <kbd>Esc</kbd> pause.</p>
    </div>
  );
}

// ---------------------------------------------------------------- Party founding

export function SetupScreen({ onStart, onBack }: { onStart: (o: NewGameOptions) => void; onBack: () => void }) {
  const [name, setName] = useState('Lantern Union');
  const [color, setColor] = useState(PARTY_SWATCHES[0]);
  const [ideo, setIdeo] = useState('commonwealth');
  const [custom, setCustom] = useState<[number, number]>([0, 0]);
  const pad = useRef<HTMLDivElement>(null);
  const axes = ideo === 'custom' ? custom : (() => { const d = CONTENT.ideologies.find((i) => i.id === ideo)!; return [d.economic ?? 0, d.social ?? 0] as [number, number]; })();
  const opts: NewGameOptions = { partyName: name.trim() || 'Unnamed Party', color, ideologyId: ideo, economic: axes[0], social: axes[1] };
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
  majority: 'Governing majority', coalition: 'In coalition government', opposition: 'In opposition',
  bankrupt: 'The Republic went bankrupt', collapse: 'National collapse', dissolved: 'Party dissolved',
};

export function EndScreen({ s, best, onNew, onTitle }: { s: GameState; best: number; onNew: () => void; onTitle: () => void }) {
  const sc = api.score(s);
  const [copied, setCopied] = useState(false);
  const seatsSeries = s.elections.map((e) => e.seats.player ?? 0);
  const laws = s.votes.filter((v) => v.tally.passes);
  const share = async () => {
    const txt = `QUORUM: The Calderra Ledger — ${s.player.name}\n${sc.rank} · ${sc.total} pts · ${OUTCOME[s.outcome ?? ''] ?? ''}\nSeats by election: ${seatsSeries.join(' → ') || '—'}\nLaws enacted: ${s.enacted.length}\nAchievements: ${sc.achievements.map((a) => ACHIEVEMENTS[a].name).join(', ') || 'none'}`;
    try { await navigator.clipboard.writeText(txt); setCopied(true); } catch { setCopied(false); }
  };
  const W = 240, H = 56, max = 72;
  const path = seatsSeries.map((v, i) => `${i ? 'L' : 'M'}${(seatsSeries.length < 2 ? W / 2 : (i * W) / (seatsSeries.length - 1)).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`).join('');
  return (
    <section className="q-end" aria-labelledby="q-end-h">
      <p className="q-kicker">{OUTCOME[s.outcome ?? ''] ?? 'Game over'}</p>
      <h2 id="q-end-h" className="q-end__rank">{sc.rank}</h2>
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
          </dl>
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
            {(Object.keys(ACHIEVEMENTS) as AchievementId[]).map((a) => {
              const on = sc.achievements.includes(a);
              return <li key={a} className={on ? 'is-on' : ''}><span aria-hidden="true">{ACHIEVEMENTS[a].icon}</span><b>{ACHIEVEMENTS[a].name}</b><small>{ACHIEVEMENTS[a].desc}</small><span className="q-sr">{on ? 'earned' : 'not earned'}</span></li>;
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
