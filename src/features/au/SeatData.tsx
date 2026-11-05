/** Seat-page panels: past results (AEC 2025 / VEC 2022) and ABS Census 2021 profile. */
import { Card } from '../../components';
import { CENSUS_AUS, CENSUS_FED, CENSUS_SOURCE, CENSUS_VIC, type AuCensus } from '../../data/au-census';
import { FED2025, FED2025_SOURCE } from '../../data/au-fed2025';
import { VIC_REGION_OF, VIC_RESULTS_2022 } from '../../data/au-vic';
import { SplitBar, VoteBars } from './charts';
import { party } from './model';

const cap = (s: string) => s.replace(/\b([A-Z])([A-Z']+)\b/g, (_, a: string, b: string) => a + b.toLowerCase());
const sw = (v: number | null | undefined) => (v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(1)}`);

export function SeatResults({ id, isVic }: { id: string; isVic: boolean }) {
  if (isVic) {
    const r = VIC_RESULTS_2022[id];
    if (!r) return null;
    const fin = r.final;
    return (
      <Card title="2022 result" kicker={r.note ? 'VEC · supplementary election' : `VEC · ${VIC_REGION_OF[id] ?? ''} Region`}>
        {fin.length === 2 && <SplitBar a={{ label: fin[0].n, p: fin[0].p, pct: fin[0].pct }} b={{ label: fin[1].n, p: fin[1].p, pct: fin[1].pct }} />}
        {fin.length > 2 && (
          <>
            <p className="mono muted">Final count (distribution stopped once a candidate passed 50%)</p>
            <VoteBars rows={fin.map((c) => ({ label: c.n, p: c.p, pct: c.pct }))} max={100} />
          </>
        )}
        <h3 className="au-h3">First preferences</h3>
        <VoteBars rows={r.fp.map((c) => ({ label: c.n, p: c.p, pct: c.pct, sub: c.p === 'OTH' ? c.pn : undefined }))} />
        <p className="au-note">
          {r.note ? `${r.note} ` : ''}Formal votes {r.formal?.toLocaleString() ?? '—'}; informal {r.informal?.toLocaleString() ?? '—'}; enrolment {r.enrol?.toLocaleString() ?? '—'}{r.enrol && r.turnout ? ` (turnout ${((100 * r.turnout) / r.enrol).toFixed(1)}%)` : ''}. Later by-elections are not shown. <a href={r.url} target="_blank" rel="noreferrer">VEC</a>
        </p>
      </Card>
    );
  }
  const r = FED2025[id];
  if (!r) return null;
  const [a, b] = r.tcp;
  return (
    <Card title="2025 result" kicker="AEC final results · 3 May 2025">
      {a && b && <SplitBar a={{ label: cap(a.n), p: a.p, pct: a.pct }} b={{ label: cap(b.n), p: b.p, pct: b.pct }} />}
      <p className="mono muted">Two-candidate-preferred{a?.sw != null ? ` · swing ${sw(a.sw)} to ${party(a.p).short}` : ''}</p>
      {r.tpp && <p className="mono">Labor v Coalition 2PP: ALP {r.tpp.alp.toFixed(1)}% · L/NP {r.tpp.lnp.toFixed(1)}% (swing {sw(r.tpp.sw)} to ALP)</p>}
      <h3 className="au-h3">First preferences</h3>
      <VoteBars rows={r.fp.map((c) => ({ label: cap(c.n), p: c.p, pct: c.pct, el: c.el, sub: c.sw != null ? `${sw(c.sw)}` : c.p === 'OTH' ? c.ab : undefined }))} />
      <p className="au-note">Formal votes {r.formal.toLocaleString()}. Swing vs 2022 (notional where boundaries changed). <a href={FED2025_SOURCE} target="_blank" rel="noreferrer">AEC downloads</a> · © AEC, CC BY 4.0.</p>
    </Card>
  );
}

function Stat({ label, v, base, fmt }: { label: string; v: number | null; base?: number; fmt: (n: number) => string }) {
  return (
    <div className="au-cstat">
      <span className="mono">{label}</span>
      <b className="num">{v == null ? '—' : fmt(v)}</b>
      {base != null && v != null && <span className="mono muted">AUS {fmt(base)}</span>}
    </div>
  );
}

export function SeatCensus({ id, isVic, name }: { id: string; isVic: boolean; name: string }) {
  const c: AuCensus | undefined = (isVic ? CENSUS_VIC : CENSUS_FED)[id];
  const pct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <Card title="Who lives here" kicker="ABS Census 2021">
      {!c ? (
        <p className="muted">No Census 2021 profile for {name}: the ABS publishes these tables on 2021 boundaries and this {isVic ? 'district' : 'division'} did not exist under that name in 2021.</p>
      ) : (
        <>
          <div className="au-cgrid">
            <Stat label="Population" v={c.pop} base={CENSUS_AUS.pop / 151} fmt={(n) => Math.round(n).toLocaleString()} />
            <Stat label="Median age" v={c.age} base={CENSUS_AUS.age} fmt={(n) => `${n}`} />
            <Stat label="Median hh income /wk" v={c.inc} base={CENSUS_AUS.inc} fmt={(n) => `$${Math.round(n).toLocaleString()}`} />
            <Stat label="Born overseas" v={c.os} base={CENSUS_AUS.os} fmt={pct} />
            <Stat label="Other language at home" v={c.lang} fmt={pct} />
            <Stat label="First Nations" v={c.indig} fmt={pct} />
            <Stat label="Renting" v={c.renting} fmt={pct} />
            <Stat label="Median rent /wk" v={c.rentW} fmt={(n) => `$${n}`} />
          </div>
          <div className="au-grid-2" style={{ marginTop: 12 }}>
            <div>
              <h3 className="au-h3">Housing tenure</h3>
              <VoteBars unit="%" rows={[{ label: 'Owned outright', p: 'OTH', pct: c.owned ?? 0 }, { label: 'Mortgage', p: 'OTH', pct: c.mortgaged ?? 0 }, { label: 'Renting', p: 'OTH', pct: c.renting ?? 0 }]} max={100} />
            </div>
            <div>
              <h3 className="au-h3">Top industries</h3>
              <VoteBars rows={c.ind.map(([l, v]) => ({ label: l, p: 'OTH', pct: v ?? 0 }))} max={30} />
            </div>
          </div>
          <p className="mono muted">Top ancestries: {c.anc.map(([l, v]) => `${l} ${v}%`).join(' · ')}</p>
        </>
      )}
      <p className="au-note">{CENSUS_SOURCE.label}. Boundaries: {CENSUS_SOURCE.boundaries}{isVic ? ' (pre-2021-redistribution districts)' : ' (2022-election divisions)'} — current boundaries may differ. "AUS" population reference = national population ÷ 151. Ancestry is multi-response.</p>
    </Card>
  );
}
