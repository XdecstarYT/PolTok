/** /au/polls — weighted polling averages (federal + Victoria). */
import { Link } from 'react-router-dom';
import { Card } from '../../components';
import { useSeo } from '../../lib/seo';
import { AU_POLLS, type AuPoll } from '../../data/au';
import { FED2025_NATIONAL_PRIMARY } from '../../data/au-fed2025';
import { AuNav } from './AuNav';
import { LineChart } from './charts';
import { pColor } from './model';
import { average, HALF_LIFE, pollTs, pollVal, SERIES, sponsored, trend, weights, WINDOW, type Series } from './pollavg';
import './au.css';

const NAME: Record<Series, string> = { ALP: 'Labor', LNP: 'Coalition', ONP: 'One Nation', GRN: 'Greens', OTH: 'Others', TPP: 'ALP 2PP' };
const COL = (k: Series) => (k === 'LNP' ? pColor('LIB') : k === 'TPP' ? pColor('ALP') : pColor(k));
const fmtD = (t: number) => new Date(t).toISOString().slice(5, 10);

function Block({ title, polls, baseline }: { title: string; polls: AuPoll[]; baseline?: { label: string; tpp: number; prim?: Record<string, number> } }) {
  const now = Math.max(...polls.map((p) => pollTs(p.date)));
  const tpp = average(polls, 'TPP', now);
  const ws = weights(polls, now);
  const wsum = ws.reduce((a, x) => a + x.w, 0);
  const prim = SERIES.map((k) => ({ k, a: average(polls, k, now) }));
  const lines = SERIES.map((k) => {
    const tr = trend(polls, k);
    return { key: k, label: NAME[k], color: COL(k), pts: tr.map((r) => ({ x: r.t, y: r.a })), dots: tr.flatMap((r) => r.raw.map((y) => ({ x: r.t, y }))) };
  });
  const tppTr = trend(polls, 'TPP');
  return (
    <section className="stack" style={{ gap: 'var(--sp-4)' }}>
      <h2 className="au-h2">{title}</h2>
      <div className="au-avg-row">
        {tpp && (
          <div className="au-avg-tpp">
            <span className="mono">2PP · ALP v L/NP</span>
            <b className="num" style={{ color: pColor(tpp.v >= 50 ? 'ALP' : 'LIB') }}>{tpp.v.toFixed(1)} – {(100 - tpp.v).toFixed(1)}</b>
            <span className="muted">{tpp.n} polls{baseline ? ` · ${baseline.label}: ${baseline.tpp.toFixed(1)}` : ''}</span>
          </div>
        )}
        {prim.map(({ k, a }) => a && (
          <div key={k} className="au-poll-stat">
            <span className="mono" style={{ color: COL(k) }}>{NAME[k]}</span>
            <b className="num">{a.v.toFixed(1)}</b>
            {baseline?.prim?.[k] != null && <span className="mono muted">{(a.v - baseline.prim[k]) >= 0 ? '+' : ''}{(a.v - baseline.prim[k]).toFixed(1)}</span>}
          </div>
        ))}
      </div>
      <Card title="Primary vote trend" kicker="weighted average at each poll date · dots = individual polls">
        <LineChart ariaLabel={`${title} primary vote average`} series={lines} yMin={0} yMax={40} xFmt={fmtD} />
      </Card>
      {tppTr.some((r) => r.a != null) && (
        <Card title="Two-party-preferred trend" kicker="Labor share, ALP v L/NP">
          <LineChart ariaLabel={`${title} 2PP average`} series={[{ key: 'TPP', label: 'ALP', color: COL('TPP'), pts: tppTr.map((r) => ({ x: r.t, y: r.a })), dots: tppTr.flatMap((r) => r.raw.map((y) => ({ x: r.t, y }))) }]} yMin={40} yMax={60} refY={50} xFmt={fmtD} height={180} />
        </Card>
      )}
      <Card title="Polls in the average" kicker={`share of total weight on ${new Date(now).toISOString().slice(0, 10)}`}>
        <div className="au-table-wrap">
          <table className="pt-table au-table">
            <thead><tr><th>Date</th><th>Pollster</th><th>n</th>{SERIES.map((k) => <th key={k}>{k}</th>)}<th>2PP</th><th>Weight</th></tr></thead>
            <tbody>
              {ws.map(({ p, w }) => (
                <tr key={p.pollster + p.date}>
                  <td className="mono">{p.date}</td>
                  <td>{p.pollster}{sponsored(p) ? ' *' : ''}</td>
                  <td className="num">{p.sample ?? '—'}</td>
                  {SERIES.map((k) => <td key={k} className="num">{pollVal(p, k) ?? '—'}</td>)}
                  <td className="num">{p.tpp ? `${p.tpp.ALP}` : '—'}</td>
                  <td className="num">{((100 * w) / wsum).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="au-note">* commissioned by a party — half weight.</p>
      </Card>
    </section>
  );
}

export default function PollAvgPage() {
  useSeo({ title: 'Australian polling average', description: 'Weighted average of federal and Victorian voting-intention polls: two-party-preferred and primary votes.' });
  return (
    <div className="page au-page">
      <AuNav />
      <header className="au-head">
        <div>
          <div className="au-kicker mono"><Link to="/au">AUSTRALIA</Link> / POLLING AVERAGE</div>
          <h1>Polling average</h1>
          <p className="au-sub">A transparent weighted mean of published polls — not a forecast.</p>
        </div>
      </header>
      <Block title="Federal" polls={AU_POLLS.federal} baseline={{ label: '2025 election', tpp: 55.2, prim: { ALP: FED2025_NATIONAL_PRIMARY.ALP, GRN: FED2025_NATIONAL_PRIMARY.GRN, ONP: FED2025_NATIONAL_PRIMARY.ONP, LNP: +((FED2025_NATIONAL_PRIMARY.LIB ?? 0) + (FED2025_NATIONAL_PRIMARY.LNP ?? 0) + (FED2025_NATIONAL_PRIMARY.NAT ?? 0)).toFixed(1) } }} />
      <Block title="Victoria" polls={AU_POLLS.victoria} baseline={{ label: '2022 election', tpp: 55.0 }} />
      <Card title="Method">
        <ul className="au-facts">
          <li>Weight = recency × sample × house × sponsor. Recency halves every {HALF_LIFE} days; polls older than {WINDOW} days drop out.</li>
          <li>Sample factor = √(n / 1000), capped at n = 3,000; unknown sample sizes get 0.8.</li>
          <li>House effect control: each pollster's newest poll counts fully, its next-newest half, then a quarter, so frequent pollsters don't dominate.</li>
          <li>Party-commissioned polls get half weight. 2PP uses only polls that publish a Labor-v-Coalition figure (pollster's own method).</li>
          <li>"Coalition" (LNP) = Liberal + Nationals + LNP + CLP. Federal baseline deltas compare with 2025 national first preferences from the AEC.</li>
        </ul>
        <p className="au-note">Polls compiled by PolTok research from The Poll Bludger (federal) and Wikipedia's Victorian polling page; see docs/research/australia.md.</p>
      </Card>
    </div>
  );
}
