/**
 * /governors/:abbr — state government dashboard: governor race, other statewide offices from the
 * NYT per-state file (LG, AG, SOS, misc "X" offices…), and a ballot-measure summary. Real AP data.
 */
import { Link, useParams } from 'react-router-dom';
import { LiveDot, fmtTime, tzAbbr, PageHeader, EmptyState } from '../../components';
import { raceById, stateByAbbr } from '../../data';
import { PARTY_HEX } from '../../lib/format';
import { ATTRIBUTION, NOT_UP, parseContest, slug, useNyt, type NytRace } from './data';
import { RaceCard } from './GovernorsPage';
import './governors.css';

const SKIP = new Set(['S', 'H', 'SH', 'SS', 'I', 'G']);
const ORDER = ['LG', 'AG', 'SOS', 'T', 'AU', 'C', 'AGC', 'X'];
const YES = /^(yes|for|approve)/i;

export default function GovStatePage() {
  const { abbr = '' } = useParams();
  const st = stateByAbbr.get(abbr.toUpperCase());
  const { data, error, at } = useNyt<{ races?: NytRace[] }>(st && st.abbr !== 'DC' ? `results-${slug(st.name)}.json` : null, 90000);
  if (!st) return <div className="page gv-page"><PageHeader kicker="Governors" title="Unknown state" crumbLabel="Not found" /><EmptyState title="We don't recognise that state" description={<Link to="/governors">See all governor races</Link>} /></div>;

  const all = data?.races || [];
  const gov = all.find((r) => r.office_id === 'G' && r.coverage === 'state');
  const others = all.filter((r) => r.coverage === 'state' && !SKIP.has(r.office_id))
    .sort((a, b) => (ORDER.indexOf(a.office_id) + 99) % 99 - (ORDER.indexOf(b.office_id) + 99) % 99);
  const measures = all.filter((r) => r.office_id === 'I' && r.coverage === 'state');
  const leg = all.filter((r) => r.office_id === 'SH' || r.office_id === 'SS');
  const nu = NOT_UP[st.abbr];
  const prior = raceById.get(`${st.abbr}-GOV`)?.incumbentParty;

  return (
    <div className="page gv-page">
      <PageHeader
        live
        kicker="AP live · State government"
        title={st.name}
        crumbLabel={st.name}
        meta={<span className="gv-upd">{ATTRIBUTION}{at ? ` · updated ${fmtTime(at)} ${tzAbbr(at)}` : ''}{error ? ` · fetch failed (${error})` : ''} · <Link to={`/state/${st.abbr}`}>Full state page</Link></span>}
      />

      <section>
        <h2 className="gv-h2">Governor</h2>
        {nu ? (
          <p className="gv-panel">No governor race in 2026. Gov. <b>{nu.name}</b> (<span style={{ color: PARTY_HEX[nu.party] }}>{nu.party}</span>) remains in office.</p>
        ) : gov ? (
          <>
            <RaceCard c={parseContest(gov)} prior={prior === 'D' || prior === 'R' ? prior : undefined} big />
            {gov.long_description && <p className="gv-desc">{gov.long_description}</p>}
          </>
        ) : <p className="gv-muted">{error ? 'Could not load results.' : 'Loading…'}</p>}
      </section>

      <section>
        <h2 className="gv-h2">Other statewide races</h2>
        <div className="gv-cards">
          {others.map((r) => {
            const c = parseContest(r);
            const name = r.seat ? `${r.office} · ${r.seat}` : r.office;
            return <article key={r.nyt_id} className="gv-card"><div className="gv-ctop"><b className="gv-off">{name}</b><span className={`gv-badge ${c.called ? 'called' : ''}`}>{c.called ? 'Called' : 'Uncalled'}</span></div>
              <ul className="gv-lines">{c.lines.slice(0, 3).map((l) => (
                <li key={l.id} className={l.won ? 'won' : ''}><span className="gv-nm">{l.name}{l.incumbent ? ' (inc.)' : ''} <small>{l.party}</small>{l.won && ' ✓'}</span><span className="gv-pct">{c.total ? `${l.pct.toFixed(1)}%` : '–'}</span>
                  <span className="gv-bar" aria-hidden="true"><span style={{ width: `${l.pct}%`, background: PARTY_HEX[l.party] }} /></span></li>
              ))}</ul><div className="gv-foot"><span>{c.eevp}% expected vote</span></div></article>;
          })}
          {data && !others.length && <p className="gv-muted">No other statewide offices on the ballot in the AP feed.</p>}
        </div>
      </section>

      <section>
        <h2 className="gv-h2">Ballot measures ({measures.length})</h2>
        <ul className="gv-measures">
          {measures.map((r) => {
            const c = parseContest(r);
            const yes = c.lines.find((l) => YES.test(l.id));
            const won = c.lines.find((l) => l.won);
            return <li key={r.nyt_id}><span className="gv-mt">{r.title?.default || r.seat || r.nyt_id}</span>
              <span className={`gv-badge ${won ? (YES.test(won.id) ? 'yes' : 'no') : ''}`}>{won ? (YES.test(won.id) ? 'Passed' : 'Failed') : 'Uncalled'}</span>
              <span className="gv-muted">{c.total ? `Yes ${yes ? yes.pct.toFixed(1) : '–'}%` : 'No votes yet'}</span></li>;
          })}
          {data && !measures.length && <li className="gv-muted">No statewide ballot measures.</li>}
        </ul>
        {measures.length > 0 && <Link to="/measures">All ballot measures →</Link>}
      </section>

      {leg.length > 0 && (
        <section>
          <h2 className="gv-h2">Legislature races in the AP feed</h2>
          <p className="gv-muted gv-small">
            {(['SS', 'SH'] as const).map((o) => {
              const rs = leg.filter((r) => r.office_id === o);
              if (!rs.length) return null;
              const cs = rs.map(parseContest);
              const w = (p: string) => cs.filter((c) => c.lines.find((l) => l.won)?.party === p).length;
              return <span key={o} style={{ display: 'block' }}>{o === 'SS' ? 'State Senate' : 'State House'}: {rs.length} races · called D {w('D')}, R {w('R')}, other {cs.filter((c) => c.called).length - w('D') - w('R')}, uncalled {cs.filter((c) => !c.called).length}</span>;
            })}
            Chamber control isn't shown: seats not up this year aren't in the feed.
          </p>
        </section>
      )}
    </div>
  );
}
