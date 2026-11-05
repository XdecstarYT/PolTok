/** /au/history — federal House results 1996–2025 and prime ministers timeline. */
import { Link } from 'react-router-dom';
import { Card } from '../../components';
import { useSeo } from '../../lib/seo';
import { AU_PMS, AU_PMS_SOURCE, FED_HISTORY, FED_HISTORY_SOURCE } from '../../data/au-states';
import { AuNav } from './AuNav';
import { LineChart } from './charts';
import { pColor } from './model';
import './au.css';

const OTH = '#8b93a7';

export default function HistoryPage() {
  useSeo({ title: 'Australian federal elections 1996–2025', description: 'House of Representatives seats and two-party-preferred vote at every federal election since 1996, plus the prime ministers timeline.' });
  const t0 = Date.parse(AU_PMS[0].from), t1 = Date.now();
  const pos = (d: string | null) => (((d ? Date.parse(d) : t1) - t0) / (t1 - t0)) * 100;
  const years = Array.from({ length: Math.floor((new Date(t1).getUTCFullYear() - 1996) / 5) + 1 }, (_, i) => 1996 + i * 5);
  return (
    <div className="page au-page">
      <AuNav />
      <header className="au-head">
        <div>
          <div className="au-kicker mono"><Link to="/au">AUSTRALIA</Link> / HISTORY</div>
          <h1>Federal elections since 1996</h1>
          <p className="au-sub">Eleven elections, eight prime ministers.</p>
        </div>
      </header>

      <Card title="Two-party-preferred vote" kicker="Labor v Coalition, national %">
        <LineChart
          ariaLabel="Labor and Coalition two-party-preferred vote by election, 1996 to 2025"
          yMin={40} yMax={60} refY={50} xFmt={(x) => `${x}`} yFmt={(v) => `${v}`}
          series={[
            { key: 'ALP', label: 'ALP', color: pColor('ALP'), pts: FED_HISTORY.map((r) => ({ x: r.year, y: r.alpTpp })) },
            { key: 'LNP', label: 'L/NP', color: pColor('LIB'), pts: FED_HISTORY.map((r) => ({ x: r.year, y: Math.round((100 - r.alpTpp) * 10) / 10 })) },
          ]}
        />
      </Card>

      <Card title="House seats by election" kicker="Labor · others · Coalition">
        <ul className="au-hist">
          {FED_HISTORY.map((r) => (
            <li key={r.year}>
              <span className="mono au-hist-y">{r.year}</span>
              <div className="au-hist-bar" role="img" aria-label={`${r.year}: Labor ${r.alp}, others ${r.other}, Coalition ${r.coalition} of ${r.seats}`}>
                <span style={{ width: `${(r.alp / r.seats) * 100}%`, background: pColor('ALP') }}>{r.alp}</span>
                <span style={{ width: `${(r.other / r.seats) * 100}%`, background: OTH }}>{r.other > 3 ? r.other : ''}</span>
                <span style={{ width: `${(r.coalition / r.seats) * 100}%`, background: pColor('LIB') }}>{r.coalition}</span>
                <i style={{ left: '50%' }} aria-hidden />
              </div>
              <span className="mono muted au-hist-pm">{r.pm}</span>
            </li>
          ))}
        </ul>
        <p className="au-note">Bar width = share of House seats ({FED_HISTORY[0].seats}–{Math.max(...FED_HISTORY.map((r) => r.seats))}); the tick marks half the chamber. "Others" include Greens, Katter's, Centre Alliance/NXT, Palmer United, WA Nationals (2010) and independents. Winner shown is who formed government after the election.</p>
      </Card>

      <Card title="Prime ministers" kicker="Since March 1996">
        <div className="au-pm-tl" role="list">
          {AU_PMS.map((p, i) => (
            <div key={i} role="listitem" className="au-pm" style={{ left: `${pos(p.from)}%`, width: `${pos(p.to) - pos(p.from)}%`, background: pColor(p.party) }} title={`${p.name} (${p.party}) ${p.from} – ${p.to ?? 'present'}`}>
              <span>{p.name.split(' ').slice(-1)[0]}</span>
            </div>
          ))}
        </div>
        <div className="au-pm-axis mono muted">{years.map((y) => <span key={y} style={{ left: `${pos(`${y}-01-01`)}%` }}>{y}</span>)}</div>
        <ol className="au-pm-list">
          {AU_PMS.map((p, i) => (
            <li key={i}><i style={{ background: pColor(p.party) }} /><b>{p.name}</b><span className="mono muted">{p.party} · {p.from} – {p.to ?? 'present'}</span></li>
          ))}
        </ol>
      </Card>
      <p className="au-foot muted">Sources: <a href={FED_HISTORY_SOURCE.url} target="_blank" rel="noreferrer">{FED_HISTORY_SOURCE.label}</a>; <a href={AU_PMS_SOURCE.url} target="_blank" rel="noreferrer">{AU_PMS_SOURCE.label}</a>. 2025 figures cross-checked against the AEC (<Link to="/au/seat/kooyong">division pages</Link>).</p>
    </div>
  );
}
