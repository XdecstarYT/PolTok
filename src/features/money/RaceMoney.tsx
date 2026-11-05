/** <RaceMoney raceId="PA-SEN" /> — FEC money panel for one race; safe to mount on any race page. */
import { useLive } from '../../lib/live';
import { fecUrl, usd, useMoney, type MoneyRace } from './data';
import './money.css';

export function RaceMoneyPanel({ race }: { race: MoneyRace }) {
  const { results } = useLive();
  const res = results[race.raceId];
  const max = Math.max(1, ...race.candidates.map((c) => (c.disbursements || 0) + (c.ieSupport || 0)));
  const winner = res?.calledFor;
  return (
    <div className="mo-panel">
      <ul className="mo-bars">
        {race.candidates.map((c) => {
          const votes = res?.votes?.[c.id];
          const pv = votes && c.disbursements ? c.disbursements / votes : null;
          return (
            <li key={c.id} className={`mo-bar mo-p-${c.party}`}>
              <div className="mo-bar__head">
                <strong>{c.name}{winner === c.id ? ' ✓' : ''}</strong>
                <span className="mo-muted">({c.party})</span>
                {c.fecId ? (
                  <a className="mo-muted" href={fecUrl(c.fecId)} target="_blank" rel="noreferrer">FEC ↗</a>
                ) : (
                  <span className="mo-muted">no FEC match</span>
                )}
              </div>
              <div className="mo-track" aria-hidden="true">
                <span className="mo-fill" style={{ width: `${((c.disbursements || 0) / max) * 100}%` }} />
                <span className="mo-fill mo-fill--ie" style={{ width: `${((c.ieSupport || 0) / max) * 100}%` }} />
              </div>
              <div className="mo-stats num">
                <span>Raised {usd(c.receipts)}</span>
                <span>Spent {usd(c.disbursements)}</span>
                <span>Cash {usd(c.cash)}</span>
                <span>Indiv {usd(c.indiv)}</span>
                <span>PAC {usd(c.pac)}</span>
                <span>Outside: for {usd(c.ieSupport)} / against {usd(c.ieOppose)}</span>
                {pv != null && <span>{usd(pv, 2)} per vote</span>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mo-muted mo-small">Bar = candidate spending; lighter segment = outside money supporting them (independent expenditures).</p>
    </div>
  );
}

export function RaceMoney({ raceId }: { raceId: string }) {
  const { data, error } = useMoney();
  if (error) return <p className="mo-muted">Campaign finance unavailable ({error}).</p>;
  if (!data) return <p className="mo-muted">Loading FEC data…</p>;
  const race = data.races.find((r) => r.raceId === raceId);
  if (!race) return null;
  return (
    <section className="mo-card" aria-label="Campaign finance">
      <h3 className="mo-h3">Money in this race</h3>
      <RaceMoneyPanel race={race} />
      <p className="mo-muted mo-small">
        Source: FEC{data.coverageThrough ? ` · filings through ${data.coverageThrough}` : ''} · <a href="/money">All races →</a>
      </p>
    </section>
  );
}
export default RaceMoney;
