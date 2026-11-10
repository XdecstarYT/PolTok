// UI for the v2 engine systems: cabinet & characters, party wings, debates, amendments, scenarios/difficulty,
// perks, daily challenge. Everything here reads the engine's public API (docs/game/v2-api.md).
import { useEffect, useState, type ReactNode } from 'react';
import { m } from 'framer-motion';
import {
  activeCharacters, amendmentsFor, cabinetEffects, challengeOdds, CHARACTERS, competence, CONSTANTS, CONTENT as ECONTENT, currentDebate, dailyChallenge,
  debateChoice, DIFFICULTIES, PERKS, POSTS, POST_IDS, SCENARIOS, scenarioGoals, TRAITS, unlockedPerks, WINGS, wingMood, wingReaction,
} from '../engine';
import type { Action, ApplyResult, CharacterId, DifficultyId, GameState, LawDef, PerkId, PostId, ScenarioId, VoteTally, WingId } from '../engine/types';
import { achGlyph, canDo, groupGlyph, groupName, lawById, partyColor, partyName, rivalDef, signed } from './adapter';
import { Delta } from './visuals';
import { Num, Tip, tip } from './fx';
import { Portrait } from './portrait';
import { leaderSeed } from './game';
import { sfx } from '../audio';

type Act = (a: Action) => ApplyResult | null | void;
const WING_COLOR: Record<string, string> = { reformers: '#4f8fd6', pragmatists: '#c9a24a', traditionalists: '#a8574a' };
export const wingColor = (w: WingId) => WING_COLOR[w] ?? '#888';
export const charName = (id: CharacterId) => CHARACTERS[id]?.name ?? id;
const MOOD_LABEL: Record<string, string> = { content: 'Content', restless: 'Restless', rebellious: 'Rebellious', revolt: 'In revolt' };

// ---------------------------------------------------------------- faction meter

export function FactionMeter({ s, rm, compact }: { s: GameState; rm: boolean; compact?: boolean }) {
  let moods; try { moods = wingMood(s); } catch { return null; }
  if (!moods?.length) return null;
  return (
    <div className={`q-wings${compact ? ' is-compact' : ''}`} aria-label="Party wings">
      {!compact && <p className="q-small q-muted q-wings__note">Your own party has three wings. Unhappy wings rebel on bills they dislike; in revolt they rebel on everything.</p>}
      <ul className="q-wings__list">
        {moods.map((w) => {
          const def = WINGS[w.id];
          return (
            <li key={w.id} className={`q-wing is-${w.mood}`} tabIndex={0}
              {...tip(<span className="q-tip__body"><b>{w.name}</b><span className="q-tip__row">{def?.blurb}</span><span className="q-tip__row">Happiness <b className="q-num">{Math.round(w.happiness)}</b>{w.trend ? <> ({signed(w.trend)} this turn)</> : null} · {MOOD_LABEL[w.mood]}</span><span className="q-tip__row">Controls <b className="q-num">{w.seats}</b> of your seats</span>{def && <span className="q-tip__row">Likes {def.likes.join(', ') || 'nothing in particular'}{def.dislikes.length ? `; dislikes ${def.dislikes.join(', ')}` : ''}</span>}<span className="q-tip__row q-muted">Content 55+, restless 35+, rebellious 20+, revolt below 20.</span></span>)}>
              <span className="q-wing__sw" style={{ background: wingColor(w.id) }} aria-hidden="true" />
              <span className="q-wing__n">{w.name}<small>{w.seats} seats · {MOOD_LABEL[w.mood]}</small></span>
              <span className="q-wing__track" aria-hidden="true">
                <m.span className="q-wing__fill" initial={false} animate={{ width: `${w.happiness}%` }} transition={{ duration: rm ? 0 : 0.5 }} style={{ background: wingColor(w.id) }} />
                <i style={{ left: '20%' }} /><i style={{ left: '35%' }} /><i style={{ left: '55%' }} />
              </span>
              <b className="q-wing__v"><Num value={Math.round(w.happiness)} rm={rm} /><span className={`q-trend ${w.trend > 0 ? 'is-up' : w.trend < 0 ? 'is-down' : ''}`}>{w.trend > 0 ? '▲' : w.trend < 0 ? '▼' : '·'}</span></b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Wing reaction chips for a law card. */
export function WingChips({ s, lawId, kind = 'enact' }: { s: GameState; lawId: string; kind?: 'enact' | 'repeal' }) {
  let r: Partial<Record<WingId, number>> = {}; try { r = wingReaction(s, lawId, kind); } catch { /* ignore */ }
  const e = Object.entries(r).filter(([, n]) => n);
  if (!e.length) return null;
  return (
    <span className="q-wingchips">
      {e.map(([w, n]) => <Tip key={w} content={`${WINGS[w]?.name ?? w} happiness ${signed(n ?? 0)} if this passes`} className="q-wingchip"><i style={{ background: wingColor(w) }} />{WINGS[w]?.name.replace(/^The /, '')} <Delta n={n ?? 0} /></Tip>)}
    </span>
  );
}

/** Player-bloc rebels by wing (vote screen). */
export function wingRebelNote(b: VoteTally['blocs'][number]): ReactNode {
  if (b.party !== 'player' || !b.wingRebels) return null;
  const e = Object.entries(b.wingRebels).filter(([, n]) => n);
  if (!e.length) return null;
  return <small className="q-warn">Rebels: {e.map(([w, n]) => `${n} ${WINGS[w]?.name ?? w}`).join(', ')}</small>;
}

// ---------------------------------------------------------------- cabinet

function Meter({ v, color, label }: { v: number; color?: string; label: string }) {
  return <span className="q-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}><span style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: color }} /></span>;
}

export function CabinetView({ s, rm, act }: { s: GameState; rm: boolean; act: Act }) {
  const [picking, setPicking] = useState<PostId | null>(null);
  let effects: ReturnType<typeof cabinetEffects> = []; try { effects = cabinetEffects(s); } catch { /* ignore */ }
  const bench = (() => { try { return activeCharacters(s); } catch { return []; } })();
  const gone = Object.values(s.characters ?? {}).filter((c) => c.status !== 'active');
  const inGov = s.government.members.includes('player');
  return (
    <section className="q-cabinet" aria-label="Cabinet and party">
      <div className="q-statsview__head"><h2 className="q-h2">{inGov ? 'The Cabinet' : 'The Shadow Cabinet'}</h2><span className="q-small q-muted">{inGov ? 'Ministers act every turn.' : 'In opposition, posts work at half strength.'}</span></div>
      <ul className="q-posts">
        {POST_IDS.map((post) => {
          const eff = effects.find((e) => e.post === post);
          const id = s.cabinet?.[post] ?? null;
          const ch = id ? s.characters[id] : null;
          const def = id ? CHARACTERS[id] : null;
          return (
            <li key={post} className={`q-card q-post${id ? '' : ' is-vacant'}`}>
              <p className="q-kicker">{POSTS[post].name}</p>
              <div className="q-post__who">
                {id && def ? <Portrait seed={def.name} color={wingColor(def.wing)} size={64} label={def.name} /> : <span className="q-post__empty" aria-hidden="true">?</span>}
                <div className="q-post__t">
                  <b>{def?.name ?? 'Vacant'}</b>
                  {def && <small className="q-muted">{TRAITS[def.trait]?.name} · {WINGS[def.wing]?.name}</small>}
                  {id && <span {...tip(`Competence ${Math.round((eff?.competence ?? 0) * 100)}%: how well their trait fits this post.`)} className="q-post__comp"><Meter v={(eff?.competence ?? 0) * 100} color="var(--q-gold)" label="Competence" /><small className="q-num">{Math.round((eff?.competence ?? 0) * 100)}%</small></span>}
                </div>
              </div>
              <p className="q-small q-post__eff">{eff?.text ?? POSTS[post].desc}</p>
              {ch && <p className="q-small q-muted">Loyalty <b className="q-num">{Math.round(ch.loyalty)}</b> · Ambition <b className="q-num">{Math.round(ch.ambition)}</b></p>}
              <div className="q-post__btns">
                <button className="btn q-btn-sm q-btn-ghost" onClick={() => setPicking(picking === post ? null : post)} aria-expanded={picking === post}>{id ? 'Reshuffle' : 'Appoint'}</button>
                {id && <button className="btn q-btn-sm q-btn-ghost" {...tip(`Sack ${def?.name}: loyalty −20`)} disabled={!canDo(s, { type: 'dismiss', post }).valid} onClick={() => { sfx.click(); act({ type: 'dismiss', post }); }}>Dismiss</button>}
              </div>
              {picking === post && (
                <ul className="q-pick" aria-label={`Candidates for ${POSTS[post].name}`}>
                  {bench.filter((c) => c !== id).sort((a, b) => competence(b, post) - competence(a, post)).map((c) => {
                    const a: Action = { type: 'appoint', post, characterId: c };
                    const p = canDo(s, a);
                    const cd = CHARACTERS[c];
                    const cur = s.characters[c]?.post;
                    return (
                      <li key={c}>
                        <button className="q-row" disabled={!p.valid} onClick={() => { sfx.click(); act(a); setPicking(null); }} {...tip(p.valid ? `${cd.name}: ${TRAITS[cd.trait]?.desc}` : p.reason ?? '')}>
                          <Portrait seed={cd.name} color={wingColor(cd.wing)} size={36} />
                          <span className="q-row__t"><b>{cd.name}</b><small className="q-muted">{TRAITS[cd.trait]?.name}{cur ? ` · now ${POSTS[cur].short}` : ''}{p.cost.pc ? ` · ${p.cost.pc} PC` : ''}</small></span>
                          <span className="q-num q-row__v">{Math.round(competence(c, post) * 100)}%</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="q-card">
        <h3 className="q-h3">Party wings</h3>
        <FactionMeter s={s} rm={rm} />
      </div>

      <div className="q-card">
        <h3 className="q-h3">The bench <span className="q-muted q-small">{bench.length} politicians</span></h3>
        <ul className="q-bench">
          {bench.map((c) => {
            const cd = CHARACTERS[c]; const st = s.characters[c];
            const risk = st && st.ambition > 65 && st.loyalty < 45;
            return (
              <li key={c} className={`q-benchp${risk ? ' is-risk' : ''}`} tabIndex={0}
                {...tip(<span className="q-tip__body"><b>{cd.name}</b><span className="q-tip__row">{cd.bio}</span><span className="q-tip__row">{TRAITS[cd.trait]?.name}: {TRAITS[cd.trait]?.desc}</span>{risk && <span className="q-tip__row q-warn">Ambitious and disloyal: a leadership threat.</span>}</span>)}>
                <Portrait seed={cd.name} color={wingColor(cd.wing)} size={48} />
                <span className="q-benchp__t"><b>{cd.name}</b><small className="q-muted">{st?.post ? POSTS[st.post].short : 'Backbench'} · {TRAITS[cd.trait]?.name}</small>
                  <span className="q-benchp__m"><small>Loyal</small><Meter v={st?.loyalty ?? 0} color="var(--q-ok)" label={`Loyalty ${Math.round(st?.loyalty ?? 0)}`} /></span>
                  <span className="q-benchp__m"><small>Ambit.</small><Meter v={st?.ambition ?? 0} color="var(--q-bad)" label={`Ambition ${Math.round(st?.ambition ?? 0)}`} /></span>
                </span>
              </li>
            );
          })}
        </ul>
        {gone.length > 0 && <p className="q-small q-muted">Gone: {gone.map((c) => `${charName(c.id)} (${c.status === 'defected' ? `crossed to ${partyName(s, c.joined ?? '')}` : 'disgraced'})`).join(', ')}</p>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- debate

export function DebateBanner({ s, onOpen }: { s: GameState; onOpen: () => void }) {
  const d = (() => { try { return currentDebate(s); } catch { return null; } })();
  if (!d) return null;
  return (
    <button className="q-card q-debatebanner" onClick={onOpen}>
      <span className="q-debatebanner__ic" aria-hidden="true">{d.kind === 'press' ? '✒' : '⚖'}</span>
      <span className="q-debatebanner__t"><span className="q-kicker">{d.kind === 'press' ? 'Press conference' : 'Assembly debate'} · free, this turn only</span><b>{d.title}</b></span>
      <span className="q-docket__go">Take the floor ›</span>
    </button>
  );
}

export function DebateScene({ s, rm, act, onClose }: { s: GameState; rm: boolean; act: Act; onClose: () => void }) {
  const d = (() => { try { return currentDebate(s); } catch { return null; } })();
  const [res, setRes] = useState<string[] | null>(null);
  const choose = (i: 0 | 1 | 2) => { const r = act({ type: 'debate', choice: i }); if (r) { sfx.gavel(); setRes(r.log.filter((l) => l.kind !== 'info' && l.kind !== 'error').map((l) => l.text)); } };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (res || !d) return; const n = Number(e.key); if (n >= 1 && n <= d.choices.length) { e.preventDefault(); choose((n - 1) as 0 | 1 | 2); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  if (!d && !res) return <div><p>The moment has passed.</p><button className="btn" onClick={onClose}>Back</button></div>;
  const opp = s.government.members.includes('player') ? (Object.keys(s.rivals).sort((a, b) => (s.seats[b] ?? 0) - (s.seats[a] ?? 0))[0]) : s.government.leader ?? Object.keys(s.rivals)[0];
  const oppDef = rivalDef(opp ?? '');
  const tone: Record<string, string> = { rousing: 'Rousing', measured: 'Measured', combative: 'Combative' };
  return (
    <div className={`q-debate is-${d?.kind ?? 'debate'}`}>
      <div className="q-debate__stage" aria-hidden="true">
        <m.div className="q-debate__you" initial={rm ? false : { x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}><Portrait seed={leaderSeed(s)} color={s.player.color} size={92} /><span>{s.player.name}</span></m.div>
        <span className="q-debate__vs">{d?.kind === 'press' ? '✒' : 'vs'}</span>
        <m.div className="q-debate__them" initial={rm ? false : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          {d?.kind === 'press' ? <><Portrait seed={`press·${d.id}`} color="#6b6b6b" size={92} /><span>The Press Gallery</span></> : <><Portrait seed={oppDef?.leader ?? 'opp'} color={oppDef?.color ?? '#888'} size={92} /><span>{oppDef?.leader}</span></>}
        </m.div>
      </div>
      <p className="q-kicker">{d?.kind === 'press' ? 'Press conference' : 'Question time'}</p>
      <h2 className="q-event__t">{d?.title ?? 'The floor is yours'}</h2>
      {d && <p className="q-event__text">“{d.prompt}”</p>}
      {res ? (
        <div className="q-debate__res" role="status">
          {res.map((t, i) => <p key={i}>{t}</p>)}
          <button className="btn btn--accent q-btn-lg q-wide" onClick={onClose} data-autofocus>Return to the chamber</button>
        </div>
      ) : d && (
        <>
          <div className="q-event__choices">
            {d.choices.map((_, i) => {
              const c = debateChoice(s, i as 0 | 1 | 2);
              return (
                <button key={i} className={`q-choice q-choice--${c.tone}`} aria-keyshortcuts={String(i + 1)} onClick={() => choose(i as 0 | 1 | 2)}>
                  <span className="q-choice__k" aria-hidden="true">{i + 1}</span>
                  <b>{c.label}</b>
                  <span className="q-choice__meta"><span className={`q-tone is-${c.tone}`}>{tone[c.tone]}</span>{c.risk > 0 && <Tip content="Chance this line backfires: gains turn into half-size losses and you lose 1 PC." className="q-warn">{Math.round(c.risk * 100)}% backfire risk</Tip>}</span>
                  <span className="q-effects">
                    {Object.entries(c.groupEffects).map(([g, n]) => <Tip key={g} content={`${groupName(g)} ${signed(n)}`}>{groupGlyph(g)} <Delta n={n} /></Tip>)}
                    {Object.entries(c.wings).map(([w, n]) => <Tip key={w} content={`${WINGS[w]?.name} happiness ${signed(n ?? 0)}`} className="q-wingchip"><i style={{ background: wingColor(w) }} /><Delta n={n ?? 0} /></Tip>)}
                    {c.politicalCapital ? <Tip content="Political Capital">★ <Delta n={c.politicalCapital} /></Tip> : null}
                    {Object.entries(c.relations).map(([r, n]) => <Tip key={r} content={`Relation with ${partyName(s, r)} ${signed(n ?? 0)}`}><i className="q-dot" style={{ background: partyColor(s, r) }} /> <Delta n={n ?? 0} /></Tip>)}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="q-vote__btns"><button className="btn q-btn-ghost q-btn-lg" onClick={onClose}>Decline for now</button></div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- amendments

const STANCE_WORD: Record<string, string> = { yes: 'YES', no: 'NO', abstain: 'abstain' };

function AmendOptions({ s, target, onPick, check }: { s: GameState; target: string; onPick: (amendmentId: string) => void; check: (amendmentId: string) => { valid: boolean; reason?: string } }) {
  let opts: ReturnType<typeof amendmentsFor> = []; try { opts = amendmentsFor(s, target); } catch { /* ignore */ }
  if (!opts.length) return <p className="q-small q-muted">No amendment fits this bill.</p>;
  return (
    <ul className="q-amends">
      {opts.map((o) => {
        const a = o.amendment;
        const cost = [a.politicalCapital ? `${a.politicalCapital} PC` : '', a.oneOff ? `${a.oneOff < 0 ? -a.oneOff : `+${a.oneOff}`} treasury` : '', a.upkeep ? (a.upkeep > 0 ? `costs ${a.upkeep}/turn` : `saves ${-a.upkeep}/turn`) : ''].filter(Boolean);
        return (
          <li key={a.id} className={`q-amend${o.flips ? ' is-flip' : ''}`}>
            <div className="q-amend__h"><b>{a.name}</b>{o.flips && <span className="q-amend__badge">Turns it into a PASS</span>}</div>
            <p className="q-small q-muted">{a.desc}</p>
            <p className="q-small">Courts {o.targets.map((t) => <span key={t} className="q-pill"><i className="q-dot" style={{ background: partyColor(s, t) }} /> {partyName(s, t)}</span>)}
              <span className="q-num"> Forecast <b className={o.forecast.passes ? 'q-ok' : 'q-warn'}>{o.forecast.yes}–{o.forecast.no} {o.forecast.passes ? 'PASS' : 'FAIL'}</b></span></p>
            <p className="q-small q-amend__moves">
              {(o.yesGain ?? 0) > 0 && <span className="q-pill q-ok">+{o.yesGain} YES</span>}
              {(o.noDrop ?? 0) > 0 && <span className="q-pill q-ok">−{o.noDrop} NO</span>}
              {!(o.yesGain ?? 0) && !(o.noDrop ?? 0) && <span className="q-muted">No change to the tally</span>}
              {(o.stanceChanges ?? []).map((c) => <span key={c.party} className="q-pill"><i className="q-dot" style={{ background: partyColor(s, c.party) }} /> {partyName(s, c.party)}: {STANCE_WORD[c.from]} → <b>{STANCE_WORD[c.to]}</b></span>)}
              {o.stanceChanges && !o.stanceChanges.length && (o.yesGain ?? 0) > 0 && <span className="q-muted">softens the bloc, no stance moves</span>}
            </p>
            <div className="q-effects">
              {Object.entries(a.groupEffects).map(([g, n]) => <Tip key={g} content={`${groupName(g)} ${signed(n)} if enacted`}>{groupGlyph(g)} <Delta n={n} /></Tip>)}
              {Object.entries(o.wingsDelta).map(([w, n]) => <Tip key={w} content={`${WINGS[w]?.name} ${signed(n ?? 0)}`} className="q-wingchip"><i style={{ background: wingColor(w) }} /><Delta n={n ?? 0} /></Tip>)}
            </div>
            <div className="q-law__foot"><small className="q-muted">{cost.join(' · ') || 'No cost'}</small>{(() => { const v = check(a.id); return <><button className="btn btn--accent q-btn-sm" disabled={!v.valid} onClick={() => onPick(a.id)}>Attach</button>{!v.valid && <small className="q-warn">{v.reason}</small>}</>; })()}</div>
          </li>
        );
      })}
    </ul>
  );
}

/** Drafting with an amendment (law library). */
export function AmendPicker({ s, law, act, onBack }: { s: GameState; law: LawDef; act: Act; onBack: () => void }) {
  const base = (() => { try { return canDo(s, { type: 'draft', lawId: law.id }).forecast; } catch { return undefined; } })();
  return (
    <div className="q-amendpick">
      <button className="q-link" onClick={onBack}>‹ Back to the library</button>
      <p className="q-kicker">Amend before drafting</p>
      <h3 className="q-vote__t">{law.name}</h3>
      {base && <p className="q-small">As written, the forecast is <b className={base.passes ? 'q-ok' : 'q-warn'}>{base.yes}–{base.no} {base.passes ? 'PASS' : 'FAIL'}</b>. An amendment buys a bloc's support at a price.</p>}
      <AmendOptions s={s} target={law.id} check={(id) => canDo(s, { type: 'draft', lawId: law.id, amendment: id })} onPick={(id) => { sfx.ballot(); act({ type: 'draft', lawId: law.id, amendment: id }); }} />
      <button className="btn q-btn-ghost q-btn-lg q-wide" onClick={() => { act({ type: 'draft', lawId: law.id }); }}>Draft it unamended</button>
    </div>
  );
}

/** Amend an already-drafted bill (vote screen). */
export function AmendSlot({ s, itemId, act }: { s: GameState; itemId: string; act: Act }) {
  const [open, setOpen] = useState(false);
  const item = s.docket.find((d) => d.id === itemId);
  if (!item || item.proposer !== 'player' || item.kind !== 'enact') return null;
  if (item.amendment) { const a = ECONTENT.amendments.find((x) => x.id === item.amendment); return <p className="q-small q-amended">Amended: <b>{a?.name}</b></p>; }
  return (
    <div className="q-amendslot">
      <button className="btn q-btn-sm q-btn-ghost" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Hide amendments' : '§ Offer an amendment…'}</button>
      {open && <AmendOptions s={s} target={itemId} check={(id) => canDo(s, { type: 'amend', itemId, amendmentId: id })} onPick={(id) => { sfx.ballot(); act({ type: 'amend', itemId, amendmentId: id }); setOpen(false); }} />}
    </div>
  );
}

// ---------------------------------------------------------------- scenario goals

export function GoalsCard({ s }: { s: GameState }) {
  let goals: ReturnType<typeof scenarioGoals> = []; try { goals = scenarioGoals(s); } catch { /* ignore */ }
  const sc = SCENARIOS[s.scenarioId ?? 'sandbox'];
  if (!sc) return null;
  return (
    <div className="q-goals">
      <p className="q-kicker">{sc.name} · {DIFFICULTIES[s.difficulty ?? 'normal']?.name}{s.daily ? ` · Daily ${s.daily}` : ''}</p>
      <p className="q-small"><b>Goal:</b> {sc.goal}</p>
      {goals.length > 0 && <ul className="q-goals__list">{goals.map((g) => <li key={g.id} className={g.done ? 'is-done' : ''}><span aria-hidden="true">{g.done ? '✔' : '○'}</span> {g.text} <small className="q-muted">+{g.bonus}</small><span className="q-sr">{g.done ? 'done' : 'not yet'}</span></li>)}</ul>}
    </div>
  );
}

/** Leadership challenge odds for a pending challenge event. */
export function ChallengeNote({ s }: { s: GameState }) {
  let o = null; try { o = challengeOdds(s); } catch { /* ignore */ }
  if (!o) return null;
  return <div className="q-challenge" {...tip(<span className="q-tip__body">{o.reasons.map((r, i) => <span key={i} className="q-tip__row">{r}</span>)}</span>)} tabIndex={0}>
    <span className="q-label">Your odds in a confidence ballot</span>
    <span className="q-meter q-meter--lg"><span style={{ width: `${o.winChance * 100}%`, background: o.winChance >= 0.5 ? 'var(--q-ok)' : 'var(--q-bad)' }} /></span>
    <b className="q-num">{Math.round(o.winChance * 100)}%</b>
  </div>;
}

// ---------------------------------------------------------------- new game options

export interface V2Options { scenarioId: ScenarioId; difficulty: DifficultyId; perks: PerkId[] }

export function ScenarioPicker({ value, onChange, achievements }: { value: V2Options; onChange: (v: V2Options) => void; achievements: string[] }) {
  const unlocked = new Set(unlockedPerks(achievements).map((p) => p.id));
  const max = CONSTANTS.MAX_PERKS ?? 2;
  return (
    <div className="q-card">
      <div className="q-label" id="q-scen">Scenario</div>
      <div className="q-opts" role="radiogroup" aria-labelledby="q-scen">
        {ECONTENT.scenarios.map((sc) => (
          <button key={sc.id} role="radio" aria-checked={value.scenarioId === sc.id} className={`q-opt${value.scenarioId === sc.id ? ' is-on' : ''}`} onClick={() => { sfx.click(); onChange({ ...value, scenarioId: sc.id }); }}
            {...tip(<span className="q-tip__body"><b>{sc.name}</b><span className="q-tip__row">{sc.blurb}</span><span className="q-tip__row">{sc.totalTurns - sc.startTurn + 1} turns · elections at turns {sc.electionTurns.join(', ')}</span></span>)}>
            <b>{sc.name}</b><span>{sc.goal}</span>
          </button>
        ))}
      </div>
      <div className="q-label" id="q-diff">Difficulty</div>
      <div className="q-opts q-opts--4" role="radiogroup" aria-labelledby="q-diff">
        {ECONTENT.difficulties.map((d) => (
          <button key={d.id} role="radio" aria-checked={value.difficulty === d.id} className={`q-opt${value.difficulty === d.id ? ' is-on' : ''}`} onClick={() => { sfx.click(); onChange({ ...value, difficulty: d.id }); }}
            {...tip(<span className="q-tip__body"><b>{d.name}</b><span className="q-tip__row">{d.blurb}</span><span className="q-tip__row">Score ×{d.scoreMult}</span></span>)}>
            <b>{d.name}</b><span>Score ×{d.scoreMult}</span>
          </button>
        ))}
      </div>
      <div className="q-label" id="q-perks">Perks <span className="q-muted">({value.perks.length}/{max})</span></div>
      {unlocked.size === 0 ? <p className="q-small q-muted">Earn achievements to unlock perks. See Perks &amp; Records on the title screen.</p> : (
        <div className="q-opts" role="group" aria-labelledby="q-perks">
          {ECONTENT.perks.filter((p) => unlocked.has(p.id)).map((p) => {
            const on = value.perks.includes(p.id);
            return <button key={p.id} aria-pressed={on} className={`q-opt${on ? ' is-on' : ''}`} disabled={!on && value.perks.length >= max} onClick={() => { sfx.click(); onChange({ ...value, perks: on ? value.perks.filter((x) => x !== p.id) : [...value.perks, p.id] }); }}><b>{p.name}</b><span>{p.desc}</span></button>;
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- perks & records screen

export function PerksScreen({ achievements, best, daily, onClose }: { achievements: string[]; best: number; daily?: { date: string; score: number } | null; onClose: () => void }) {
  const got = new Set(achievements);
  const unlocked = new Set(unlockedPerks(achievements).map((p) => p.id));
  return (
    <div className="q-perks">
      <h2 className="q-h2">Perks &amp; Records</h2>
      <p className="q-small q-muted">Every achievement unlocks a perk. Equip up to {CONSTANTS.MAX_PERKS ?? 2} when you found a new party.</p>
      <p className="q-small">Best score <b className="q-num">{best}</b>{daily ? <> · Today’s daily: <b className="q-num">{daily.score}</b></> : null} · Achievements <b className="q-num">{got.size}/{ECONTENT.achievements.length}</b></p>
      <ul className="q-perklist">
        {ECONTENT.perks.map((p) => {
          const ach = ECONTENT.achievements.find((a) => a.id === p.unlockedBy);
          const on = unlocked.has(p.id);
          return (
            <li key={p.id} className={`q-perk${on ? ' is-on' : ''}`}>
              <span className="q-perk__ic" aria-hidden="true">{on ? achGlyph(ach?.icon ?? 'star') : '🔒'}</span>
              <span className="q-perk__t"><b>{p.name}</b><small>{p.desc}</small><small className="q-muted">{on ? 'Unlocked' : 'Locked'} by <b>{ach?.name ?? p.unlockedBy}</b>: {ach?.desc}</small></span>
            </li>
          );
        })}
      </ul>
      <button className="btn btn--accent q-btn-lg q-wide" onClick={onClose} data-autofocus>Done</button>
    </div>
  );
}

export function DailyButton({ done, onStart }: { done: { date: string; score: number } | null; onStart: () => void }) {
  const d = dailyChallenge(new Date());
  const today = done && done.date === d.date;
  return (
    <button className="btn q-btn-ghost q-btn-lg q-daily" onClick={onStart} {...tip(<span className="q-tip__body"><b>Daily challenge · {d.date}</b><span className="q-tip__row">Everyone gets the same seed today: {d.label}.</span>{today && <span className="q-tip__row">Your score today: {done!.score}</span>}</span>)}>
      <span>Daily Challenge</span><small>{d.label}{today ? ` · ${done!.score} pts` : ''}</small>
    </button>
  );
}

export { dailyChallenge, PERKS, lawById };
