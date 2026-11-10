/** Owner analytics: anonymous first-party pageviews (server/analytics.js). No cookies, no IPs stored. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../components';
import { getToken } from './auth';
import { downloadBlob } from './xstudio/actions';
import './xstudio/xstudio.css';

interface Row { key: string; count: number }
interface Stats {
  generatedAt: number;
  range: { days: number; from: string; to: string };
  totals: Record<'today' | 'd7' | 'd30' | 'range', { pv: number; visitors: number }>;
  live: number;
  series: { day: string; pv: number; visitors: number; x: number }[];
  top: Record<'pages' | 'refs' | 'src' | 'countries' | 'devices' | 'themes' | 'app', Row[]>;
  events: { play: number; ask: number };
  x: { pv: number; visitors: number };
}
const RANGES = [1, 7, 30, 90] as const;
const fmt = (n: number) => n.toLocaleString();
const flag = (cc: string) => (/^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) + ' ' : '');

function Trend({ s }: { s: Stats['series'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220, L = 36, B = 22, T = 10;
  const max = Math.max(4, ...s.map((x) => x.pv));
  const step = (W - L) / s.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, Math.round(max / 2), max];
  const line = s.map((x, i) => `${i ? 'L' : 'M'}${L + step * i + step / 2},${y(x.visitors)}`).join(' ');
  const h = hover != null ? s[hover] : null;
  return (
    <div style={{ position: 'relative' }} ref={box}>
      <div className="an-legend"><span><i style={{ background: 'var(--signal)', opacity: 0.5 }} />Pageviews</span><span><i style={{ background: 'var(--accent)' }} />Visitors</span>{h && <span style={{ marginLeft: 'auto', color: 'var(--text)' }}>{h.day}: {fmt(h.pv)} pageviews · {fmt(h.visitors)} visitors{h.x ? ` · ${h.x} from X` : ''}</span>}</div>
      <svg className="an-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily pageviews and visitors, ${s[0]?.day} to ${s[s.length - 1]?.day}`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line className="an-grid" x1={L} x2={W} y1={y(t)} y2={y(t)} /><text className="an-axis" x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
        {s.map((x, i) => {
          const bw = Math.max(1, step - 2);
          const top = y(x.pv);
          return (
            <g key={x.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={-1}>
              <rect x={L + step * i} y={T} width={step} height={H - T - B} fill="transparent" />
              {x.pv > 0 && <rect className="an-pv" x={L + step * i + 1} y={top} width={bw} height={Math.max(1, H - B - top)} rx={Math.min(4, bw / 2)} style={hover === i ? { opacity: 0.7 } : undefined} />}
              <title>{`${x.day}: ${x.pv} pageviews, ${x.visitors} visitors`}</title>
            </g>
          );
        })}
        {s.length > 1 && <path className="an-v" d={line} />}
        {s.length === 1 && <circle cx={L + step / 2} cy={y(s[0].visitors)} r={5} fill="var(--accent)" />}
        {[0, Math.floor(s.length / 2), s.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => <text key={i} className="an-axis" x={L + step * i + step / 2} y={H - 6} textAnchor="middle">{s[i]?.day.slice(5)}</text>)}
      </svg>
    </div>
  );
}

function Table({ title, rows, label = (k: string) => k }: { title: string; rows: Row[]; label?: (k: string) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="ow-tweet">
      <b>{title}</b>
      {rows.length ? (
        <table className="an-t"><tbody>
          {rows.map((r) => <tr key={r.key}><td className="an-k">{label(r.key)}<span className="an-bar" style={{ width: `${(100 * r.count) / max}%` }} /></td><td>{fmt(r.count)}</td></tr>)}
        </tbody></table>
      ) : <p className="ow-muted">No data yet.</p>}
    </section>
  );
}

function toCsv(s: Stats) {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [['day', 'pageviews', 'visitors', 'from_x'].join(',')];
  for (const r of s.series) lines.push([r.day, r.pv, r.visitors, r.x].join(','));
  lines.push('', ['breakdown', 'key', 'count'].join(','));
  for (const [k, rows] of Object.entries(s.top)) for (const r of rows) lines.push([q(k), q(r.key), r.count].join(','));
  lines.push('', `${q('events')},${q('play_views')},${s.events.play}`, `${q('events')},${q('ask_views')},${s.events.ask}`);
  return lines.join('\n');
}

export function Analytics() {
  const [days, setDays] = useState<number>(30);
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    setErr('');
    try {
      const r = await fetch(`/api/analytics?days=${days}`, { headers: { authorization: `Bearer ${getToken() ?? ''}` }, cache: 'no-store' });
      const d = (await r.json().catch(() => ({}))) as Stats & { error?: string };
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setS(d);
    } catch (e) {
      setErr((e as Error).message || 'Analytics unavailable');
    }
  }, [days]);
  useEffect(() => {
    void load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);
  return (
    <section className="ow-studio" aria-label="Analytics">
      <div className="ow-actions" style={{ alignItems: 'center' }}>
        <div className="ow-filter" role="radiogroup" aria-label="Range" style={{ margin: 0 }}>
          {RANGES.map((n) => <button key={n} type="button" role="radio" aria-checked={days === n} className={`ow-pill ${days === n ? 'is-on' : ''}`} onClick={() => setDays(n)}>{n === 1 ? 'Today' : `${n} days`}</button>)}
        </div>
        <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
        <Button size="sm" variant="ghost" disabled={!s} onClick={() => s && downloadBlob(new Blob([toCsv(s)], { type: 'text/csv' }), `poltok-analytics-${s.range.from}_${s.range.to}.csv`)}>Export CSV</Button>
      </div>
      {err && <p className="ow-err" role="status">{err}</p>}
      {!s && !err && <p className="ow-muted">Loading…</p>}
      {s && (
        <>
          <div className="an-kpis">
            <div className="an-kpi"><span>Live (last 5 min)</span><b>{fmt(s.live)}</b><span>visitors now</span></div>
            <div className="an-kpi"><span>Today</span><b>{fmt(s.totals.today.visitors)}</b><span>{fmt(s.totals.today.pv)} pageviews</span></div>
            <div className="an-kpi"><span>7 days</span><b>{fmt(s.totals.d7.visitors)}</b><span>{fmt(s.totals.d7.pv)} pageviews</span></div>
            <div className="an-kpi"><span>30 days</span><b>{fmt(s.totals.d30.visitors)}</b><span>{fmt(s.totals.d30.pv)} pageviews</span></div>
            <div className="an-kpi"><span>From X (utm_source=x)</span><b>{fmt(s.x.visitors)}</b><span>{fmt(s.x.pv)} pageviews in range</span></div>
            <div className="an-kpi"><span>QUORUM /play</span><b>{fmt(s.events.play)}</b><span>game views in range</span></div>
            <div className="an-kpi"><span>Ask PolTok</span><b>{fmt(s.events.ask)}</b><span>/ask views in range</span></div>
          </div>
          <section className="ow-tweet"><b>Trend · {s.range.from} → {s.range.to}</b><Trend s={s.series} /></section>
          <div className="an-tables">
            <Table title="Top pages" rows={s.top.pages} />
            <Table title="Sources (utm / referral / direct)" rows={s.top.src} />
            <Table title="Referrers" rows={s.top.refs} />
            <Table title="Countries" rows={s.top.countries} label={(k) => flag(k) + (k === '??' ? 'Unknown' : k)} />
            <Table title="Devices" rows={s.top.devices} />
            <Table title="Themes" rows={s.top.themes} />
            <Table title="Installed app vs browser" rows={s.top.app} />
          </div>
          <p className="ow-muted">Visitors are counted with a salted hash that rotates daily (never stored with IPs or user agents), so multi-day totals are the sum of daily visitors. Do Not Track / GPC, bots, localhost and your own owner sessions are not counted. Updated {new Date(s.generatedAt).toLocaleTimeString()}.</p>
        </>
      )}
    </section>
  );
}
