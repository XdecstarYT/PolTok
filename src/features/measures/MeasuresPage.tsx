/**
 * /measures — Statewide ballot measures. Real AP results from NYT's per-state results files
 * (results-<state-slug>.json, office_id "I", coverage "state"). Owned by src/features/measures/**.
 * NYT publishes no single ballot-measure file (results-ballot-measures.json 404s), so we fetch
 * each state file and keep only statewide measures.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LiveDot, fmtTime, tzAbbr } from '../../components';
import { STATES } from '../../data';
import { USMap } from '../map/USMap';
import { ATTRIBUTION, NYT_BASE, fetchJson, type NytRace } from '../flips/data';
import './measures.css';

const YES = new Set(['yes', 'for', 'approve', 'approved']);
const NO = new Set(['no', 'against', 'reject', 'rejected']);
const C_YES = 'var(--ok, #22c55e)';
const C_NO = 'var(--danger, #ef4444)';

const TOPICS: [string, RegExp][] = [
  ['Abortion', /abortion|reproductive|gender transition/i],
  ['Voting & elections', /vot|elect|primar|redistrict|ballot|initiative|referend|amendment approval|term limit|judicial|campaign|contribution|recall|convention/i],
  ['Taxes & budget', /tax|bond|budget|revenue|fund|debt|financ|retirement|salar|assessment/i],
  ['Wages & labor', /wage|bargaining|labor|employ|leave/i],
  ['Criminal justice', /bail|crime|victim|felon|sheriff|police/i],
  ['Guns', /firearm|gun/i],
  ['Marijuana & gambling', /marijuana|cannabis|betting|wager|gambl|casino/i],
  ['Rights & social', /marriage|equal protection|athlete|biological sex|parental|discriminat|worship|citizenship/i],
  ['Housing & land', /housing|homebuyer|lot size|single-family|property|expropriat|environment|conservation/i],
  ['Health & education', /health|medicaid|school|educat|meal|librar|research|clinic/i],
];
const topicOf = (s: string) => TOPICS.find(([, re]) => re.test(s))?.[0] ?? 'Other';

interface Measure {
  id: string; state: string; stateName: string; title: string; summary: string; desc: string; topic: string;
  called: boolean; passed?: boolean; yes: number; no: number; eevp: number; status: string;
}

const slug = (n: string) => n.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

function parse(r: NytRace, stateName: string): Measure | null {
  const ru = r.top_reporting_unit || {};
  let yes = 0, no = 0;
  for (const c of ru.candidates || []) {
    const id = c.nyt_id.toLowerCase();
    if (YES.has(id)) yes += c.votes?.total || 0;
    else if (NO.has(id)) no += c.votes?.total || 0;
  }
  const won = r.outcome?.won?.[0]?.toLowerCase();
  const summary = (r.seat || '').replace(/^[\w.]+\s*-\s*/, '');
  const title = r.title?.default || r.ballot_measure_text || r.seat || r.nyt_id;
  return {
    id: r.nyt_id, state: ru.state_postal || r.nyt_id.slice(0, 2), stateName, title, summary,
    desc: r.long_description || '', topic: topicOf(`${title} ${summary}`),
    called: !!won, passed: won ? YES.has(won) : undefined, yes, no, eevp: ru.eevp ?? 0, status: r.race_call_status || '',
  };
}

function useMeasures(ms = 120000) {
  const [state, setState] = useState<{ list: Measure[]; updatedAt: number; ok: number; failed: string[] } | null>(null);
  const prev = useRef(new Map<string, Measure[]>());
  useEffect(() => {
    let alive = true;
    const ctl = new AbortController();
    const load = async () => {
      const targets = STATES.filter((s) => s.abbr !== 'DC'); // NYT has no DC state file
      const failed: string[] = [];
      let ok = 0;
      // Limited concurrency: ~50 files, a few hundred KB each (gzipped ~75KB).
      let idx = 0;
      const worker = async () => {
        while (idx < targets.length) {
          const s = targets[idx++];
          try {
            const d = await fetchJson<{ races?: NytRace[] }>(`${NYT_BASE}/results-${slug(s.name)}.json`, ctl.signal);
            const ms = (d.races || []).filter((r) => r.office_id === 'I' && r.coverage === 'state').map((r) => parse(r, s.name)).filter(Boolean) as Measure[];
            prev.current.set(s.abbr, ms);
            ok++;
          } catch {
            if (ctl.signal.aborted) return;
            failed.push(s.abbr);
          }
        }
      };
      await Promise.all(Array.from({ length: 8 }, worker));
      if (!alive) return;
      const list = [...prev.current.values()].flat();
      setState({ list, updatedAt: Date.now(), ok, failed });
    };
    load();
    const t = setInterval(load, ms);
    return () => { alive = false; ctl.abort(); clearInterval(t); };
  }, [ms]);
  return state;
}

type Status = 'all' | 'passed' | 'failed' | 'uncalled';

export default function MeasuresPage() {
  const data = useMeasures();
  const [topic, setTopic] = useState('All');
  const [status, setStatus] = useState<Status>('all');
  const [state, setStateF] = useState<string | null>(null);
  const list = data?.list ?? [];

  const topics = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of list) c.set(m.topic, (c.get(m.topic) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);

  const byTopic = list.filter((m) => topic === 'All' || m.topic === topic);
  const shown = byTopic
    .filter((m) => (!state || m.state === state) && (status === 'all' || (status === 'uncalled' ? !m.called : status === 'passed' ? m.passed === true : m.passed === false)))
    .sort((a, b) => a.stateName.localeCompare(b.stateName) || a.id.localeCompare(b.id));

  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    const per: Record<string, Measure[]> = {};
    for (const m of byTopic) (per[m.state] ??= []).push(m);
    for (const [st, ms] of Object.entries(per)) {
      const p = ms.filter((m) => m.passed === true).length, n = ms.filter((m) => m.passed === false).length;
      f[st] = p && !n ? '#1f9d55' : n && !p ? '#c0392b' : p && n ? '#b08900' : '#5b6170';
    }
    return { f, per };
  }, [byTopic]);

  const counts = useMemo(() => ({
    total: list.length,
    passed: list.filter((m) => m.passed === true).length,
    failed: list.filter((m) => m.passed === false).length,
    states: new Set(list.map((m) => m.state)).size,
  }), [list]);

  return (
    <div className="page bm-page">
      <header>
        <div className="bm-kicker mono"><LiveDot /> <span>MIDTERMS 2026 · STATEWIDE BALLOT MEASURES</span></div>
        <h1>Ballot measures</h1>
        <p className="bm-sub">
          Every statewide question on the ballot, with real vote counts and AP calls. {ATTRIBUTION}. NYT publishes no single
          ballot-measure feed, so this page reads each state's results file.{' '}
          <span className="mono bm-upd">
            {data ? `Updated ${fmtTime(data.updatedAt, true)} ${tzAbbr()} · ${data.ok} state files · refreshes every 2 min` : 'Loading 50 state files…'}
            {data?.failed.length ? ` · unavailable: ${data.failed.join(', ')}` : ''}
          </span>
        </p>
      </header>

      {data && list.length === 0 && (
        <div className="bm-empty">No statewide ballot-measure results were found in the NYT state files. Nothing is shown rather than guessing.</div>
      )}

      <section className="bm-stats mono" aria-label="Summary">
        <div><b>{counts.total}</b>measures</div>
        <div><b>{counts.states}</b>states</div>
        <div><b style={{ color: C_YES }}>{counts.passed}</b>passed</div>
        <div><b style={{ color: C_NO }}>{counts.failed}</b>failed</div>
        <div><b>{counts.total - counts.passed - counts.failed}</b>uncalled</div>
      </section>

      <div className="bm-filters">
        <div className="bm-topics" role="toolbar" aria-label="Topic">
          {[['All', list.length] as [string, number], ...topics].map(([t, n]) => (
            <button key={t} className={topic === t ? 'on' : ''} aria-pressed={topic === t} onClick={() => setTopic(t)}>
              {t} <span className="muted">{n}</span>
            </button>
          ))}
        </div>
        <div className="bm-seg">
          {(['all', 'passed', 'failed', 'uncalled'] as Status[]).map((s) => (
            <button key={s} className={status === s ? 'on' : ''} aria-pressed={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
          ))}
          {state && <button className="on" onClick={() => setStateF(null)}>{state} ✕</button>}
        </div>
      </div>

      <div className="bm-grid">
        <section className="bm-list" aria-label="Measures">
          {data && shown.length === 0 && list.length > 0 && <div className="bm-empty">No measures match these filters.</div>}
          {shown.map((m) => <MeasureCard key={m.id} m={m} />)}
        </section>
        <aside className="bm-side">
          <div className="bm-panel">
            <h2 className="mono">Map{topic !== 'All' ? ` · ${topic}` : ''}</h2>
            <USMap
              fills={fills.f}
              selected={state}
              onStateClick={(a) => fills.per[a] && setStateF((s) => (s === a ? null : a))}
              renderTooltip={(a) => {
                const ms = fills.per[a];
                if (!ms) return `${a}: no statewide measures`;
                return `${a}: ${ms.length} measure${ms.length > 1 ? 's' : ''} · ${ms.filter((m) => m.passed).length} passed · ${ms.filter((m) => m.passed === false).length} failed`;
              }}
              describe={(a) => `${a} ${fills.per[a]?.length ?? 0} measures`}
              title="States with ballot measures"
            />
            <div className="bm-legend mono">
              <span><i style={{ background: '#1f9d55' }} />All called passed</span>
              <span><i style={{ background: '#c0392b' }} />All called failed</span>
              <span><i style={{ background: '#b08900' }} />Mixed</span>
              <span><i style={{ background: '#5b6170' }} />Uncalled</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MeasureCard({ m }: { m: Measure }) {
  const tot = m.yes + m.no;
  const y = tot ? (m.yes / tot) * 100 : 0;
  const badge = m.called ? (m.passed ? 'Passed' : 'Failed') : m.status === 'too_early' ? 'Too early' : 'Uncalled';
  return (
    <article className="bm-card">
      <div className="bm-ctop">
        <span className="bm-st mono">{m.state}</span>
        <b>{m.title}</b>
        <span className={`bm-badge mono ${m.called ? (m.passed ? 'yes' : 'no') : ''}`}>{m.called && (m.passed ? '✓ ' : '✕ ')}{badge}</span>
      </div>
      <p className="bm-sum">{m.summary}</p>
      <div className="bm-bar" role="img" aria-label={tot ? `Yes ${y.toFixed(1)}%, No ${(100 - y).toFixed(1)}%` : 'No votes counted'}>
        {tot > 0 ? (
          <>
            <span style={{ width: `${y}%`, background: C_YES }} />
            <span style={{ width: `${100 - y}%`, background: C_NO }} />
          </>
        ) : null}
        <i className="bm-mid" />
      </div>
      <div className="bm-nums mono">
        <span style={{ color: C_YES }}>Yes {tot ? `${y.toFixed(1)}%` : '—'}</span>
        <span className="muted">{Math.round(m.eevp)}% of est. vote in</span>
        <span style={{ color: C_NO }}>No {tot ? `${(100 - y).toFixed(1)}%` : '—'}</span>
      </div>
      {m.desc && <details className="bm-desc"><summary>About</summary>{m.desc}</details>}
    </article>
  );
}
