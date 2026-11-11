import { useMemo, useState } from 'react';
import { useSeo } from '../../lib/seo';
import { Link } from 'react-router-dom';
import type { PollSeries } from '../../types';
import { raceById } from '../../data';
import { POLL_SERIES } from '../../data/polls';
import { EmptyState, PageHeader, RatingBadge, StatGroup, StatTile } from '../../components';
import { PollChart, type Range } from './PollChart';
import { DAY, fmtDay, headline, marginOf, parseDay, preparePolls, rollingAverage, signed } from './pollMath';
import { Segmented } from './ui';
import './polls.css';
import { ink } from '../../lib/format';

const isGeneric = (s: PollSeries) => s.id === 'generic-ballot' || /generic/i.test(s.title);
const isApproval = (s: PollSeries) => s.id === 'trump-approval' || /approv/i.test(s.title);

function useSeriesAverages(series: PollSeries | undefined) {
  return useMemo(() => {
    if (!series) return null;
    const polls = preparePolls(series);
    if (!polls.length) return null;
    const end = Math.max(polls[polls.length - 1].t, Math.floor(Date.now() / DAY) * DAY + DAY / 2);
    const avg = rollingAverage(polls, series.keys.map((k) => k.key), polls[0].t, end);
    return { polls, avg };
  }, [series]);
}

/* ---------- headline stat tile ---------- */
function PollStat({ label, value, delta, sub, color }: { label: string; value: string; delta: number | null; sub?: string; color?: string }) {
  const dir = delta == null || Math.abs(delta) < 0.05 ? 0 : delta > 0 ? 1 : -1;
  return (
    <StatTile
      label={label}
      value={<span style={{ color: ink(color, 45) }}>{value}</span>}
      sub={
        <>
          {delta == null ? (
            <span>{sub ?? 'Running total'}</span>
          ) : (
            <>
              <span aria-hidden className={`pl-arrow ${dir > 0 ? 'up' : dir < 0 ? 'down' : ''}`}>{dir > 0 ? '▲' : dir < 0 ? '▼' : '■'}</span>{' '}
              <span>{signed(delta)} vs 1 wk ago</span>
              {sub && <span> · {sub}</span>}
            </>
          )}
        </>
      }
    />
  );
}

function marginLabel(m: number, a: { label: string; color: string }, b: { label: string; color: string }) {
  const lead = m >= 0 ? a : b;
  return { text: `${shortLabel(lead.label)}+${Math.abs(m).toFixed(1)}`, color: lead.color };
}
const shortLabel = (l: string) => (/^dem/i.test(l) ? 'D' : /^rep/i.test(l) ? 'R' : l);
const partyOf = (k: { key: string }) => /-(d|r|i|l|g)\d*$/i.exec(k.key)?.[1].toUpperCase();
/** Compact label for table cells: party letter, Approve/Disapprove → App/Dis, else candidate last name. */
const cellLabel = (k: { key: string; label: string }) => {
  if (/^(D|R|I|L|G)$/.test(k.key)) return k.key;
  if (/^dem/i.test(k.label)) return 'D';
  if (/^rep/i.test(k.label)) return 'R';
  if (/^approve/i.test(k.label)) return 'App';
  if (/^disapprove/i.test(k.label)) return 'Dis';
  const parts = k.label.replace(/\s*\(.*\)$/, '').split(/\s+/);
  return parts[parts.length - 1] ?? k.label;
};

function Headlines({ generic, approval }: { generic?: PollSeries; approval?: PollSeries }) {
  const g = useSeriesAverages(generic);
  const a = useSeriesAverages(approval);
  const tiles: JSX.Element[] = [];

  if (generic && g && generic.keys.length >= 2) {
    const [k0, k1] = generic.keys;
    const mSeries = g.avg.map((p) => ({ ...p, v: { m: marginOf(p.v, generic.keys) ?? NaN } })).filter((p) => Number.isFinite(p.v.m));
    const h = headline(mSeries, 'm');
    if (h) {
      const ml = marginLabel(h.value, k0, k1);
      tiles.push(<PollStat key="gm" label="Generic ballot margin" value={ml.text} color={ml.color} delta={h.delta} sub={`${k0.label} ${g.avg.at(-1)?.v[k0.key]?.toFixed(1) ?? '–'} · ${k1.label} ${g.avg.at(-1)?.v[k1.key]?.toFixed(1) ?? '–'}`} />);
    }
  }
  if (approval && a && approval.keys.length >= 1) {
    const [k0, k1] = approval.keys;
    const h0 = headline(a.avg, k0.key);
    if (h0) tiles.push(<PollStat key="ap" label={`${approval.title.replace(/approval/i, '').trim() || 'President'} · ${k0.label}`} value={`${h0.value.toFixed(1)}%`} color={k0.color} delta={h0.delta} />);
    if (k1) {
      const mSeries = a.avg.map((p) => ({ ...p, v: { m: marginOf(p.v, approval.keys) ?? NaN } })).filter((p) => Number.isFinite(p.v.m));
      const hn = headline(mSeries, 'm');
      if (hn) tiles.push(<PollStat key="an" label="Net approval" value={signed(hn.value)} color={hn.value >= 0 ? k0.color : k1.color} delta={hn.delta} />);
    }
  }
  const total = POLL_SERIES.reduce((n, s) => n + (s.polls?.length ?? 0), 0);
  tiles.push(<PollStat key="n" label="Polls tracked" value={String(total)} delta={null} sub={`${POLL_SERIES.length} series`} />);

  return <StatGroup label="Polling averages" min={170}>{tiles}</StatGroup>;
}

/* ---------- chart card ---------- */
function ChartCard({ series, eyebrow, extra }: { series: PollSeries; eyebrow?: string; extra?: React.ReactNode }) {
  const [range, setRange] = useState<Range>('90');
  const s = useSeriesAverages(series);
  const last = s?.avg.at(-1);
  return (
    <section className="card pl-chart-card" aria-labelledby={`h-${series.id}`}>
      <header className="pl-chart-head">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2 id={`h-${series.id}`}>{series.title}</h2>
          <div className="pl-legend">
            {series.keys.map((k) => (
              <span key={k.key} className="pl-legend-item">
                <span className="pc-sw" style={{ background: k.color }} />
                {k.label}
                {last?.v[k.key] != null && <b className="mono">{last.v[k.key].toFixed(1)}%</b>}
              </span>
            ))}
            {extra}
          </div>
        </div>
        <Segmented
          label="Time range"
          value={range}
          onChange={setRange}
          options={[{ value: '30', label: '30D' }, { value: '90', label: '90D' }, { value: 'all', label: 'ALL' }]}
        />
      </header>
      {series.polls?.length ? (
        <PollChart series={series} range={range} height={300} />
      ) : (
        <div className="pl-empty">Polls for this series are loading from the data desk.</div>
      )}
      <footer className="pl-chart-foot">
        <span><span className="pl-dot-key" /> individual polls (size = sample, fade = age)</span>
        <span><span className="pl-line-key" /> 14-day weighted average</span>
        <span><span className="pl-band-key" /> typical poll spread</span>
      </footer>
    </section>
  );
}

/* ---------- race polls ---------- */
function RacePolls({ races }: { races: PollSeries[] }) {
  const [sel, setSel] = useState(races[0]?.id ?? '');
  const series = races.find((r) => r.id === sel) ?? races[0];
  if (!series) {
    return (
      <section className="card pl-chart-card">
        <div className="eyebrow">Race-level polls</div>
        <h2>Senate &amp; governor races</h2>
        <div className="pl-empty">Race polling series will appear here as the data desk publishes them.</div>
      </section>
    );
  }
  const race = raceById.get(series.id);
  return (
    <div className="pl-race">
      <div className="pl-race-picker" role="tablist" aria-label="Choose a race">
        {races.map((r) => {
          const rc = raceById.get(r.id);
          return (
            <button key={r.id} role="tab" aria-selected={r.id === series.id} className={`pl-chip ${r.id === series.id ? 'on' : ''}`} onClick={() => setSel(r.id)}>
              <span className="mono">{r.id}</span>
              {rc && <span className="pl-chip-r" style={{ background: ratingDot(rc.rating) }} />}
            </button>
          );
        })}
      </div>
      <ChartCard
        key={series.id}
        series={series}
        eyebrow="Race-level polls"
        extra={race ? (
          <span className="pl-legend-item">
            <RatingBadge rating={race.rating} />
            <Link className="pl-link" to={`/race/${race.id}`}>Race page →</Link>
          </span>
        ) : null}
      />
    </div>
  );
}
const RD: Record<string, string> = { 'Solid D': '#1f5eff', 'Likely D': '#4f86ff', 'Lean D': '#93b4ff', 'Toss-up': '#f5c518', 'Lean R': '#ff9aa8', 'Likely R': '#ff5c72', 'Solid R': '#e01e3c' };
const ratingDot = (r: string) => RD[r] ?? '#6b7189';

/* ---------- table ---------- */
type SortKey = 'date' | 'pollster' | 'sample' | 'margin' | 'series';
interface Row { key: string; seriesId: string; seriesTitle: string; pollster: string; date: string; t: number; sample?: number; pop?: string; result: { label: string; v: number; color: string }[]; margin: number | null; marginText: string; marginColor: string; grade?: string }

function PollTable() {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'date', dir: -1 });
  const [limit, setLimit] = useState(25);

  const rows = useMemo(() => {
    const out: Row[] = [];
    for (const s of POLL_SERIES) {
      for (let i = 0; i < (s.polls?.length ?? 0); i++) {
        const p = s.polls[i];
        const result = s.keys.filter((k) => p.values[k.key] != null).map((k) => ({ label: cellLabel(k), v: p.values[k.key], color: k.color }));
        const m = marginOf(p.values, s.keys);
        let marginText = '—';
        let mc = 'var(--text-3)';
        if (m != null && s.keys.length >= 2) {
          const lead = m >= 0 ? s.keys[0] : s.keys[1];
          const mm = Math.abs(m).toFixed(m % 1 ? 1 : 0);
          marginText = Math.abs(m) < 0.05 ? 'TIE' : /^approve/i.test(s.keys[0].label) ? `Net ${m > 0 ? '+' : '−'}${mm}` : `${partyOf(lead) ?? cellLabel(lead)}+${mm}`;
          mc = Math.abs(m) < 0.05 ? 'var(--text-2)' : lead.color;
        }
        out.push({ key: `${s.id}-${i}`, seriesId: s.id, seriesTitle: s.title, pollster: p.pollster, date: p.date, t: parseDay(p.date), sample: p.sample, pop: p.population, result, margin: m, marginText, marginColor: mc, grade: p.grade });
      }
    }
    return out;
  }, []);

  const view = useMemo(() => {
    const f = filter === 'all' ? rows : rows.filter((r) => r.seriesId === filter);
    const val = (r: Row): number | string => {
      switch (sort.k) {
        case 'date': return r.t || 0;
        case 'pollster': return r.pollster.toLowerCase();
        case 'sample': return r.sample ?? -1;
        case 'margin': return r.margin ?? -999;
        case 'series': return r.seriesTitle;
      }
    };
    return [...f].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir || b.t - a.t;
    });
  }, [rows, filter, sort]);

  const th = (k: SortKey, label: string, cls = '') => {
    const on = sort.k === k;
    return (
      <th className={cls} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button className={`pl-th ${on ? 'on' : ''}`} onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : k === 'pollster' || k === 'series' ? 1 : -1 }))}>
          {label}
          <span aria-hidden className="pl-sort">{on ? (sort.dir === 1 ? '↑' : '↓') : '↕'}</span>
        </button>
      </th>
    );
  };

  return (
    <section className="card pl-table-card" aria-labelledby="h-allpolls">
      <header className="pl-chart-head">
        <div>
          <div className="eyebrow">Every poll</div>
          <h2 id="h-allpolls">All polls</h2>
          <div className="pl-sub">{view.length} poll{view.length === 1 ? '' : 's'} · click a column to sort</div>
        </div>
        <label className="pl-select">
          <span className="sr-only">Filter by series</span>
          <select value={filter} onChange={(e) => { setFilter(e.target.value); setLimit(25); }}>
            <option value="all">All series</option>
            {POLL_SERIES.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </label>
      </header>
      {view.length === 0 ? (
        <div className="pl-empty">No polls yet.</div>
      ) : (
        <div className="pl-table-scroll">
          <table className="pl-table">
            <thead>
              <tr>
                {th('date', 'Date')}
                {th('pollster', 'Pollster')}
                {th('series', 'Race', 'hide-sm')}
                {th('sample', 'Sample', 'num')}
                <th className="hide-sm">Pop.</th>
                <th className="hide-xs">Result</th>
                {th('margin', 'Margin', 'num')}
              </tr>
            </thead>
            <tbody>
              {view.slice(0, limit).map((r) => (
                <tr key={r.key}>
                  <td className="mono nowrap">{r.t ? fmtDay(r.t) : r.date}</td>
                  <td className="pl-td-pollster">
                    {r.pollster}
                    {r.grade && <span className="pl-grade mono">{r.grade}</span>}
                    <div className="pl-td-series show-sm">{r.seriesTitle}</div>
                  </td>
                  <td className="hide-sm pl-td-series">{r.seriesTitle}</td>
                  <td className="mono num">{r.sample ? r.sample.toLocaleString('en-US') : '—'}</td>
                  <td className="mono hide-sm">{r.pop ?? '—'}</td>
                  <td className="mono hide-xs nowrap">
                    {r.result.map((x, i) => (
                      <span key={i} className="pl-res"><span className="pl-ink" style={{ ["--c" as string]: x.color }}>{x.label}</span> {x.v}</span>
                    ))}
                  </td>
                  <td className="mono num">
                    <span className="pl-margin pl-ink" style={{ ["--c" as string]: r.marginColor, borderColor: r.marginColor }}>{r.marginText}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {view.length > limit && (
        <button className="pl-more" onClick={() => setLimit((l) => l + 50)}>Show {Math.min(50, view.length - limit)} more</button>
      )}
    </section>
  );
}

/* ---------- page ---------- */
export default function PollsPage() {
  useSeo({ title: 'Polls', description: 'Latest election polls, polling averages and trend charts.' });
  const generic = POLL_SERIES.find(isGeneric);
  const approval = POLL_SERIES.find(isApproval);
  const raceSeries = POLL_SERIES.filter((s) => s !== generic && s !== approval);
  const latest = useMemo(() => {
    let t = 0;
    for (const s of POLL_SERIES) for (const p of s.polls ?? []) t = Math.max(t, parseDay(p.date) || 0);
    return t;
  }, []);

  return (
    <div className="page pl-page">
      <PageHeader
        className="pl-hero"
        kicker="Polls · 2026 midterms"
        title="The polling picture"
        crumbLabel="Polls"
        sub="Every public poll we track, smoothed into a time- and sample-weighted average. Hover or use arrow keys on any chart to inspect a day."
        meta={latest > 0 ? <span>Latest poll: {fmtDay(latest, { month: 'short', day: 'numeric', year: 'numeric' })}</span> : undefined}
      />

      <Headlines generic={generic} approval={approval} />

      <div className="pl-grid2">
        {generic ? <ChartCard series={generic} eyebrow="Congress" /> : <EmptyCard title="Generic congressional ballot" />}
        {approval ? <ChartCard series={approval} eyebrow="White House" /> : <EmptyCard title="Presidential approval" />}
      </div>

      <RacePolls races={raceSeries} />

      <PollTable />

      <section className="card pl-method" aria-labelledby="h-method">
        <h2 id="h-method">How the averages work</h2>
        <div className="pl-method-grid">
          <p><b>Window.</b> Each day&apos;s average uses polls whose field period ended in the previous 14 days. Older polls fade with a Gaussian decay that halves a poll&apos;s weight at six days old.</p>
          <p><b>Sample &amp; population.</b> Weight grows with the square root of sample size (capped) — a 2,400-person poll counts about twice a 600-person poll, not four times. Likely-voter polls count fully, registered voters 0.9×, all adults 0.75×.</p>
          <p><b>Flooding.</b> A pollster with several polls in the window has each poll down-weighted by 1/√k so frequent trackers can&apos;t dominate.</p>
          <p><b>The band</b> shows the weighted spread of individual polls around the average (≈90% of polls fall inside). It is not a margin of error on the election result — polls can miss together.</p>
        </div>
        <p className="pl-fine">No house-effect or partisan-sponsor adjustments are applied. Poll data are compiled from public releases; see each pollster for full methodology.</p>
      </section>
    </div>
  );
}

function EmptyCard({ title }: { title: string }) {
  return (
    <section className="card pl-chart-card">
      <h2>{title}</h2>
      <EmptyState compact title="No polls in this series yet" description="It will appear here once public polls are released." />
    </section>
  );
}
