/**
 * /members — directory of the 119th US Congress (congress-legislators + Voteview) and the
 * Australian Parliament (compiled research data in src/data/au.ts). Search, filters, ideology scatter.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FEDERAL } from '../../data/au';
import { AU_MEMBERS, US_PARTY, initials, usDir, useJson, type DirMember, type UsListResp } from './data';
import './members.css';

export function Avatar({ m, size = 56 }: { m: { name: string; photo?: string; color: string }; size?: number }) {
  const [bad, setBad] = useState(false);
  const style = { width: size, height: size * 1.22, borderColor: m.color };
  if (m.photo && !bad) return <img className="mb-av" src={m.photo} alt="" loading="lazy" width={size} height={Math.round(size * 1.22)} style={style} onError={() => setBad(true)} />;
  return <span className="mb-av mb-ini" style={{ ...style, background: m.color, fontSize: size * 0.36 }} aria-hidden="true">{initials(m.name)}</span>;
}

function Scatter({ list }: { list: DirMember[] }) {
  const pts = list.filter((m) => m.dim1 != null && m.dim2 != null);
  if (!pts.length) return null;
  const W = 640, H = 300, pad = 24;
  const x = (v: number) => pad + ((v + 1) / 2) * (W - 2 * pad);
  const y = (v: number) => H - pad - ((v + 1) / 2) * (H - 2 * pad);
  return (
    <figure className="mb-panel mb-scatter">
      <figcaption><b>Ideology map</b> · DW-NOMINATE, 119th Congress ({pts.length} members). Left–right = 1st dimension (economic liberal ↔ conservative); up–down = 2nd dimension. Click a dot.</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter plot of members by DW-NOMINATE score">
        <line x1={x(0)} x2={x(0)} y1={pad} y2={H - pad} className="mb-axis" />
        <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} className="mb-axis" />
        <text x={pad} y={H - 6} className="mb-ax">← Liberal</text>
        <text x={W - pad} y={H - 6} textAnchor="end" className="mb-ax">Conservative →</text>
        {pts.map((m) => (
          <Link key={m.key} to={`/member/${m.key}`}>
            <circle cx={x(m.dim1!)} cy={y(m.dim2!)} r={m.chamber === 'senate' ? 4.5 : 3} fill={m.color} fillOpacity={0.75} stroke={m.chamber === 'senate' ? 'var(--text)' : 'none'} strokeWidth={0.8}>
              <title>{`${m.name} (${m.party}-${m.seat}) · dim1 ${m.dim1!.toFixed(3)}`}</title>
            </circle>
          </Link>
        ))}
      </svg>
      <div className="mb-legend"><span><i style={{ background: 'var(--dem, #3d7bff)' }} />Democrat</span><span><i style={{ background: 'var(--rep, #ff3d55)' }} />Republican</span><span>Outlined dot = senator</span></div>
    </figure>
  );
}

export default function MembersPage() {
  const [sp, setSp] = useSearchParams();
  const country = sp.get('c') === 'au' ? 'AU' : 'US';
  const chamber = sp.get('ch') || 'all';
  const party = sp.get('p') || 'all';
  const state = sp.get('s') || 'all';
  const [q, setQ] = useState(sp.get('q') || '');
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v === 'all' || !v) n.delete(k); else n.set(k, v); if (k === 'c') { n.delete('p'); n.delete('s'); } setSp(n, { replace: true }); };

  const us = useJson<UsListResp>(country === 'US' ? '/api/members/us' : null);
  const all = useMemo(() => (country === 'US' ? (us.data?.members || []).map(usDir) : AU_MEMBERS), [country, us.data]);
  const parties = useMemo(() => [...new Set(all.map((m) => m.party))].sort(), [all]);
  const states = useMemo(() => [...new Set(all.map((m) => m.state))].sort(), [all]);
  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return all
      .filter((m) => (chamber === 'all' || m.chamber === chamber) && (party === 'all' || m.party === party) && (state === 'all' || m.state === state))
      .filter((m) => !qq || `${m.name} ${m.seat} ${m.state} ${m.partyLabel}`.toLowerCase().includes(qq))
      .sort((a, b) => a.last.localeCompare(b.last));
  }, [all, chamber, party, state, q]);
  const label = (p: string) => (country === 'US' ? US_PARTY[p] || p : p);

  return (
    <main className="page mb-page">
      <header>
        <div className="mb-kicker">MEMBERS · {country === 'US' ? '119TH US CONGRESS' : '48TH AUSTRALIAN PARLIAMENT'}</div>
        <h1>Who represents you</h1>
        <p className="mb-sub">Every sitting member of {country === 'US' ? 'the US Senate and House' : 'the Australian House of Representatives and Senate'} — facts from open data only.</p>
      </header>

      <div className="mb-seg" role="tablist" aria-label="Country">
        {(['US', 'AU'] as const).map((c) => <button key={c} role="tab" aria-selected={country === c} className={country === c ? 'on' : ''} onClick={() => set('c', c === 'AU' ? 'au' : '')}>{c === 'US' ? 'US Congress' : 'Australia'}</button>)}
      </div>

      <div className="mb-filters">
        <input type="search" placeholder="Search name, state, seat…" value={q} onChange={(e) => { setQ(e.target.value); set('q', e.target.value); }} aria-label="Search members" />
        <select value={chamber} onChange={(e) => set('ch', e.target.value)} aria-label="Chamber">
          <option value="all">Both chambers</option><option value="senate">Senate</option><option value="house">House</option>
        </select>
        <select value={party} onChange={(e) => set('p', e.target.value)} aria-label="Party">
          <option value="all">All parties</option>{parties.map((p) => <option key={p} value={p}>{label(p)}</option>)}
        </select>
        <select value={state} onChange={(e) => set('s', e.target.value)} aria-label="State">
          <option value="all">All states</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="mb-count">{list.length} members</span>
      </div>

      {country === 'US' && us.loading && <p className="mb-muted">Loading Congress data…</p>}
      {country === 'US' && us.error && <p className="mb-muted">Could not load Congress data ({us.error}).</p>}
      {country === 'US' && us.data?.notes.map((n) => <p key={n} className="mb-muted">{n}</p>)}
      {country === 'US' && <Scatter list={list} />}
      {country === 'AU' && <p className="mb-muted mb-small">Australian members from PolTok’s compiled research data (House as of {FEDERAL.houseAsOf}, Senate as of {FEDERAL.senateAsOf}; margins are 2025 two-candidate-preferred). No official photos are shown because their licence isn’t verified — initials only.</p>}

      <div className="mb-cards">
        {list.map((m) => (
          <Link key={m.key} to={`/member/${m.key}`} className="mb-card" style={{ borderLeftColor: m.color }}>
            <Avatar m={m} size={48} />
            <div className="mb-cbody">
              <b>{m.name}</b>
              <span style={{ color: m.color }}>{m.partyLabel}</span>
              <small>{m.seat}{m.margin != null ? ` · margin ${m.margin.toFixed(1)}%` : ''}</small>
              {m.unity != null && <small>Votes with party {m.unity}%</small>}
            </div>
          </Link>
        ))}
      </div>

      <footer className="mb-src">
        {country === 'US'
          ? <>Sources: {us.data?.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}{us.data?.voteview && <> · Voteview roll calls through {us.data.voteview.latest.House}</>}{us.data && <> · fetched {new Date(us.data.at).toISOString().slice(0, 10)}</>}</>
          : <>Source: PolTok research compilation (src/data/au.ts, compiled 2026-11-04) from AEC/APH public records.</>}
      </footer>
    </main>
  );
}
