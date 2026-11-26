/** PolTok live model: blends the pre-election seat model with the count as it comes in. Transparent and simple:
 *  • called seat → certain;
 *  • 2CP figures → P(leader holds) = Φ(lead / σ), σ shrinking as more of the roll is counted (σ = 1 + 9·(1 − counted)^0.8 pts);
 *  • first preferences only → half-way between the model and the first-preference leader;
 *  • no results → the pre-election model.
 *  Then 3,000 simulations of all 88 seats → chance of each majority and expected seats. */
import type { AuResults } from '../api';
import { partyKey } from '../model';
import type { VicModel } from '../vicLive';

const grp = (x?: string | null) => { if (!x) return 'OTH'; const k = partyKey(x); return ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; };
const phi = (z: number) => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z * z * z)));

export interface LiveOdds { majority: { LNP: number; ALP: number; hung: number }; expected: Record<string, number>; seatProb: Record<string, Record<string, number>>; reporting: number }

export function liveOdds(model: VicModel, res: AuResults | null, sims = 3000): LiveOdds {
  const seatProb: Record<string, Record<string, number>> = {};
  let reporting = 0;
  for (const [id, ms] of Object.entries(model.seats)) {
    const r = res?.seats?.[id];
    let p: Record<string, number> = { ...ms.prob };
    if (r?.called) { p = { [grp(r.called)]: 1 }; reporting++; }
    else if (r?.tcp && r.tcp.length >= 2) {
      reporting++;
      const [a, b] = [...r.tcp].sort((x, y) => y.pct - x.pct);
      const counted = r.counted <= 100 ? r.counted / 100 : 0.3;
      const sigma = 1 + 9 * Math.pow(Math.max(0, 1 - counted), 0.8);
      const pa = phi((a.pct - b.pct) / sigma);
      p = grp(a.party) === grp(b.party) ? { [grp(a.party)]: 1 } : { [grp(a.party)]: pa, [grp(b.party)]: 1 - pa };
    } else if (r?.fp?.length || r?.leader) {
      reporting++;
      const lead = grp(r.leader ?? r.fp?.[0]?.party);
      for (const k of Object.keys(p)) p[k] *= 0.5;
      p[lead] = (p[lead] ?? 0) + 0.5;
    }
    seatProb[id] = p;
  }
  // simulate
  let a = 1;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const ids = Object.keys(seatProb);
  let lnp = 0, alp = 0;
  const sum: Record<string, number> = {};
  for (let s = 0; s < sims; s++) {
    const t: Record<string, number> = {};
    for (const id of ids) {
      let u = rnd(), w = 'OTH';
      for (const [k, v] of Object.entries(seatProb[id])) { u -= v; if (u <= 0) { w = k; break; } w = k; }
      t[w] = (t[w] ?? 0) + 1;
    }
    if ((t.LNP ?? 0) >= 45) lnp++; else if ((t.ALP ?? 0) >= 45) alp++;
    for (const [k, v] of Object.entries(t)) sum[k] = (sum[k] ?? 0) + v;
  }
  const expected = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +(v / sims).toFixed(1)]));
  return { majority: { LNP: lnp / sims, ALP: alp / sims, hung: 1 - (lnp + alp) / sims }, expected, seatProb, reporting };
}
