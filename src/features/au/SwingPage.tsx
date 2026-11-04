/** /au/swingometer — Victoria 2026 uniform-swing tool: drag 2PP swing, watch the AUMap and majority tracker. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components';
import { VIC_2022_TPP_ALP } from '../../data/au';
import { AuNav } from './AuNav';
import { MapPanel, VIC_ZOOMS } from './MapPanel';
import { AU_POLLS, isCoalition, normPolls, party, partyKey, pColor, VIC_MAJORITY, VIC_TOTAL, VICTORIA, type AuSeat } from './model';
import { TallyBar } from './widgets';
import './au.css';

type Out = { seat: AuSeat; from: string; to: string; modelled: boolean };

/** Uniform swing. tpp = swing to Coalition (2PP pts); grn = swing to Greens in ALP-v-GRN seats. */
export function project(seats: AuSeat[], tpp: number, grn: number): Out[] {
  return seats.map((s) => {
    const from = partyKey(s.party);
    const m = s.margin;
    if (m == null) return { seat: s, from, to: from, modelled: false };
    if (s.vs === 'LIB/NAT' && !isCoalition(s.party)) return { seat: s, from, to: tpp > m ? 'LIB' : from, modelled: true };
    if (isCoalition(s.party) && s.vs === 'ALP') return { seat: s, from, to: -tpp > m ? 'ALP' : from, modelled: true };
    if (from === 'ALP' && s.vs === 'GRN') return { seat: s, from, to: grn > m ? 'GRN' : from, modelled: true };
    if (from === 'GRN' && s.vs === 'ALP') return { seat: s, from, to: -grn > m ? 'ALP' : from, modelled: true };
    return { seat: s, from, to: from, modelled: false };
  });
}

export default function SwingPage() {
  const seats = VICTORIA.seats ?? [];
  const polls = useMemo(() => normPolls(AU_POLLS.victoria).filter((p) => p.tpp.ALP != null).slice(0, 5), []);
  const pollAvg = polls.length ? polls.reduce((a, p) => a + (p.tpp.ALP ?? 0), 0) / polls.length : null;
  const pollSwing = pollAvg != null ? +(VIC_2022_TPP_ALP - pollAvg).toFixed(1) : null;
  const [tpp, setTpp] = useState(0);
  const [grn, setGrn] = useState(0);
  const out = useMemo(() => project(seats, tpp, grn), [seats, tpp, grn]);
  const tally = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of out) {
      const k = isCoalition(o.to) ? 'LIB/NAT' : o.to;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [out]);
  const changes = out.filter((o) => o.to !== o.from);
  const fills = useMemo(() => Object.fromEntries(out.map((o) => [o.seat.id, pColor(o.to)])), [out]);
  const comp: [string, number][] = [['ALP', tally.get('ALP') ?? 0], ['GRN', tally.get('GRN') ?? 0], ['IND', tally.get('IND') ?? 0], ['LIB', tally.get('LIB/NAT') ?? 0]];
  const alp = tally.get('ALP') ?? 0;
  const coal = tally.get('LIB/NAT') ?? 0;
  const verdict = alp >= VIC_MAJORITY ? 'Labor majority' : coal >= VIC_MAJORITY ? 'Coalition majority' : 'Hung parliament';
  const alpTpp = VIC_2022_TPP_ALP - tpp;

  return (
    <div className="page au-page">
      <AuNav />
      <header className="au-head">
        <div>
          <div className="au-kicker mono">VICTORIA 2026 · WHAT-IF TOOL · NOT A FORECAST</div>
          <h1>Swingometer</h1>
          <p className="au-sub"><Link to="/au/victoria">Victoria</Link> / Apply a uniform two-party swing to the 2022-based pendulum and see which districts change hands.</p>
        </div>
        <dl className="au-stats mono">
          <div><dt>ALP 2PP</dt><dd>{alpTpp.toFixed(1)}%</dd></div>
          <div><dt>Labor</dt><dd style={{ color: pColor('ALP') }}>{alp}</dd></div>
          <div><dt>Coalition</dt><dd style={{ color: pColor('LIB') }}>{coal}</dd></div>
          <div><dt>Result</dt><dd>{verdict}</dd></div>
        </dl>
      </header>

      <Card title="Set the swing" kicker={`Baseline: 2022 statewide 2PP ALP ${VIC_2022_TPP_ALP.toFixed(1)}%`}>
        <div className="au-swing-ctl">
          <label htmlFor="sw-tpp" className="au-swing-read">
            <span>Labor v Coalition 2PP swing</span>
            <b style={{ color: tpp > 0 ? pColor('LIB') : tpp < 0 ? pColor('ALP') : undefined }}>{tpp === 0 ? 'No swing' : `${Math.abs(tpp).toFixed(1)} to ${tpp > 0 ? 'Coalition' : 'Labor'}`}</b>
          </label>
          <input id="sw-tpp" type="range" min={-8} max={15} step={0.1} value={tpp} onChange={(e) => setTpp(+e.target.value)} aria-valuetext={`${tpp.toFixed(1)} points to ${tpp >= 0 ? 'Coalition' : 'Labor'}`} />
          <label htmlFor="sw-grn" className="au-swing-read">
            <span>Labor v Greens swing (inner-city seats)</span>
            <b style={{ color: grn ? pColor(grn > 0 ? 'GRN' : 'ALP') : undefined }}>{grn === 0 ? 'No swing' : `${Math.abs(grn).toFixed(1)} to ${grn > 0 ? 'Greens' : 'Labor'}`}</b>
          </label>
          <input id="sw-grn" type="range" min={-10} max={10} step={0.1} value={grn} onChange={(e) => setGrn(+e.target.value)} />
          <div className="au-swing-btns">
            <button type="button" onClick={() => { setTpp(0); setGrn(0); }}>Reset</button>
            {pollSwing != null && <button type="button" onClick={() => setTpp(pollSwing)}>Poll average ({pollAvg!.toFixed(1)} ALP → {pollSwing.toFixed(1)} to {pollSwing >= 0 ? 'Coalition' : 'Labor'})</button>}
            {[2, 5, 8].map((v) => <button type="button" key={v} onClick={() => setTpp(v)}>{v} to Coalition</button>)}
          </div>
          {pollAvg != null && <p className="au-note">Poll average = mean ALP 2PP of the last {polls.length} published Victorian polls ({polls.map((p) => p.pollster).join(', ')}).</p>}
        </div>
      </Card>

      <Card title="Majority tracker" kicker={`${VIC_MAJORITY} of ${VIC_TOTAL} for majority`}>
        <TallyBar comp={comp} total={VIC_TOTAL} majority={VIC_MAJORITY} />
        <div className="au-need">
          {([['ALP', 'Labor', alp], ['LIB', 'Coalition', coal]] as const).map(([k, l, v]) => (
            <div key={k} style={{ ['--pc' as string]: pColor(k) }}>
              <span className="mono">{l}</span><b className="num">{v}</b>
              <span className="muted">{v >= VIC_MAJORITY ? `majority, ${v - VIC_MAJORITY} spare` : `${VIC_MAJORITY - v} short`}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="au-grid-main">
        <MapPanel layer="vic" seats={seats} fills={fills} regions={VIC_ZOOMS} title="Projected districts" kicker="Uniform swing projection" focus={changes.length ? changes.map((c) => c.seat.id) : undefined}
          tooltip={(s) => { const o = out.find((x) => x.seat.id === s.id)!; return (
            <div className="au-tip"><b>{s.name}</b><div><i style={{ background: pColor(o.to) }} /> {party(o.to).short}{o.to !== o.from ? ` gain from ${party(o.from).short}` : ' hold'}</div><div className="muted">{s.margin != null ? `Margin ${s.margin.toFixed(1)}${s.vs ? ' v ' + s.vs : ''}` : 'Margin TBD'}{!o.modelled ? ' · not swung' : ''}</div></div>
          ); }} />
        <div className="au-side">
          <Card title="Seats changing hands" kicker={`${changes.length} change${changes.length === 1 ? '' : 's'}`}>
            {changes.length ? (
              <ul className="au-keyseats">
                {changes.sort((a, b) => (a.seat.margin ?? 0) - (b.seat.margin ?? 0)).map((c) => (
                  <li key={c.seat.id}><Link to={`/au/seat/${c.seat.id}`}><i style={{ background: pColor(c.to) }} /><span className="au-ks-n">{c.seat.name}</span><span className="muted au-ks-m">{party(c.from).short} → {party(c.to).short}</span><span className="num au-ks-v">{c.seat.margin?.toFixed(1)}</span></Link></li>
                ))}
              </ul>
            ) : <p className="muted">Drag a slider to see seats change.</p>}
          </Card>
        </div>
      </div>

      <p className="au-foot muted">
        Method: uniform swing on 2022 margins (post-redistribution pendulum). ALP/IND seats measured against LIB/NAT fall when the Coalition swing exceeds the margin; Coalition seats measured against Labor fall the other way. Seats contested against independents (e.g. Benambra, Mildura, Mornington), Prahran (margin TBD), and anything involving One Nation are not swung — real outcomes will diverge, especially with One Nation polling above 20%. This is a teaching tool, not a prediction.
      </p>
    </div>
  );
}
