/** /au/states — all eight state & territory parliaments at a glance; /au/state/:code — one parliament. */
import { Link, useParams } from 'react-router-dom';
import { Card, EmptyState, PageHeader } from '../../components';
import { useSeo } from '../../lib/seo';
import { AU_STATES, auStateByCode, type AuChamber, type AuState } from '../../data/au-states';
import { AuNav } from './AuNav';
import { daysUntil, SeatStack } from './charts';
import { party, pColor, sortParties } from './model';
import { Hemicycle, LeaderCard } from './widgets';
import './au.css';

const rows = (c: AuChamber) => sortParties(Object.entries(c.comp) as [string, number][]);
const govOf = (s: AuState) => party(s.head.party).short;

function nextLabel(s: AuState) {
  const n = s.nextElection;
  if (!n.exact) return n.date.length === 4 ? `due by ${n.date}` : `on or before ${n.date}`;
  const d = daysUntil(n.date);
  return d > 0 ? `${n.date} · in ${d} days` : n.date;
}

export function StatesHub() {
  useSeo({ title: 'Australian states & territories', description: 'Every Australian state and territory parliament: seats by party, premiers, opposition leaders and next election dates.' });
  const upcoming = [...AU_STATES].sort((a, b) => a.nextElection.date.localeCompare(b.nextElection.date));
  return (
    <div className="page au-page">
      <PageHeader
        className="au-pagehead"
        kicker="Australia · States & territories"
        title="States & territories"
        sub="Six state and two territory parliaments. Lower-house seats by party, with the majority line marked."
      >
        <AuNav />
      </PageHeader>
      <Card title="Next elections" kicker="Fixed-term dates where set by law">
        <ol className="au-next">
          {upcoming.map((s) => (
            <li key={s.code}><Link to={`/au/state/${s.code}`}><b>{s.name}</b><span className="mono muted">{nextLabel(s)}</span></Link></li>
          ))}
        </ol>
      </Card>
      <div className="au-states-grid">
        {AU_STATES.map((s) => {
          const c = pColor(s.head.party);
          return (
            <Link key={s.code} to={`/au/state/${s.code}`} className="au-state-card" style={{ ['--pc' as string]: c }}>
              <div className="au-state-top">
                <span className="mono au-state-code">{s.code.toUpperCase()}</span>
                <span className="mono" style={{ color: c }}>{govOf(s)} GOVT</span>
              </div>
              <b className="au-state-name">{s.name}</b>
              <span className="muted au-state-lead">{s.head.title} {s.head.name} · Opp. {s.opposition.name}</span>
              <SeatStack comp={rows(s.lower)} total={s.lower.seats} majority={s.lower.majority} />
              <span className="mono muted au-state-foot">{s.lower.name} {s.lower.seats} · majority {s.lower.majority}{s.upper ? ` · ${s.upper.name} ${s.upper.seats}` : ' · unicameral'}</span>
              <span className="mono au-state-foot">Next: {nextLabel(s)}</span>
            </Link>
          );
        })}
      </div>
      <p className="au-foot muted">Compositions are snapshots from each parliament's Wikipedia article (sources and as-of dates on each state page) and may lag by-elections or defections.</p>
    </div>
  );
}

export function StatePage() {
  const { code = '' } = useParams();
  const s = auStateByCode.get(code.toLowerCase());
  useSeo({ title: s ? `${s.name} parliament` : 'State not found', description: s ? `${s.parliament}: seats by party, ${s.head.title.toLowerCase()} ${s.head.name}, next election ${s.nextElection.date}.` : '' });
  if (!s) return <div className="page au-page"><AuNav /><EmptyState title="State not found" description={<>Try <Link to="/au/states">all states</Link>.</>} /></div>;
  const d = daysUntil(s.nextElection.date);
  return (
    <div className="page au-page">
      <div className="au-head-wrap" style={{ ['--pc' as string]: pColor(s.head.party) }}>
        <PageHeader
          className="au-pagehead"
          kicker="Australia · State parliament"
          title={s.name}
          crumbs={[{ to: '/', label: 'Home' }, { to: '/au', label: 'Australia' }, { to: '/au/states', label: 'States' }, { label: s.name }]}
          sub={s.parliament}
          aside={
            <dl className="au-stats mono">
            <div><dt>Government</dt><dd style={{ color: pColor(s.head.party) }}>{govOf(s)}</dd></div>
            <div><dt>Lower house</dt><dd>{s.lower.seats}</dd></div>
            <div><dt>Majority</dt><dd>{s.lower.majority}</dd></div>
            <div><dt>Next election</dt><dd>{s.nextElection.exact && d > 0 ? `${d} days` : s.nextElection.date}</dd></div>
            </dl>
          }
        >
          <AuNav />
        </PageHeader>
      </div>
      <div className="au-leaders" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <LeaderCard role={s.head.title} name={s.head.name} partyCode={s.head.party} seat={s.head.seat} extra={s.head.since ? <span className="muted">since {s.head.since}</span> : undefined} />
        <LeaderCard role="Leader of the Opposition" name={s.opposition.name} partyCode={s.opposition.party} seat={s.opposition.seat} extra={s.opposition.since ? <span className="muted">since {s.opposition.since}</span> : undefined} />
      </div>
      <div className={s.upper ? 'au-grid-2' : ''}>
        <Hemicycle title={s.lower.name} total={s.lower.seats} comp={rows(s.lower)} majority={s.lower.majority} govLabel={`as of ${s.lower.asOf}`} note={s.lower.note} />
        {s.upper && <Hemicycle title={s.upper.name} total={s.upper.seats} comp={rows(s.upper)} majority={s.upper.majority} govLabel={`as of ${s.upper.asOf}`} note={s.upper.note} />}
      </div>
      <div className="au-grid-2">
        <Card title="Last election" kicker={s.lastElection.date}>
          <p>{s.lastElection.result}</p>
          {s.lastElection.tpp && <p className="mono">Two-party-preferred: {s.lastElection.tpp}%</p>}
        </Card>
        <Card title="Next election" kicker={s.nextElection.exact ? 'Fixed date' : 'Due date'}>
          <p className="au-big num">{s.nextElection.date}</p>
          {s.nextElection.exact && d > 0 && <p className="mono">{d} days away</p>}
          {s.nextElection.note && <p className="au-note">{s.nextElection.note}</p>}
          {s.code === 'vic' && <p><Link to="/au/victoria">Victoria 2026 hub →</Link> · <Link to="/au/victoria/districts">All 88 districts →</Link></p>}
          {s.code === 'nsw' && <p><Link to="/au/nsw">NSW 2027 hub →</Link></p>}
        </Card>
      </div>
      {s.facts.length > 0 && <Card title="Key facts"><ul className="au-facts">{s.facts.map((f) => <li key={f}>{f}</li>)}</ul></Card>}
      <p className="au-foot muted">Sources: {s.sources.map((x, i) => <span key={x.url}>{i ? ' · ' : ''}<a href={x.url} target="_blank" rel="noreferrer">{x.label}</a></span>)}. Snapshot compiled 5 Nov 2026.</p>
    </div>
  );
}

export default StatesHub;
