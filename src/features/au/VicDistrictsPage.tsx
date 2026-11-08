/** /au/victoria/districts — all 88 Victorian districts: 2022 results, census snapshot, nominations,
 *  marginal-seat arithmetic and Legislative Council regions. Data-only; no predictions. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, PersonAvatar } from '../../components';
import { useSeo } from '../../lib/seo';
import { CENSUS_VIC } from '../../data/au-census';
import { VIC_LC_2022, VIC_LC_2022_SOURCE } from '../../data/au-states';
import { VIC_NOMINATIONS, VIC_REGION_OF, VIC_RESULTS_2022 } from '../../data/au-vic';
import { AuNav } from './AuNav';
import { SeatStack } from './charts';
import { isCoalition, party, partyKey, pColor, sortParties, VICTORIA, type AuSeat } from './model';
import './au.css';

type SortKey = 'name' | 'margin' | 'region' | 'alp' | 'coal' | 'grn' | 'cands' | 'inc';
const fpShare = (id: string, pred: (p: string) => boolean) => {
  const r = VIC_RESULTS_2022[id];
  return r ? Math.round(r.fp.filter((c) => pred(c.p)).reduce((a, c) => a + c.pct, 0) * 10) / 10 : null;
};

/** Uniform-swing arithmetic on the published pendulum (2022-based margins). */
function swingTable(seats: AuSeat[]) {
  const alpVsCoal = seats.filter((s) => partyKey(s.party) === 'ALP' && s.vs === 'LIB/NAT' && s.margin != null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0));
  const alpHeld = seats.filter((s) => partyKey(s.party) === 'ALP').length;
  const coalHeld = seats.filter((s) => isCoalition(s.party)).length;
  const toLoseMaj = alpHeld - (VICTORIA.majority - 1); // seats ALP must lose to drop below 45
  const coalNeed = VICTORIA.majority - coalHeld;
  return {
    alpVsCoal, alpHeld, coalHeld, toLoseMaj, coalNeed,
    swingLoseMaj: toLoseMaj > 0 ? alpVsCoal[toLoseMaj - 1]?.margin ?? null : 0,
    swingCoalMaj: coalNeed > 0 ? alpVsCoal[coalNeed - 1]?.margin ?? null : 0,
  };
}

export default function VicDistrictsPage() {
  useSeo({ title: 'Victorian election 2026: all 88 districts', description: 'Every Victorian Legislative Assembly district: 2022 VEC results, margins, demographics, nominated candidates and the Legislative Council regions.' });
  const [sort, setSort] = useState<SortKey>('margin');
  const [region, setRegion] = useState('');
  const seats = VICTORIA.seats ?? [];
  const regions = useMemo(() => [...new Set(Object.values(VIC_REGION_OF))].sort(), []);
  const rows = useMemo(() => {
    const r = seats.filter((s) => !region || VIC_REGION_OF[s.id] === region).map((s) => ({
      s, region: VIC_REGION_OF[s.id] ?? '', alp: fpShare(s.id, (p) => p === 'ALP'), coal: fpShare(s.id, isCoalition), grn: fpShare(s.id, (p) => p === 'GRN'),
      cands: (VIC_NOMINATIONS.districts[s.id] ?? []).length, inc: CENSUS_VIC[s.id]?.inc ?? null,
    }));
    const v = (x: (typeof r)[number]) => (sort === 'name' ? x.s.name : sort === 'region' ? x.region : sort === 'margin' ? x.s.margin ?? 99 : x[sort] ?? -1);
    return r.sort((a, b) => { const A = v(a), B = v(b); return typeof A === 'string' ? A.localeCompare(B as string) : sort === 'margin' ? (A as number) - (B as number) : (B as number) - (A as number); });
  }, [seats, sort, region]);
  const sw = useMemo(() => swingTable(seats), [seats]);
  const bands = useMemo(() => {
    const B = [[0, 2], [2, 4], [4, 6], [6, 10], [10, 100]] as const;
    return B.map(([lo, hi]) => ({ lo, hi, by: sortParties(Object.entries(seats.filter((s) => s.margin != null && s.margin >= lo && s.margin < hi).reduce<Record<string, number>>((a, s) => { const k = isCoalition(s.party) ? 'LIB' : partyKey(s.party); a[k] = (a[k] ?? 0) + 1; return a; }, {})) as [string, number][]) }));
  }, [seats]);
  const nomTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const l of Object.values(VIC_NOMINATIONS.districts)) for (const [, p] of l) t[p] = (t[p] ?? 0) + 1;
    return Object.entries(t).sort((a, b) => b[1] - a[1]);
  }, []);
  const th = (k: SortKey, label: string) => <th><button type="button" className={`au-th${sort === k ? ' is-on' : ''}`} onClick={() => setSort(k)}>{label}</button></th>;

  return (
    <div className="page au-page">
      <AuNav />
      <header className="au-head">
        <div>
          <div className="au-kicker mono"><Link to="/au">AUSTRALIA</Link> / <Link to="/au/victoria">VICTORIA 2026</Link> / DISTRICTS</div>
          <h1>All 88 districts</h1>
          <p className="au-sub">Pre-election reference: no 2026 votes have been counted. Results below are from the 2022 election.</p>
        </div>
        <dl className="au-stats mono">
          <div><dt>Districts</dt><dd>88</dd></div>
          <div><dt>Majority</dt><dd>{VICTORIA.majority}</dd></div>
          <div><dt>Nominated</dt><dd>{Object.values(VIC_NOMINATIONS.districts).reduce((a, l) => a + l.length, 0)}</dd></div>
          <div><dt>Early voting centres</dt><dd>~200</dd></div>
        </dl>
      </header>

      <div className="au-grid-2">
        <Card title="Uniform-swing arithmetic" kicker="from the 2022-based pendulum">
          <ul className="au-facts">
            <li>Labor holds <b>{sw.alpHeld}</b> seats in the pendulum; losing <b>{sw.toLoseMaj}</b> would leave it below the {VICTORIA.majority}-seat majority. On a uniform swing to the Coalition, that happens at <b>{sw.swingLoseMaj?.toFixed(1)}%</b> (the {sw.toLoseMaj}th-most-marginal Labor-v-Coalition seat).</li>
            <li>The Coalition holds <b>{sw.coalHeld}</b> and needs <b>{sw.coalNeed}</b> more for a majority in its own right — a uniform swing of <b>{sw.swingCoalMaj?.toFixed(1)}%</b> if it held all its own seats and won only from Labor.</li>
            <li>Uniform swing ignores Greens, independents and One Nation contests, retirements and sophomore effects; it is arithmetic, not a forecast.</li>
          </ul>
        </Card>
        <Card title="Seats by margin" kicker="pre-election margin bands (pp above 50)">
          <ul className="au-bands">
            {bands.map((b) => {
              const n = b.by.reduce((a, [, v]) => a + v, 0);
              return (
                <li key={b.lo}>
                  <span className="mono">{b.hi === 100 ? `${b.lo}%+` : `${b.lo}–${b.hi}%`}</span>
                  <SeatStack comp={b.by} total={Math.max(n, 1)} />
                  <span className="num">{n}</span>
                </li>
              );
            })}
          </ul>
          <p className="au-note">Coalition = LIB + NAT. Prahran has no published margin.</p>
        </Card>
      </div>

      <Card title="Most marginal Labor v Coalition seats" kicker="in order of the swing needed">
        <ol className="au-marg">
          {sw.alpVsCoal.slice(0, Math.max(sw.coalNeed, 16)).map((s, i) => (
            <li key={s.id} className={i + 1 === sw.toLoseMaj ? 'is-line' : ''}>
              <Link to={`/au/seat/${s.id}`}><span className="mono">{i + 1}</span><b>{s.name}</b><span className="muted">{s.member}</span><span className="num">{s.margin?.toFixed(1)}</span></Link>
            </li>
          ))}
        </ol>
        <p className="au-note">Highlighted row: the seat whose loss would take Labor below a majority.</p>
      </Card>

      <Card title="Districts" kicker="2022 first preferences · census 2021 · nominations" action={
        <select className="au-select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Filter by region">
          <option value="">All regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      }>
        <div className="au-table-wrap">
          <table className="au-table au-dt">
            <thead><tr>{th('name', 'District')}{th('region', 'Region')}<th>Held</th>{th('margin', 'Margin')}{th('alp', 'ALP 22')}{th('coal', 'L/NP 22')}{th('grn', 'GRN 22')}{th('inc', 'Med. hh inc')}{th('cands', 'Nominated')}</tr></thead>
            <tbody>
              {rows.map(({ s, region: rg, alp, coal, grn, cands, inc }) => (
                <tr key={s.id}>
                  <td><Link to={`/au/seat/${s.id}`}><i className="au-dot" style={{ background: pColor(s.party) }} />{s.name}</Link></td>
                  <td className="muted">{rg}</td>
                  <td style={{ color: pColor(s.party) }}>{party(s.party).short}</td>
                  <td className="num">{s.margin != null ? `${s.margin.toFixed(1)}${s.vs ? ` v ${s.vs === 'LIB/NAT' ? 'L/NP' : s.vs}` : ''}` : '—'}</td>
                  <td className="num">{alp ?? '—'}</td>
                  <td className="num">{coal ?? '—'}</td>
                  <td className="num">{grn ?? '—'}</td>
                  <td className="num">{inc ? `$${inc.toLocaleString()}` : '—'}</td>
                  <td className="num">{cands}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="au-note">2022 first-preference % from the VEC (Narracan: Jan 2023 supplementary election). Median weekly household income: ABS Census 2021 on 2021 district boundaries (blank where the district did not exist in 2021). Nominated = VEC list as at {VIC_NOMINATIONS.asAt} — nominations close 12 noon Mon 9 Nov.</p>
      </Card>

      <Card title="Nominations so far" kicker={`VEC · as at ${VIC_NOMINATIONS.asAt}`}>
        <ul className="au-legend au-legend--inline">
          {nomTotals.map(([p, n]) => <li key={p}><i style={{ background: pColor(p) }} /><span>{party(p).name}</span><b className="num">{n}</b></li>)}
        </ul>
        <p className="au-note">District candidates only. Labor, Liberal and most other parties had not yet lodged bulk nominations at this snapshot; the list will grow until nominations close. <a href={VIC_NOMINATIONS.file} target="_blank" rel="noreferrer">VEC spreadsheet</a></p>
      </Card>

      <h2 className="au-h2">Legislative Council regions</h2>
      <div className="au-states-grid">
        {Object.entries(VIC_LC_2022).map(([rg, mem]) => {
          const dists = seats.filter((s) => VIC_REGION_OF[s.id] === rg);
          const nc = (VIC_NOMINATIONS.regions[rg] ?? []).length;
          return (
            <Card key={rg} title={rg} kicker={`5 members · ${dists.length} districts`}>
              <ul className="au-cands">{mem.map(([n, p]) => <li key={n}><PersonAvatar name={n} color={pColor(p)} lookup={{ name: n, scope: 'au' }} size={26} /><span>{n}</span><span className="mono muted">{party(p).short}</span></li>)}</ul>
              <p className="au-note">Elected 2022 (party at election). {nc} region candidates nominated so far.</p>
              <p className="au-note">{dists.map((d, i) => <span key={d.id}>{i ? ', ' : ''}<Link to={`/au/seat/${d.id}`}>{d.name}</Link></span>)}</p>
            </Card>
          );
        })}
      </div>
      <p className="au-foot muted">Sources: Victorian Electoral Commission 2022 results by district and 2026 nominations report; ABS Census 2021 (CC BY 4.0) and ASGS 2025 SED regions; <a href={VIC_LC_2022_SOURCE.url} target="_blank" rel="noreferrer">{VIC_LC_2022_SOURCE.label}</a>. Margins: PolTok pendulum (src/data/au.ts). VEC plans about 200 early voting centres (155 in 2022), ~1,700 election-day centres and ~400 mobile services (<a href="https://vec.vic.gov.au/about-us/media/100-days-until-the-2026-victorian-state-election---what-you-need-to-know" target="_blank" rel="noreferrer">VEC</a>).</p>
    </div>
  );
}
