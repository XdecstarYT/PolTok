/** Live Desk widgets: the Needle, the Swingometer, the seats-through-the-night timeline, and Path to 45. */
import { useEffect, useState, type CSSProperties } from 'react';
import { m } from 'framer-motion';
import { VIC_NAME, vicColor } from '../vicLive';
import type { LiveOdds } from './liveModel';

const pct = (x: number) => (x >= 0.995 ? '>99%' : x <= 0.005 ? '<1%' : `${Math.round(x * 100)}%`);
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} ${a0 > a1 ? 1 : 0} ${x1} ${y1}`;
};

/** The Needle: Labor majority ← hung → Coalition majority. */
export function Needle({ odds, live }: { odds: LiveOdds; live: boolean }) {
  const { LNP, ALP, hung } = odds.majority;
  // map to [-1, 1]: −1 = certain Labor majority, +1 = certain Coalition majority, 0 = certain hung
  const score = LNP - ALP;
  const angle = Math.PI / 2 - score * (Math.PI / 2) * 0.92;
  const [wob, setWob] = useState(0);
  useEffect(() => { if (!live) return; const t = setInterval(() => setWob((Math.random() - 0.5) * 0.015 * (1 - odds.reporting / 88)), 900); return () => clearInterval(t); }, [live, odds.reporting]);
  const W = 320, cx = 160, cy = 170, R = 140;
  const deg = 90 - ((angle + wob) * 180) / Math.PI;
  return (
    <figure className="nd" aria-label={`Chance of a Coalition majority ${pct(LNP)}, hung parliament ${pct(hung)}, Labor majority ${pct(ALP)}`}>
      <svg viewBox={`0 0 ${W} 190`} role="img">
        <defs>
          <linearGradient id="nd-g" x1="0" x2="1"><stop offset="0" stopColor={vicColor('ALP')} /><stop offset="0.38" stopColor={vicColor('ALP')} stopOpacity="0.35" /><stop offset="0.5" stopColor="#8a8f99" stopOpacity="0.5" /><stop offset="0.62" stopColor={vicColor('LNP')} stopOpacity="0.35" /><stop offset="1" stopColor={vicColor('LNP')} /></linearGradient>
        </defs>
        <path d={arc(cx, cy, R, Math.PI, 0)} stroke="url(#nd-g)" strokeWidth="26" fill="none" strokeLinecap="round" />
        {Array.from({ length: 21 }, (_, i) => { const a = Math.PI - (i / 20) * Math.PI; return <line key={i} x1={cx + (R - 22) * Math.cos(a)} y1={cy - (R - 22) * Math.sin(a)} x2={cx + (R - (i % 5 ? 28 : 34)) * Math.cos(a)} y2={cy - (R - (i % 5 ? 28 : 34)) * Math.sin(a)} className="nd__tick" />; })}
        <m.g style={{ originX: `${cx}px`, originY: `${cy}px` }} animate={{ rotate: deg }} transition={{ type: 'spring', stiffness: 40, damping: 9 }}>
          <path d={`M ${cx - 6} ${cy} L ${cx} ${cy - R + 18} L ${cx + 6} ${cy} Z`} className="nd__needle" />
        </m.g>
        <circle cx={cx} cy={cy} r="12" className="nd__hub" />
        <text x={cx} y="34" textAnchor="middle" className="nd__lab">Hung</text>
      </svg>
      <figcaption className="nd__cap">
        <span style={{ color: vicColor('ALP') }}><b className="num">{pct(ALP)}</b>Labor maj.</span>
        <span><b className="num">{pct(hung)}</b>Hung</span>
        <span style={{ color: vicColor('LNP') }}><b className="num">{pct(LNP)}</b>Coalition maj.</span>
      </figcaption>
    </figure>
  );
}

/** BBC-style swingometer: measured 2CP swing to the Coalition v the polls. */
export function Swingometer({ measured, polls }: { measured: number | null; polls: number | null }) {
  const lim = 16, cx = 160, cy = 160, R = 130;
  const ang = (v: number) => Math.PI / 2 - (Math.max(-lim, Math.min(lim, v)) / lim) * (Math.PI / 2) * 0.95;
  const toDeg = (a: number) => 90 - (a * 180) / Math.PI;
  return (
    <figure className="sw" aria-label={`Two-party swing to the Coalition: measured ${measured ?? 'not yet'}, polls ${polls ?? '—'}`}>
      <svg viewBox="0 0 320 180" role="img">
        <path d={arc(cx, cy, R, Math.PI, Math.PI / 2)} stroke={vicColor('ALP')} strokeOpacity="0.55" strokeWidth="18" fill="none" />
        <path d={arc(cx, cy, R, Math.PI / 2, 0)} stroke={vicColor('LNP')} strokeOpacity="0.55" strokeWidth="18" fill="none" />
        {[-15, -10, -5, 0, 5, 10, 15].map((v) => { const a = ang(v); return <g key={v}><line x1={cx + (R - 12) * Math.cos(a)} y1={cy - (R - 12) * Math.sin(a)} x2={cx + (R + 12) * Math.cos(a)} y2={cy - (R + 12) * Math.sin(a)} className="nd__tick" /><text x={cx + (R - 30) * Math.cos(a)} y={cy - (R - 30) * Math.sin(a) + 4} textAnchor="middle" className="sw__num">{v > 0 ? `+${v}` : v}</text></g>; })}
        {polls != null && <g style={{ transform: `rotate(${toDeg(ang(polls))}deg)`, transformOrigin: `${cx}px ${cy}px` }}><line x1={cx} y1={cy} x2={cx} y2={cy - R + 4} className="sw__ghost" /></g>}
        {measured != null && (
          <m.g style={{ originX: `${cx}px`, originY: `${cy}px` }} animate={{ rotate: toDeg(ang(measured)) }} transition={{ type: 'spring', stiffness: 50, damping: 10 }}>
            <line x1={cx} y1={cy} x2={cx} y2={cy - R - 4} className="sw__arm" />
          </m.g>
        )}
        <circle cx={cx} cy={cy} r="10" className="nd__hub" />
      </svg>
      <figcaption className="sw__cap">
        <span><b className="num">{measured != null ? `${measured > 0 ? '+' : ''}${measured}` : '—'}</b> measured swing to the Coalition</span>
        {polls != null && <span className="faint">dashed: polls said {polls > 0 ? '+' : ''}{polls}</span>}
      </figcaption>
    </figure>
  );
}

/** Seats (won + leading) through the night, from snapshots this browser has seen. */
export function Timeline({ hist }: { hist: { t: number; s: Record<string, number> }[] }) {
  if (hist.length < 2) return <p className="ld-note">The line chart builds as the count moves (this browser records every update while the page is open).</p>;
  const W = 600, H = 180, t0 = hist[0].t, t1 = hist[hist.length - 1].t || t0 + 1;
  const ks = ['LNP', 'ALP', 'ONP', 'GRN', 'IND'].filter((k) => hist.some((h) => h.s[k]));
  const x = (t: number) => ((t - t0) / Math.max(1, t1 - t0)) * (W - 40) + 4, y = (v: number) => H - 14 - (v / 70) * (H - 28);
  return (
    <svg className="tl" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Seats won or leading through the night">
      <line x1="0" x2={W} y1={y(45)} y2={y(45)} className="tl__maj" /><text x={W - 4} y={y(45) - 5} textAnchor="end" className="nd__lab">45</text>
      {ks.map((k) => <polyline key={k} points={hist.map((h) => `${x(h.t).toFixed(1)},${y(h.s[k] ?? 0).toFixed(1)}`).join(' ')} fill="none" stroke={vicColor(k)} strokeWidth="3" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${vicColor(k)})` }} />)}
    </svg>
  );
}

/** Path to 45 for the two majors. */
export function PathTo45({ tally, uncalledLeads }: { tally: Record<string, { won: number; lead: number }>; uncalledLeads: Record<string, number> }) {
  return (
    <div className="p45">
      {['LNP', 'ALP'].map((k) => {
        const won = tally[k]?.won ?? 0, lead = tally[k]?.lead ?? 0, need = Math.max(0, 45 - won);
        return (
          <div key={k} className="p45__row" style={{ ['--c' as string]: vicColor(k) } as CSSProperties}>
            <b>{VIC_NAME[k]}</b>
            <div className="p45__bar"><i style={{ width: `${(won / 45) * 100}%` }} /><i className="lead" style={{ width: `${(Math.min(lead, need) / 45) * 100}%` }} /></div>
            <span className="num">{need === 0 ? 'Majority reached' : `needs ${need} more · leads in ${uncalledLeads[k] ?? 0}`}</span>
          </div>
        );
      })}
    </div>
  );
}
