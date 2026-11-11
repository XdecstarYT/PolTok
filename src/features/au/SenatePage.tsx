/** /au/senate — 76 senators by state and party, plus the crossbench. */
import { useMemo } from 'react';
import { Card, PageHeader } from '../../components';
import { SENATORS } from '../../data/au';
import { AuNav } from './AuNav';
import { orderIdx, party, partyKey, pColor, sortParties, stateName } from './model';
import { Hemicycle, TallyBar } from './widgets';
import './au.css';
import { ink } from '../../lib/format';

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
const GOV = ['ALP'];
const OPP = ['LIB', 'NAT', 'LNP', 'CLP'];
const XB_NAME: Record<string, string> = { JLN: 'Jacqui Lambie Network', UAP: 'United Australia Party', AV: "Australia's Voice" };

export default function SenatePage() {
  const comp = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of SENATORS) m.set(s.party, (m.get(s.party) ?? 0) + 1);
    return sortParties([...m.entries()]);
  }, []);
  const total = SENATORS.length;
  const gov = comp.filter(([k]) => GOV.includes(k)).reduce((a, [, v]) => a + v, 0);
  const opp = comp.filter(([k]) => OPP.includes(k)).reduce((a, [, v]) => a + v, 0);
  const crossbench = SENATORS.filter((s) => !GOV.includes(s.party) && !OPP.includes(s.party)).sort((a, b) => orderIdx(a.party) - orderIdx(b.party) || a.name.localeCompare(b.name));
  const grn = comp.find(([k]) => k === 'GRN')?.[1] ?? 0;
  const onp = comp.find(([k]) => k === 'ONP')?.[1] ?? 0;
  const pname = (p: string) => XB_NAME[p] ?? party(p).name;

  return (
    <div className="page au-page">
      <PageHeader
        className="au-pagehead"
        kicker="Australia · 48th Parliament · Senate"
        title="Senate"
        sub="76 senators: 12 per state, 2 each for the ACT and NT. 39 votes pass a bill."
        aside={
          <dl className="au-stats mono">
          <div><dt>Government</dt><dd style={{ color: ink(pColor('ALP')) }}>{gov}</dd></div>
          <div><dt>Coalition</dt><dd style={{ color: ink(pColor('LIB')) }}>{opp}</dd></div>
          <div><dt>Crossbench</dt><dd>{crossbench.length}</dd></div>
          <div><dt>Labor needs</dt><dd>{Math.max(0, 39 - gov)} more</dd></div>
          </dl>
        }
      >
        <AuNav />
      </PageHeader>

      <div className="au-grid-2">
        <Hemicycle title="Senate composition" total={total} comp={comp} majority={39} govLabel={`${total} senators · 39 to pass`} note="Current party; Tyrrell (IND→ALP, May 2026) and Cox (GRN→ALP, Jun 2025) counted as Labor." />
        <Card title="Paths to 39" kicker="How Labor passes legislation">
          <TallyBar comp={comp} total={total} majority={39} />
          <ul className="au-sen-list" style={{ marginTop: 12 }}>
            <li><i style={{ background: pColor('GRN') }} /><span>Labor + Greens</span><b className="num">{gov + grn}</b></li>
            <li><i style={{ background: pColor('LIB') }} /><span>Labor + Coalition</span><b className="num">{gov + opp}</b></li>
            <li><i style={{ background: pColor('ONP') }} /><span>Coalition + One Nation (blocking bloc)</span><b className="num">{opp + onp}</b></li>
            <li><i style={{ background: pColor('IND') }} /><span>Labor + all non-Greens crossbench</span><b className="num">{gov + crossbench.length - grn}</b></li>
          </ul>
        </Card>
      </div>

      <Card title="Crossbench" kicker={`${crossbench.length} senators outside Labor and the Coalition`}>
        <ul className="au-sen-list">
          {crossbench.map((s) => (
            <li key={s.name}><i style={{ background: pColor(s.party) }} /><span>{s.name} <span className="muted">· {pname(s.party)}</span></span><span className="mono muted">{s.state}</span>{s.note && <small>{s.note}</small>}</li>
          ))}
        </ul>
      </Card>

      <section>
        <h2 className="au-h2">By state and territory</h2>
        <div className="au-sen-grid">
          {STATES.map((st) => {
            const list = SENATORS.filter((s) => s.state === st).sort((a, b) => orderIdx(a.party) - orderIdx(b.party) || a.name.localeCompare(b.name));
            const sum = sortParties([...list.reduce((m, s) => m.set(s.party, (m.get(s.party) ?? 0) + 1), new Map<string, number>())]).map(([k, v]) => `${party(k).short} ${v}`).join(' · ');
            return (
              <Card key={st} className="au-sen-state">
                <h3><span>{stateName(st)}</span><span className="mono muted">{list.length}</span></h3>
                <div className="au-sen-dots" aria-hidden>{list.map((s) => <i key={s.name} style={{ background: pColor(s.party) }} title={s.name} />)}</div>
                <p className="mono muted" style={{ fontSize: 11, margin: '0 0 6px' }}>{sum}</p>
                <ul className="au-sen-list">
                  {list.map((s) => (
                    <li key={s.name}><i style={{ background: pColor(s.party) }} /><span>{s.name}</span><span className="mono muted">{partyKey(s.party) === s.party ? party(s.party).short : s.party}</span>{s.note && <small>{s.note}</small>}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </section>

      <p className="au-foot muted">
        Source: Wikipedia, “Members of the Australian Senate, 2025–2028”, checked 4 Nov 2026 against PolTok's earlier research. Casual vacancies reflected: Bell (ONP, NSW), Gatenby (LIB, TAS), Bleyer (GRN, TAS). Jonathon Duniam's announced resignation has not yet taken effect.
      </p>
    </div>
  );
}
