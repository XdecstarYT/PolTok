/** /au/victoria/premier — Battle for Premier: Carroll v Wilson v Pickering. Live preferred-premier and approval polling
 *  (Wikipedia's Victorian polling page), the leaders' profiles and the PolTok model's majority chances. */
import { type CSSProperties } from 'react';
import { m as M } from 'framer-motion';
import { PageHeader } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { AuNav } from '../AuNav';
import { useVicLive, vicColor, type Leader, type VicExtra } from '../vicLive';
import { candidates, type Person } from '../parliament/people';
import { Face, ProfileHost, openProfile, profileUrl } from '../parliament/Profile';
import { bioOf } from '../parliament/Dossier';
import { Link } from 'react-router-dom';
import '../au.css';
import '../parliament/profile.css';
import './insights.css';

const LEADERS: { k: Leader; seat: string; party: string; role: string; c: string }[] = [
  { k: 'Wilson', seat: 'vic-kew', party: 'LNP', role: 'Liberal leader · Opposition', c: vicColor('LNP') },
  { k: 'Carroll', seat: 'vic-niddrie', party: 'ALP', role: 'Labor leader · Premier', c: vicColor('ALP') },
  { k: 'Pickering', seat: 'vic-pakenham', party: 'ONP', role: 'One Nation leader', c: vicColor('ONP') },
];
const personOf = (seat: string, k: string): Person | null => candidates(seat).find((p) => p.name.endsWith(k)) ?? null;
const avg = (xs: (number | null | undefined)[]) => { const v = xs.filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const fmt = (x: number | null, d = 0) => (x == null ? '—' : x.toFixed(d));
const signed = (x: number | null) => (x == null ? '—' : `${x > 0 ? '+' : ''}${Math.round(x)}`);

function Trend({ rows }: { rows: NonNullable<VicExtra['preferred']> }) {
  const r = [...rows].reverse();
  if (r.length < 2) return null;
  const W = 640, H = 200, pad = 26;
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (r.length - 1);
  const y = (v: number) => H - pad - (v / 50) * (H - 2 * pad);
  return (
    <svg className="pm-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Preferred premier, recent polls">
      {[10, 20, 30, 40].map((g) => <g key={g}><line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} className="pm-grid" /><text x={4} y={y(g) + 4} className="pm-ax">{g}</text></g>)}
      {LEADERS.map((L) => {
        const pts = r.map((p, i) => (p[L.k] != null ? `${x(i)},${y(p[L.k] as number)}` : null)).filter(Boolean).join(' ');
        return (
          <g key={L.k} style={{ ['--c' as string]: L.c } as CSSProperties}>
            <M.polyline points={pts} className="pm-line" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
            {r.map((p, i) => p[L.k] != null && <circle key={i} cx={x(i)} cy={y(p[L.k] as number)} r={3.5} className="pm-dot"><title>{`${p.firm} ${p.date}: ${L.k} ${p[L.k]}%`}</title></circle>)}
          </g>
        );
      })}
    </svg>
  );
}

export default function PremierPage() {
  useSeo({ title: 'Battle for Premier · Victoria 2026', description: 'Ben Carroll v Jess Wilson v Warren Pickering: live preferred-premier and approval polling, profiles and each side\'s chance of majority government.' });
  const { data, loading: isLoading } = useVicLive();
  const x = data?.extra;
  const pref = x?.preferred ?? [];
  const appr = x?.approval ?? [];
  const recent = pref.slice(0, 4);
  const prefAvg = Object.fromEntries(LEADERS.map((L) => [L.k, avg(recent.map((p) => p[L.k]))]));
  const netAvg = Object.fromEntries(LEADERS.map((L) => [L.k, avg(appr.slice(0, 4).map((a) => a[L.k]?.net))]));
  const posAvg = Object.fromEntries(LEADERS.map((L) => [L.k, avg(appr.slice(0, 4).map((a) => a[L.k]?.pos))]));
  const negAvg = Object.fromEntries(LEADERS.map((L) => [L.k, avg(appr.slice(0, 4).map((a) => a[L.k]?.neg))]));
  const maj = data?.model?.majority;
  const chance: Record<Leader, { v: number | null; label: string }> = {
    Carroll: { v: maj ? maj.ALP : null, label: 'chance of a Labor majority' },
    Wilson: { v: maj ? maj.LNP : null, label: 'chance of a Coalition majority' },
    Pickering: { v: maj ? maj.hung : null, label: 'chance of a hung parliament (kingmaker territory)' },
  };
  const leader = [...LEADERS].sort((a, b) => (prefAvg[b.k] ?? 0) - (prefAvg[a.k] ?? 0))[0];
  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · Sat 28 Nov" title="Battle for Premier" crumbLabel="Battle for Premier"
        sub="Three leaders, one job. Who Victorians prefer as Premier, how they rate each leader, and each side's path to government.">
        <AuNav />
      </PageHeader>
      {isLoading && !data && <p className="faint">Loading live leadership polling…</p>}
      <div className="pm-ring">
        {LEADERS.map((L, i) => {
          const p = personOf(L.seat, L.k);
          const bio = p ? bioOf(p) : null;
          const ch = chance[L.k];
          return (
            <M.section key={L.k} className={`pm-card lg ${leader?.k === L.k && pref.length ? 'is-ahead' : ''}`} style={{ ['--c' as string]: L.c } as CSSProperties}
              initial={{ opacity: 0, y: 30, rotateX: 12 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: i * 0.12, type: 'spring', stiffness: 120, damping: 16 }}>
              <span className="pm-card__glow" aria-hidden="true" />
              {p ? <Face p={p} ctx="pm" size={112} color={L.c} label={`Open ${p.name}'s profile`} /> : <div className="pm-ini">{L.k[0]}</div>}
              <div className="pm-card__id">
                <span className="pf__kicker">{L.role}</span>
                <h2>{p?.name ?? L.k}</h2>
                <small>{p ? `Contesting ${p.seatName}` : ''}</small>
              </div>
              <div className="pm-stat">
                <b className="num">{fmt(prefAvg[L.k])}<i>%</i></b>
                <span>preferred Premier<br /><small>avg of {recent.length || 0} latest polls</small></span>
              </div>
              <div className="pm-meter" aria-hidden="true"><M.i initial={{ width: 0 }} animate={{ width: `${Math.min(100, (prefAvg[L.k] ?? 0) * 2)}%` }} transition={{ delay: 0.4 + i * 0.1, duration: 0.9 }} /></div>
              <div className="pm-net">
                <span className={`pm-net__v ${(netAvg[L.k] ?? 0) >= 0 ? 'up' : 'down'}`}>{signed(netAvg[L.k])}</span>
                <span>net approval<br /><small>{fmt(posAvg[L.k])}% approve · {fmt(negAvg[L.k])}% disapprove</small></span>
              </div>
              {ch.v != null && <p className="pm-chance"><b className="num">{ch.v < 0.005 ? '<1' : ch.v > 0.995 ? '>99' : Math.round(ch.v * 100)}%</b> {ch.label}<small> · PolTok model</small></p>}
              {bio?.summary && <p className="pf__bio pm-bio">{bio.summary.split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')}</p>}
              {p && <div className="pf__actions"><button type="button" className="lg-btn" onClick={() => openProfile(p, `pm:${p.seatId}:${p.name}`)}>Profile card</button><Link className="lg-btn" to={profileUrl(p)}>Full dossier →</Link></div>}
            </M.section>
          );
        })}
      </div>

      <div className="vp-grid" style={{ marginTop: 16 }}>
        <section className="ds__sec lg vp-wide">
          <h3 className="ds__h"><span>📈</span>Preferred Premier, poll by poll</h3>
          {pref.length ? <Trend rows={pref} /> : <p className="faint">No preferred-premier polling available right now.</p>}
          <div className="pm-legend">{LEADERS.map((L) => <span key={L.k} style={{ ['--c' as string]: L.c } as CSSProperties}><i />{L.k}</span>)}</div>
          <div className="pm-table" role="table">
            <div className="pm-tr pm-tr--h" role="row"><span>Poll</span>{LEADERS.map((L) => <span key={L.k}>{L.k}</span>)}<span>Unsure</span></div>
            {pref.map((p, i) => (
              <div key={i} className="pm-tr" role="row"><span><b>{p.firm}</b><small>{p.date}</small></span>
                {LEADERS.map((L) => { const top = Math.max(...LEADERS.map((q) => p[q.k] ?? 0)); return <span key={L.k} className={p[L.k] === top ? 'is-top' : ''} style={{ ['--c' as string]: L.c } as CSSProperties}>{p[L.k] == null ? '—' : `${p[L.k]}%`}</span>; })}
                <span className="faint">{fmt(p.DK)}%</span></div>
            ))}
          </div>
        </section>
        <section className="ds__sec lg vp-wide">
          <h3 className="ds__h"><span>👍</span>Leader approval</h3>
          <div className="pm-appr">
            {appr.slice(0, 6).map((a, i) => (
              <div key={i} className="pm-appr__row">
                <span><b>{a.firm}</b><small>{a.date}</small></span>
                {LEADERS.map((L) => { const v = a[L.k]; return (
                  <span key={L.k} className="pm-diverge" style={{ ['--c' as string]: L.c } as CSSProperties} title={`${L.k}: ${fmt(v?.pos ?? null)}% approve, ${fmt(v?.neg ?? null)}% disapprove`}>
                    <em>{L.k}</em>
                    <span className="pm-diverge__bar"><i className="neg" style={{ width: `${(v?.neg ?? 0)}%` }} /><i className="pos" style={{ width: `${(v?.pos ?? 0)}%` }} /></span>
                    <b className={(v?.net ?? 0) >= 0 ? 'up' : 'down'}>{signed(v?.net ?? null)}</b>
                  </span>); })}
              </div>
            ))}
            {!appr.length && <p className="faint">No approval polling available right now.</p>}
          </div>
        </section>
      </div>
      <p className="vp-method">Polling: Wikipedia, "Opinion polling for the 2026 Victorian state election", refreshed every 10 minutes. Averages use the four most recent polls. Majority chances come from the PolTok seat model ({data?.model?.sims ?? 2000} simulations); a hung parliament isn't a One Nation government, but it is where a crossbench leader has the most leverage.</p>
      <ProfileHost />
    </div>
  );
}
