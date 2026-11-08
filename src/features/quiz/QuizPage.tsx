/**
 * /quiz — Issues match (official platforms), daily trivia, guess-the-map. Owned by src/features/quiz/**.
 * Nothing is sent to a server: answers & streaks live only in this browser (localStorage, try/catch).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { m, AnimatePresence } from 'framer-motion';
import { Modal, useReducedMotion } from '../../components';
import { useLive } from '../../lib/live';
import { renderCard, cardFileName, type CardData } from '../../lib/cards';
import { stateShape } from '../map/geometry';
import { PARTIES, SCALE, STATEMENTS, scoreParty, type Answer, type Region } from './issues';
import { dailyQuestions, dayKey, mapRounds, calledRaces } from './trivia';
import './quiz.css';

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

type Tab = 'issues' | 'trivia' | 'map';
const TABS: { id: Tab; label: string }[] = [
  { id: 'issues', label: 'Issues match' },
  { id: 'trivia', label: 'Daily trivia' },
  { id: 'map', label: 'Guess the map' },
];

export default function QuizPage() {
  const [sp, setSp] = useSearchParams();
  const tab = (TABS.find((t) => t.id === sp.get('tab'))?.id ?? 'issues') as Tab;
  useEffect(() => { document.title = 'Quiz · PolTok'; }, []);
  return (
    <div className="page page--narrow qz">
      <header className="qz-head">
        <p className="qz-kicker">PolTok Quiz</p>
        <h1>Test your politics</h1>
        <p className="qz-sub">Compare your views with party platforms, play today’s trivia, and call the map.</p>
      </header>
      <div className="qz-tabs" role="tablist" aria-label="Quiz modes">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" id={`qz-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`qz-panel-${t.id}`}
            className={`qz-tab ${tab === t.id ? 'is-on' : ''}`} onClick={() => setSp({ tab: t.id }, { replace: true })}>{t.label}</button>
        ))}
      </div>
      <section role="tabpanel" id={`qz-panel-${tab}`} aria-labelledby={`qz-tab-${tab}`}>
        {tab === 'issues' && <IssuesQuiz />}
        {tab === 'trivia' && <Trivia />}
        {tab === 'map' && <MapGame />}
      </section>
    </div>
  );
}

/* ───────────── Issues match ───────────── */
function IssuesQuiz() {
  const [region, setRegion] = useState<Region>(() => load('qz.region', 'US'));
  const [answers, setAnswers] = useState<Record<string, Answer>>(() => load('qz.answers', {}));
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => save('qz.answers', answers), [answers]);
  useEffect(() => save('qz.region', region), [region]);
  const s = STATEMENTS[i];
  const a = answers[s.id] ?? { v: null, w: 2 };
  const set = (patch: Partial<Answer>) => setAnswers((x) => ({ ...x, [s.id]: { ...a, ...patch } }));
  const answered = STATEMENTS.filter((x) => answers[x.id]?.v != null).length;

  if (done) return <IssuesResults region={region} answers={answers} onBack={() => setDone(false)} onReset={() => { setAnswers({}); setI(0); setDone(false); }} />;
  return (
    <div className="qz-card">
      <Disclaimer />
      <div className="qz-row">
        <span className="qz-label">Compare with</span>
        <div className="qz-seg" role="radiogroup" aria-label="Country">
          {(['US', 'AU'] as Region[]).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={region === r} className={region === r ? 'is-on' : ''} onClick={() => setRegion(r)}>
              {r === 'US' ? 'US parties' : 'Australian parties'}
            </button>
          ))}
        </div>
      </div>
      <div className="qz-progress" aria-hidden="true"><span style={{ width: `${((i + 1) / STATEMENTS.length) * 100}%` }} /></div>
      <AnimatePresence mode="wait">
        <m.div key={s.id} initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          <p className="qz-meta">{i + 1} / {STATEMENTS.length} · {s.topic}</p>
          <h2 className="qz-q" id="qz-stmt">{s.text}</h2>
          <div className="qz-scale" role="radiogroup" aria-labelledby="qz-stmt">
            {SCALE.map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={a.v === o.v} className={`qz-opt ${a.v === o.v ? 'is-on' : ''}`} data-v={o.v} onClick={() => set({ v: o.v })}>{o.label}</button>
            ))}
          </div>
          <div className="qz-row">
            <span className="qz-label" id="qz-w">How important is this to you?</span>
            <div className="qz-seg" role="radiogroup" aria-labelledby="qz-w">
              {([1, 2, 3] as const).map((w) => (
                <button key={w} type="button" role="radio" aria-checked={a.w === w} className={a.w === w ? 'is-on' : ''} onClick={() => set({ w })}>{['Low', 'Medium', 'High'][w - 1]}</button>
              ))}
            </div>
          </div>
        </m.div>
      </AnimatePresence>
      <div className="qz-nav">
        <button type="button" className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
        <button type="button" className="btn btn--ghost" onClick={() => { set({ v: null }); if (i < STATEMENTS.length - 1) setI(i + 1); }}>Skip</button>
        {i < STATEMENTS.length - 1
          ? <button type="button" className="btn btn--accent" onClick={() => setI(i + 1)}>Next</button>
          : <button type="button" className="btn btn--accent" disabled={answered < 5} onClick={() => setDone(true)}>See results</button>}
      </div>
      <p className="qz-fine">{answered} answered{answered < 5 ? ' · answer at least 5 to see results' : ''} · <button type="button" className="qz-link" disabled={answered < 5} onClick={() => setDone(true)}>Jump to results</button></p>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="qz-disc" role="note">
      <strong>Neutral tool.</strong> This compares your answers with what each party’s <em>official platform documents</em> say — not with candidates, voting records or what parties do in office. It does not tell you how to vote. Your answers never leave your device.
    </p>
  );
}

function IssuesResults({ region, answers, onBack, onReset }: { region: Region; answers: Record<string, Answer>; onBack: () => void; onReset: () => void }) {
  const parties = PARTIES.filter((p) => p.region === region);
  const scores = parties.map((p) => ({ p, ...scoreParty(p.id, answers) })).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
  const [share, setShare] = useState(false);
  const card: CardData = {
    kind: 'stat', title: 'My platform match', subtitle: `PolTok issues quiz · ${region === 'US' ? '2024 US party platforms' : 'Australian party policies'}`,
    stats: scores.filter((x) => x.pct != null).map((x) => ({ label: x.p.short, value: `${x.pct}%`, color: x.p.color })),
    bars: scores.filter((x) => x.pct != null).map((x) => ({ label: x.p.short, value: x.pct!, color: x.p.color })),
    footer: 'Compared with official platform documents · not a voting recommendation', url: 'poltok.netlify.app/quiz',
  };
  return (
    <div className="qz-card">
      <h2 className="qz-q">How your answers line up</h2>
      <Disclaimer />
      <ul className="qz-bars">
        {scores.map(({ p, pct, n }, k) => (
          <li key={p.id}>
            <div className="qz-bars__top"><b>{p.name}</b><span>{pct == null ? 'no overlap' : `${pct}%`}</span></div>
            <div className="qz-bars__track"><m.span style={{ background: p.color }} initial={{ width: 0 }} animate={{ width: `${pct ?? 0}%` }} transition={{ duration: 0.7, delay: k * 0.08 }} /></div>
            <small>Based on {n} statement{n === 1 ? '' : 's'} with a stated position · <a href={p.url} target="_blank" rel="noreferrer">{p.doc}</a></small>
          </li>
        ))}
      </ul>
      <h3 className="qz-h3">Per-issue breakdown</h3>
      <div className="qz-table" role="table" aria-label="Per-issue breakdown">
        {STATEMENTS.map((s) => {
          const a = answers[s.id];
          return (
            <details key={s.id} className="qz-issue">
              <summary>
                <span className="qz-issue__t"><small>{s.topic}</small>{s.text}</span>
                <span className="qz-issue__you">You: {a?.v == null ? 'skipped' : SCALE.find((x) => x.v === a.v)!.label}{a?.v != null && ` · ${['low', 'med', 'high'][a.w - 1]}`}</span>
              </summary>
              <ul className="qz-chips">
                {parties.map((p) => {
                  const v = s.pos[p.id];
                  return <li key={p.id} style={{ borderColor: p.color }}><b>{p.short}</b> {v == null ? 'no stated position' : SCALE.find((x) => x.v === v)!.label}</li>;
                })}
              </ul>
              <p className="qz-fine">Source note: {s.note}</p>
            </details>
          );
        })}
      </div>
      <div className="qz-nav">
        <button type="button" className="btn" onClick={onBack}>Edit answers</button>
        <button type="button" className="btn btn--ghost" onClick={onReset}>Start over</button>
        <button type="button" className="btn btn--accent" onClick={() => setShare(true)}>Share result card</button>
      </div>
      <p className="qz-fine">Sources: {PARTIES.filter((p) => p.region === region).map((p, k) => <span key={p.id}>{k ? ' · ' : ''}<a href={p.url} target="_blank" rel="noreferrer">{p.short}</a></span>)}. Positions summarised by PolTok (reviewed Nov 2026); where a document is silent the party isn’t scored.</p>
      {share && <ShareModal data={card} onClose={() => setShare(false)} />}
    </div>
  );
}

function ShareModal({ data, onClose }: { data: CardData; onClose: () => void }) {
  const [url, setUrl] = useState<string>();
  const [blob, setBlob] = useState<Blob>();
  const [msg, setMsg] = useState('');
  const design = data.kind === 'quote' ? 'newspaper' : 'broadcast';
  useEffect(() => {
    let u = '';
    renderCard(design, data).then((b) => { setBlob(b); u = URL.createObjectURL(b); setUrl(u); }).catch(() => setMsg('Could not render the card.'));
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [data, design]);
  const name = cardFileName(design, data);
  const file = blob ? new File([blob], name, { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }));
  return (
    <Modal open onClose={onClose} title="Share card" width={640}>
      <div className="qz-share">
        {url ? <img src={url} alt="Your share card" /> : <p aria-busy="true">Rendering…</p>}
        <p className="qz-fine">Made in your browser — nothing is uploaded.</p>
        <div className="qz-nav">
          <a className="btn btn--accent" href={url} download={name} aria-disabled={!url}>Download PNG</a>
          {canShare && <button type="button" className="btn" onClick={() => navigator.share({ files: [file!], title: 'PolTok' }).catch(() => {})}>Share…</button>}
        </div>
        <p role="status" className="qz-fine">{msg}</p>
      </div>
    </Modal>
  );
}

/* ───────────── Daily trivia ───────────── */
interface TriviaStore { days: Record<string, number[]>; streak: number; best: number; last?: string }
function Trivia() {
  const live = useLive();
  const day = dayKey();
  const ready = live.mode !== 'connecting';
  const qs = useMemo(() => dailyQuestions(day, live), [day, ready, Object.keys(live.results).length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const [st, setSt] = useState<TriviaStore>(() => load('qz.trivia', { days: {}, streak: 0, best: 0 }));
  const picks = st.days[day] ?? [];
  const idx = Math.min(picks.length, qs.length - 1);
  const finished = picks.length >= qs.length;
  const q = qs[idx];
  const [shown, setShown] = useState<number | null>(null);
  const reduce = useReducedMotion();
  useEffect(() => save('qz.trivia', st), [st]);

  const choose = (k: number) => {
    if (shown !== null) return;
    setShown(k);
  };
  const next = () => {
    if (shown === null) return;
    const np = [...picks, shown];
    setSt((s) => {
      const out = { ...s, days: { ...s.days, [day]: np } };
      if (np.length === qs.length && s.last !== day) {
        const y = new Date(); y.setDate(y.getDate() - 1);
        out.streak = s.last === dayKey(y) ? s.streak + 1 : 1;
        out.best = Math.max(s.best, out.streak);
        out.last = day;
      }
      return out;
    });
    setShown(null);
  };
  const score = picks.filter((p, k) => qs[k] && p === qs[k].answer).length;

  if (!qs.length) return <p className="qz-card">Loading…</p>;
  return (
    <div className="qz-card">
      <div className="qz-stats">
        <div><b>{st.streak}</b><span>day streak</span></div>
        <div><b>{st.best}</b><span>best</span></div>
        <div><b>{score}/{qs.length}</b><span>today</span></div>
      </div>
      {finished ? (
        <div className="qz-done">
          <h2 className="qz-q">Done for today — {score}/{qs.length}</h2>
          <p>New questions tomorrow. Review:</p>
          <ol className="qz-review">
            {qs.map((x, k) => (
              <li key={x.id} className={picks[k] === x.answer ? 'ok' : 'bad'}>
                <b>{x.q}</b> <span>{x.options[x.answer]}</span>
                <small>{x.explain} {x.link && <Link to={x.link.to}>{x.link.label} →</Link>}</small>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <m.div key={q.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -12 }}>
            <p className="qz-meta">Question {idx + 1} of {qs.length} · {q.source}</p>
            <h2 className="qz-q" id="qz-tq">{q.q}</h2>
            <div className="qz-answers" role="group" aria-labelledby="qz-tq">
              {q.options.map((o, k) => {
                const state = shown === null ? '' : k === q.answer ? 'is-right' : k === shown ? 'is-wrong' : 'is-dim';
                return <button key={o} type="button" className={`qz-ans ${state}`} disabled={shown !== null} onClick={() => choose(k)}>{o}</button>;
              })}
            </div>
            <div aria-live="polite">
              {shown !== null && (
                <m.div className="qz-explain" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <b>{shown === q.answer ? 'Correct!' : 'Not quite.'}</b> {q.explain} {q.link && <Link to={q.link.to}>{q.link.label} →</Link>}
                  <div className="qz-nav"><button type="button" className="btn btn--accent" onClick={next} autoFocus>{idx + 1 === qs.length ? 'Finish' : 'Next question'}</button></div>
                </m.div>
              )}
            </div>
          </m.div>
        </AnimatePresence>
      )}
      <p className="qz-fine">Questions are generated each day from real results ({live.mode.includes('live') ? 'live AP calls' : 'baked facts — live results not connected'}) and PolTok’s data. Streaks are stored only in this browser.</p>
    </div>
  );
}

/* ───────────── Guess the map ───────────── */
function MapGame() {
  const live = useLive();
  const day = dayKey();
  const total = calledRaces(live).length;
  const rounds = useMemo(() => mapRounds(day, live), [day, total]); // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0);
  const [guesses, setGuesses] = useState<('D' | 'R')[]>([]);
  const [best, setBest] = useState<number>(() => load('qz.mapbest', 0));
  const r = rounds[i];
  const shape = useMemo(() => (r ? stateShape(r.state, 300, 220) : null), [r]);
  const g = guesses[i];
  const score = guesses.filter((x, k) => rounds[k] && x === rounds[k].party).length;
  const over = rounds.length > 0 && guesses.length === rounds.length && i === rounds.length - 1 && g;
  useEffect(() => { if (over && score > best) { setBest(score); save('qz.mapbest', score); } }, [over, score, best]);

  if (!rounds.length) {
    return (
      <div className="qz-card">
        <h2 className="qz-q">No called races yet</h2>
        <p>Guess the map uses real AP calls for Senate and governor races. Switch results to <b>Live</b> (in Settings) or check back once races are called. We never invent results.</p>
        <Link className="btn" to="/races">See races</Link>
      </div>
    );
  }
  const fill = g ? (r.party === 'D' ? 'var(--dem)' : 'var(--rep)') : 'var(--bg-3)';
  return (
    <div className="qz-card">
      <div className="qz-stats">
        <div><b>{i + 1}/{rounds.length}</b><span>round</span></div>
        <div><b>{score}</b><span>score</span></div>
        <div><b>{best}</b><span>best</span></div>
      </div>
      <h2 className="qz-q" id="qz-mq">Who won the {r.title}?</h2>
      <div className="qz-map">
        {shape && (
          <svg viewBox="0 0 300 220" role="img" aria-label={`Outline of ${r.title.replace(/ (Senate|Governor).*/, '')}`}>
            <m.path key={r.id} d={shape.d} initial={{ pathLength: 0, opacity: 0.3 }} animate={{ pathLength: 1, opacity: 1, fill }} transition={{ duration: 0.6 }} stroke="var(--text-2)" strokeWidth={1.5} />
          </svg>
        )}
      </div>
      <div className="qz-answers qz-answers--2" role="group" aria-labelledby="qz-mq">
        {(['D', 'R'] as const).map((p) => (
          <button key={p} type="button" disabled={!!g} className={`qz-ans qz-ans--${p} ${g ? (p === r.party ? 'is-right' : p === g ? 'is-wrong' : 'is-dim') : ''}`}
            onClick={() => setGuesses((x) => { const y = [...x]; y[i] = p; return y; })}>{p === 'D' ? 'Democrat' : 'Republican'}</button>
        ))}
      </div>
      <div aria-live="polite">
        {g && (
          <div className="qz-explain">
            <b>{g === r.party ? 'Correct!' : 'Nope.'}</b> {r.winner} ({r.party === 'D' ? 'Democrat' : 'Republican'}) won — AP call. <Link to={`/race/${r.id}`}>Race page →</Link>
            <div className="qz-nav">
              {i < rounds.length - 1
                ? <button type="button" className="btn btn--accent" onClick={() => setI(i + 1)} autoFocus>Next state</button>
                : <><b>Final: {score}/{rounds.length}</b><button type="button" className="btn" onClick={() => { setGuesses([]); setI(0); }}>Play again</button></>}
            </div>
          </div>
        )}
      </div>
      <p className="qz-fine">Rounds drawn daily from {total} called Senate/governor races (AP via NYT).</p>
    </div>
  );
}
