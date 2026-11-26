/** /au/victoria/match — "Who matches you?": swipe through 14 live issues; we compare your answers with where Labor, the
 *  Coalition, the Greens and One Nation stand (PolTok's summary of the ABC policy tracker). Answers stay in this browser. */
import { useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, m, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import POLICIES from '../../../data/vic-policies.json';
import { AuNav } from '../AuNav';
import { VIC_NAME, vicColor } from '../vicLive';
import { loadJson, saveJson } from './passport';
import '../au.css';
import '../parliament/profile.css';
import './engage.css';

type Stance = 'for' | 'against' | 'mixed' | 'unclear';
const P = POLICIES as unknown as { source: { name: string; url: string }; stances: { id: string; issue: string; positions: Record<string, { stance: Stance; note: string }> }[] };
const PARTIES = ['ALP', 'LNP', 'GRN', 'ONP'];
/** neutral "should" statements for each tracked issue */
const Q: Record<string, { q: string; emoji: string }> = {
  srl: { q: 'Keep building the Suburban Rail Loop', emoji: '🚇' },
  netzero: { q: 'Keep the target of net zero emissions by 2045', emoji: '🌱' },
  gasban: { q: 'Ban gas connections in new homes', emoji: '🔥' },
  newgas: { q: 'Approve new gas projects in Victoria', emoji: '⛽' },
  transmission: { q: 'Build the VNI West and Western Renewables Link power lines', emoji: '⚡' },
  bail: { q: 'Make bail laws tougher', emoji: '⚖️' },
  age: { q: 'Raise the age of criminal responsibility', emoji: '🧒' },
  treaty: { q: 'Make a Treaty with First Peoples', emoji: '🤝' },
  activity: { q: 'Allow more high-rise housing around suburban Activity Centres', emoji: '🏢' },
  landtax: { q: 'Reverse the recent land tax increases', emoji: '🏠' },
  payroll: { q: 'Cut payroll tax for businesses', emoji: '💼' },
  stampduty: { q: 'Give home buyers stamp duty relief', emoji: '🔑' },
  fares: { q: 'Make public transport fares cheaper', emoji: '🚋' },
  tolls: { q: 'Cap how much drivers pay in tolls each week', emoji: '🛣️' },
};
const ISSUES = P.stances.filter((s) => Q[s.id] && PARTIES.filter((k) => s.positions[k] && s.positions[k].stance !== 'unclear').length >= 2);
const val = (s?: Stance) => (s === 'for' ? 1 : s === 'against' ? -1 : s === 'mixed' ? 0 : null);
const KEY = 'poltok.vic.match';
type Answers = Record<string, -1 | 0 | 1>;

export function scoreMatch(ans: Answers) {
  return PARTIES.map((k) => {
    let sum = 0, n = 0;
    for (const s of ISSUES) {
      const u = ans[s.id], p = val(s.positions[k]?.stance);
      if (u == null || u === 0 || p == null) continue;
      sum += 1 - Math.abs(u - p) / 2; n++;
    }
    return { k, pct: n ? Math.round((sum / n) * 100) : 0, n };
  }).sort((a, b) => b.pct - a.pct || b.n - a.n);
}

function SwipeCard({ s, onAnswer }: { s: (typeof ISSUES)[number]; onAnswer: (v: -1 | 0 | 1) => void }) {
  const x = useMotionValue(0);
  const rot = useTransform(x, [-220, 220], [-14, 14]);
  const yes = useTransform(x, [20, 140], [0, 1]);
  const no = useTransform(x, [-140, -20], [1, 0]);
  const end = (_: unknown, i: PanInfo) => { if (i.offset.x > 110) onAnswer(1); else if (i.offset.x < -110) onAnswer(-1); };
  return (
    <m.div className="mt-card lg" style={{ x, rotate: rot }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.9} onDragEnd={end}
      initial={{ scale: 0.92, opacity: 0, y: 24 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}>
      <m.span className="mt-stamp mt-stamp--yes" style={{ opacity: yes }}>AGREE</m.span>
      <m.span className="mt-stamp mt-stamp--no" style={{ opacity: no }}>DISAGREE</m.span>
      <span className="mt-emoji" aria-hidden="true">{Q[s.id].emoji}</span>
      <span className="pf__kicker">Victoria should…</span>
      <h2>{Q[s.id].q}</h2>
      <small className="faint">Swipe right to agree, left to disagree, or use the buttons</small>
    </m.div>
  );
}

export default function MatchPage() {
  useSeo({ title: 'Who matches you? · Victoria 2026', description: 'Swipe through the big issues of the Victorian election and see which party lines up with you.' });
  const [ans, setAns] = useState<Answers>(() => loadJson(KEY, {}));
  const [i, setI] = useState(() => { const a = loadJson<Answers>(KEY, {}); return ISSUES.every((s) => s.id in a) ? ISSUES.length : 0; });
  const [copied, setCopied] = useState(false);
  const done = i >= ISSUES.length;
  const res = useMemo(() => scoreMatch(ans), [ans]);
  const answer = (v: -1 | 0 | 1) => { const s = ISSUES[i]; const next = { ...ans, [s.id]: v }; setAns(next); saveJson(KEY, next); setI(i + 1); };
  const restart = () => { setAns({}); saveJson(KEY, {}); setI(0); };
  const share = async () => {
    const text = `My Victorian election match on PolTok: ${res.map((r) => `${VIC_NAME[r.k]} ${r.pct}%`).join(' · ')}. Who matches you?`;
    const url = `${location.origin}/au/victoria/match`;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); } } catch { /* cancelled */ }
  };
  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · Sat 28 Nov" title="Who matches you?" crumbLabel="Who matches you?"
        sub={`${ISSUES.length} big issues. Swipe your view, then see which party lines up with you.`}>
        <AuNav />
      </PageHeader>
      {!done ? (
        <div className="mt">
          <div className="mt-prog" aria-label={`Question ${i + 1} of ${ISSUES.length}`}><m.i animate={{ width: `${(i / ISSUES.length) * 100}%` }} /></div>
          <div className="mt-count num">{i + 1} / {ISSUES.length}</div>
          <div className="mt-stack">
            {ISSUES[i + 1] && <div className="mt-card mt-card--behind lg" aria-hidden="true" />}
            <AnimatePresence mode="popLayout"><SwipeCard key={ISSUES[i].id} s={ISSUES[i]} onAnswer={answer} /></AnimatePresence>
          </div>
          <div className="mt-btns">
            <button type="button" className="mt-btn mt-btn--no" onClick={() => answer(-1)}>👎 Disagree</button>
            <button type="button" className="mt-btn" onClick={() => answer(0)}>🤷 Not sure</button>
            <button type="button" className="mt-btn mt-btn--yes" onClick={() => answer(1)}>👍 Agree</button>
          </div>
          {i > 0 && <button type="button" className="mt-back" onClick={() => setI(i - 1)}>← Back</button>}
        </div>
      ) : (
        <div className="mt-res">
          <m.h2 className="mt-res__h" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {res[0].n ? <>You line up most with <span style={{ color: vicColor(res[0].k) }}>{VIC_NAME[res[0].k]}</span></> : 'You stayed on the fence on everything!'}
          </m.h2>
          <div className="mt-bars">
            {res.map((r, j) => (
              <m.div key={r.k} className="mt-bar lg" style={{ ['--c' as string]: vicColor(r.k) } as CSSProperties} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + j * 0.12 }}>
                <b>{VIC_NAME[r.k]}</b>
                <span className="mt-bar__track"><m.i initial={{ width: 0 }} animate={{ width: `${r.pct}%` }} transition={{ delay: 0.3 + j * 0.12, duration: 0.9 }} /></span>
                <strong className="num">{r.pct}%</strong>
                <small>on {r.n} issue{r.n === 1 ? '' : 's'} where they have a clear position</small>
              </m.div>
            ))}
          </div>
          <div className="pf__actions" style={{ justifyContent: 'center' }}>
            <button type="button" className="lg-btn" onClick={share}>{copied ? 'Copied ✓' : '📤 Share my match'}</button>
            <button type="button" className="lg-btn" onClick={restart}>↺ Retake</button>
            <Link className="lg-btn" to="/au/victoria/policies">Compare every promise →</Link>
          </div>
          <section className="ds__sec lg">
            <h3 className="ds__h"><span>🔎</span>Your answers v the parties</h3>
            <div className="mt-grid">
              {ISSUES.map((s) => { const u = ans[s.id]; return (
                <div key={s.id} className="mt-row">
                  <span className="mt-row__q">{Q[s.id].emoji} {Q[s.id].q}<small>You: <b>{u === 1 ? 'Agree' : u === -1 ? 'Disagree' : 'Not sure'}</b></small></span>
                  <span className="mt-row__p">{PARTIES.map((k) => { const st = s.positions[k]?.stance ?? 'unclear'; const v = val(st); const same = u && v != null && v === u; return (
                    <i key={k} className={`mt-chip ${same ? 'is-same' : ''}`} style={{ ['--c' as string]: vicColor(k) } as CSSProperties} title={s.positions[k]?.note}>{k === 'LNP' ? 'L/NP' : k} {st === 'for' ? '👍' : st === 'against' ? '👎' : st === 'mixed' ? '〰️' : '·'}</i>); })}</span>
                </div>); })}
            </div>
          </section>
        </div>
      )}
      <p className="vp-method">Not voting advice. Party positions are PolTok's summary of the <a href={P.source.url} target="_blank" rel="noreferrer">{P.source.name}</a>; issues where a party has no clear position don't count for or against it. Your answers are stored only in this browser.</p>
    </div>
  );
}
