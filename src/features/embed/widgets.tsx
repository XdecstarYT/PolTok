/**
 * Chrome-less live widgets for iframes: /embed/race/:id, /embed/balance, /embed/map.
 * Query params: theme=dark|light, chamber=senate|house|governor (balance/map), compact=1.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { raceById, RACES } from '../../data';
import { useLive } from '../../lib/live';
import { PARTY_HEX, PARTY_NAME, initials, mixHex } from '../../lib/format';
import { fmtTime, tzAbbr } from '../../components/time';
import { raceCandidates, US_ATTRIBUTION } from '../../lib/share';
import { USMap } from '../map/USMap';
import type { Party, RaceResult } from '../../types';
import './embed.css';

const pHex = (p: string) => PARTY_HEX[p as Party] ?? PARTY_HEX.O;

function useEmbedOpts() {
  const [sp] = useSearchParams();
  const theme = sp.get('theme') === 'light' ? 'light' : 'dark';
  const chamber = sp.get('chamber') ?? undefined;
  return { theme, chamber, compact: sp.get('compact') === '1' };
}

export function EmbedFrame({ title, link, children }: { title: string; link: string; children: ReactNode }) {
  const { theme } = useEmbedOpts();
  const live = useLive();
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · PolTok`;
    document.documentElement.classList.add('emb-doc');
    return () => { document.title = prev; document.documentElement.classList.remove('emb-doc'); };
  }, [title]);
  const ts = live.lastUpdate || Date.now();
  const origin = typeof location !== 'undefined' ? location.origin : '';
  return (
    <div className="emb" data-theme={theme}>
      <header className="emb__head">
        <a className="emb__brand" href={origin + link} target="_blank" rel="noopener noreferrer" aria-label="Open on PolTok">
          <span className="emb__dot" aria-hidden="true" />Pol<b>Tok</b>
        </a>
        <span className={`emb__live ${live.connected ? 'is-on' : ''}`}>{live.connected ? 'LIVE' : 'Connecting…'}</span>
      </header>
      <main className="emb__body">{children}</main>
      <footer className="emb__foot">
        <span>{US_ATTRIBUTION}</span>
        <span>Updated {fmtTime(ts)} {tzAbbr(ts)}</span>
      </footer>
    </div>
  );
}

function Avatar({ name, party, photo }: { name: string; party: string; photo?: string }) {
  return (
    <span className="emb-av" style={{ background: pHex(party) }} aria-hidden="true">
      {photo ? <img src={photo} alt="" loading="lazy" onError={(e) => ((e.currentTarget.style.display = 'none'))} /> : null}
      <span>{initials(name)}</span>
    </span>
  );
}

export function EmbedRace() {
  const { id = '' } = useParams();
  const live = useLive();
  const race = raceById.get(id.toUpperCase()) ?? raceById.get(id);
  if (!race) {
    return (
      <EmbedFrame title="Race" link="/races">
        <p className="emb-empty">Unknown race “{id}”.</p>
      </EmbedFrame>
    );
  }
  const r = live.results[race.id];
  const cands = raceCandidates(race, r);
  const total = r ? Object.values(r.votes).reduce((a, b) => a + b, 0) : 0;
  const rows = cands.map((c) => ({ c, v: r?.votes[c.id] ?? 0 })).sort((a, b) => b.v - a.v).slice(0, 4);
  return (
    <EmbedFrame title={race.title} link={`/race/${race.id}`}>
      <div className="emb-race">
        <div className="emb-race__top">
          <h1 className="emb-title">{race.title}</h1>
          <Status r={r} />
        </div>
        <ul className="emb-rows">
          {rows.map(({ c, v }) => {
            const pct = total > 0 ? (v / total) * 100 : null;
            const won = r?.calledFor === c.id;
            return (
              <li key={c.id} className={`emb-row ${won ? 'is-won' : ''}`} style={{ ['--pc' as string]: pHex(c.party) }}>
                <Avatar name={c.name} party={c.party} photo={c.photo} />
                <div className="emb-row__main">
                  <div className="emb-row__name">
                    {c.name}{won && <span className="emb-check" aria-label="projected winner"> ✓</span>}
                  </div>
                  <div className="emb-row__meta">{PARTY_NAME[c.party as Party] ?? c.party}{c.incumbent ? ' · Inc.' : ''} · {v.toLocaleString('en-US')} votes</div>
                  <div className="emb-bar"><span style={{ width: `${pct ?? 0}%` }} /></div>
                </div>
                <div className="emb-row__pct">{pct != null ? `${pct.toFixed(1)}%` : '—'}</div>
              </li>
            );
          })}
        </ul>
        <p className="emb-note">{r && r.expectedPct > 0 ? `~${Math.round(r.expectedPct)}% of expected vote counted` : 'No votes reported yet'}</p>
      </div>
    </EmbedFrame>
  );
}

function Status({ r }: { r?: RaceResult }) {
  if (r?.calledFor) return <span className="emb-pill" style={{ ['--pc' as string]: '#c6ff3d' }}>Called</span>;
  if (r?.status === 'too-close') return <span className="emb-pill" style={{ ['--pc' as string]: '#f5c518' }}>Too close</span>;
  if (r && r.expectedPct > 0) return <span className="emb-pill" style={{ ['--pc' as string]: '#ff3d55' }}>Counting</span>;
  return <span className="emb-pill" style={{ ['--pc' as string]: '#8b93a7' }}>Awaiting</span>;
}

export function EmbedBalance() {
  const { chamber } = useEmbedOpts();
  const live = useLive();
  const ch = chamber === 'house' ? 'house' : 'senate';
  const b = live.balance[ch];
  return (
    <EmbedFrame title={`${ch === 'senate' ? 'Senate' : 'House'} balance of power`} link={`/live`}>
      <h1 className="emb-title">{ch === 'senate' ? 'U.S. Senate' : 'U.S. House'} · Balance of power</h1>
      {!b ? (
        <p className="emb-empty">Waiting for results…</p>
      ) : (
        <div className="emb-bal">
          <div className="emb-bal__nums">
            <div style={{ color: PARTY_HEX.D }}><b>{b.dem + b.ind}</b><span>Dem{b.ind ? ` (incl. ${b.ind} ind.)` : ''}</span></div>
            <div className="emb-bal__mid"><b>{b.undecided}</b><span>undecided</span></div>
            <div style={{ color: PARTY_HEX.R, textAlign: 'right' }}><b>{b.rep}</b><span>Rep</span></div>
          </div>
          <div className="emb-bal__bar" role="img" aria-label={`Democrats ${b.dem + b.ind}, Republicans ${b.rep}, ${b.undecided} undecided; ${b.majority} needed for majority`}>
            <span style={{ width: `${(b.dem / b.total) * 100}%`, background: PARTY_HEX.D }} />
            <span style={{ width: `${(b.ind / b.total) * 100}%`, background: PARTY_HEX.I }} />
            <span style={{ flex: 1 }} />
            <span style={{ width: `${(b.rep / b.total) * 100}%`, background: PARTY_HEX.R }} />
            <i style={{ left: `${(b.majority / b.total) * 100}%` }} />
          </div>
          <p className="emb-note">{b.majority} seats for majority{b.projected ? ` · Model projection D ${b.projected.dem} – R ${b.projected.rep}` : ''}</p>
        </div>
      )}
    </EmbedFrame>
  );
}

export function EmbedMap() {
  const { chamber, theme } = useEmbedOpts();
  const live = useLive();
  const ch = chamber === 'governor' ? 'governor' : 'senate';
  const empty = theme === 'light' ? '#dfe3ec' : '#1c2031';
  const fills = useMemo(() => {
    const out: Record<string, string> = {};
    const base = theme === 'light' ? '#ffffff' : '#0b0e18';
    for (const race of RACES) {
      if (race.chamber !== ch) continue;
      const r = live.results[race.id];
      if (!r) continue;
      const cands = raceCandidates(race, r);
      let best: { party: string; v: number } | null = null;
      for (const c of cands) { const v = r.votes[c.id] ?? 0; if (!best || v > best.v) best = { party: c.party, v }; }
      const called = cands.find((c) => c.id === r.calledFor);
      if (called) out[race.state] = pHex(called.party);
      else if (best && best.v > 0 && !out[race.state]) out[race.state] = mixHex(base, pHex(best.party), 0.45);
      else if (!out[race.state]) out[race.state] = theme === 'light' ? '#b9c0cf' : '#2a2f3d';
    }
    return out;
  }, [live.results, ch, theme]);
  return (
    <EmbedFrame title={`${ch === 'senate' ? 'Senate' : 'Governor'} map`} link={`/map/live`}>
      <h1 className="emb-title">{ch === 'senate' ? 'Senate' : 'Governor'} results map</h1>
      <div className="emb-map">
        <USMap fills={fills} emptyFill={empty} labels title={`${ch} results by state`} />
      </div>
      <p className="emb-legend">
        <span><i style={{ background: PARTY_HEX.D }} />Dem called</span>
        <span><i style={{ background: PARTY_HEX.R }} />Rep called</span>
        <span><i style={{ background: mixHex('#0b0e18', '#8b93a7', 0.45) }} />Lighter = leading</span>
        <span><i style={{ background: empty }} />No race</span>
      </p>
    </EmbedFrame>
  );
}

export function EmbedNotFound() {
  return (
    <EmbedFrame title="Embed" link="/embed">
      <p className="emb-empty">Unknown widget. <Link to="/embed">See available embeds</Link>.</p>
    </EmbedFrame>
  );
}
