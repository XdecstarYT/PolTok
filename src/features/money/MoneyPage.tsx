/**
 * /money — 2026 campaign finance (official OpenFEC data via /api/money). Owned by src/features/money/**.
 */
import { useMemo, useState } from 'react';
import { useLive } from '../../lib/live';
import { USMap } from '../map/USMap';
import { fecUrl, usd, useMoney, type MoneyRace } from './data';
import { RaceMoneyPanel } from './RaceMoney';
import './money.css';

type Tab = 'races' | 'leaders' | 'parties';
const SCALE = ['#d9f2e3', '#a6dfbd', '#6cc896', '#34a96b', '#147a47'];

function spend(r: MoneyRace, id: string) {
  const c = r.candidates.find((x) => x.id === id);
  return c ? (c.disbursements || 0) + (c.ieSupport || 0) + 0 : 0;
}

export default function MoneyPage() {
  const { data, error, loading } = useMoney();
  const { results } = useLive();
  const [tab, setTab] = useState<Tab>('races');
  const [chamber, setChamber] = useState<'all' | 'senate' | 'house'>('all');
  const [state, setState] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.races
      .filter((r) => r.matched > 0 && (chamber === 'all' || r.chamber === chamber) && (!state || r.state === state))
      .map((r) => {
        const res = results[r.raceId];
        const votes = res ? Object.values(res.votes || {}).reduce((a, b) => a + b, 0) : 0;
        const ranked = [...r.candidates].sort((a, b) => spend(r, b.id) - spend(r, a.id));
        const top = ranked[0];
        const winner = res?.calledFor;
        const bigWon = winner && top && spend(r, top.id) > 0 ? winner === top.id : null;
        const all = r.total.disbursements + r.total.ie;
        return { r, all, votes, perVote: votes ? all / votes : null, top, winner, bigWon };
      })
      .sort((a, b) => b.all - a.all);
  }, [data, results, chamber, state]);

  const scorecard = useMemo(() => {
    const decided = rows.filter((x) => x.bigWon != null);
    return { n: decided.length, won: decided.filter((x) => x.bigWon).length };
  }, [rows]);

  const fills = useMemo(() => {
    const f: Record<string, string> = {};
    if (!data) return f;
    const vals = Object.values(data.stateTotals).filter((v) => v > 0);
    const max = Math.max(1, ...vals);
    for (const [s, v] of Object.entries(data.stateTotals)) {
      if (v <= 0) continue;
      const i = Math.min(SCALE.length - 1, Math.floor(Math.sqrt(v / max) * SCALE.length));
      f[s] = SCALE[i];
    }
    return f;
  }, [data]);

  const selected = data?.races.find((r) => r.raceId === sel) ?? null;

  return (
    <main className="mo-page">
      <header className="mo-hero">
        <p className="kicker">Campaign finance · 2026 cycle</p>
        <h1 className="mo-h1">Follow the money</h1>
        <p className="mo-muted">
          Candidate fundraising, spending and outside money for every Senate race and the competitive House races, from official Federal Election Commission filings.
        </p>
        {data && (
          <p className="mo-fresh">
            FEC filings through <strong>{data.coverageThrough ?? 'n/a'}</strong> · fetched {new Date(data.generatedAt).toLocaleString()} ·{' '}
            <a href={data.sourceUrl} target="_blank" rel="noreferrer">Source: FEC / OpenFEC</a>
          </p>
        )}
        {data && (data.rateLimited || data.partial) && (
          <p className="mo-warn" role="status">
            {data.rateLimited ? 'The FEC API rate limit was reached' : 'Some FEC data could not be loaded'}
            {data.keyType === 'demo' ? ' (using the shared DEMO_KEY — set FEC_API_KEY on the server for a full refresh)' : ''}.
            {data.missing.length ? ` Missing for now: ${data.missing.map((m) => m.replace(/^party:.*/, 'party committees')).filter((v, i, a) => a.indexOf(v) === i).join(', ')}.` : ''} It retries automatically.
          </p>
        )}
      </header>

      {loading && <p className="mo-muted">Loading FEC data…</p>}
      {error && <p className="mo-warn">Could not load campaign finance data: {error}</p>}

      {data && (
        <>
          <div className="mo-tabs" role="tablist">
            {(['races', 'leaders', 'parties'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={`mo-tab ${tab === t ? 'is-on' : ''}`} onClick={() => setTab(t)}>
                {t === 'races' ? 'Races' : t === 'leaders' ? 'Top fundraisers' : 'Party committees'}
              </button>
            ))}
          </div>

          {tab === 'races' && (
            <div className="mo-grid">
              <section className="mo-card">
                <h2 className="mo-h3">Spending by state</h2>
                <USMap
                  fills={fills}
                  selected={state}
                  onStateClick={(a) => setState((s) => (s === a ? null : a))}
                  renderTooltip={(a) => <span>{a}: {usd(data.stateTotals[a] || 0)} candidate + outside spending</span>}
                  describe={(a) => `${usd(data.stateTotals[a] || 0)} spent`}
                />
                <div className="mo-legend" aria-hidden="true">
                  <span>less</span>
                  {SCALE.map((c) => <i key={c} style={{ background: c }} />)}
                  <span>more</span>
                </div>
                <p className="mo-score">
                  {scorecard.n
                    ? <>Bigger spender won <strong>{scorecard.won} of {scorecard.n}</strong> called races shown.</>
                    : 'No called races yet in this view.'}
                </p>
              </section>

              <section className="mo-card">
                <div className="mo-filters">
                  {(['all', 'senate', 'house'] as const).map((c) => (
                    <button key={c} className={`mo-chip ${chamber === c ? 'is-on' : ''}`} onClick={() => setChamber(c)}>{c === 'all' ? 'All' : c === 'senate' ? 'Senate' : 'House'}</button>
                  ))}
                  {state && <button className="mo-chip is-on" onClick={() => setState(null)}>{state} ✕</button>}
                </div>
                <div className="mo-tablewrap">
                  <table className="pt-table mo-table">
                    <thead>
                      <tr><th>Race</th><th>Total spent*</th><th>Top spender</th><th>Result</th><th>$ / vote</th></tr>
                    </thead>
                    <tbody>
                      {rows.map(({ r, all, top, winner, bigWon, perVote }) => (
                        <tr key={r.raceId} className={sel === r.raceId ? 'is-sel' : ''} onClick={() => setSel(r.raceId)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSel(r.raceId)}>
                          <td>{r.title}</td>
                          <td className="num">{usd(all)}</td>
                          <td><span className={`mo-dot mo-p-${top?.party}`} />{top?.name}</td>
                          <td>{!winner ? <span className="mo-muted">not called</span> : bigWon ? 'Bigger spender won' : 'Outspent winner'}</td>
                          <td className="num">{perVote ? usd(perVote, 2) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mo-muted mo-small">*Candidate disbursements + independent expenditures, all reported for the 2026 cycle. Unmatched candidates count as $0.</p>
              </section>

              {selected && (
                <section className="mo-card mo-detail" aria-live="polite">
                  <div className="mo-detail__head">
                    <h2 className="mo-h3">{selected.title}</h2>
                    <a href={`/race/${selected.raceId}`}>Race page →</a>
                    <button className="mo-chip" onClick={() => setSel(null)} aria-label="Close">✕</button>
                  </div>
                  <RaceMoneyPanel race={selected} />
                </section>
              )}
            </div>
          )}

          {tab === 'leaders' && (
            <section className="mo-card mo-tablewrap">
              <table className="pt-table mo-table">
                <thead><tr><th>#</th><th>Candidate</th><th>Seat</th><th>Raised</th><th>Spent</th><th>Cash</th><th>Outside for / against</th></tr></thead>
                <tbody>
                  {data.leaderboard.map((c, i) => (
                    <tr key={c.fecId}>
                      <td className="num">{i + 1}</td>
                      <td><span className={`mo-dot mo-p-${c.party}`} /><a href={fecUrl(c.fecId)} target="_blank" rel="noreferrer">{c.fecName}</a></td>
                      <td>{c.state}{c.office === 'H' ? `-${String(c.district ?? 0).padStart(2, '0')}` : ' Sen'}</td>
                      <td className="num">{usd(c.receipts)}</td>
                      <td className="num">{usd(c.disbursements)}</td>
                      <td className="num">{usd(c.cash)}</td>
                      <td className="num">{usd(c.ieSupport)} / {usd(c.ieOppose)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === 'parties' && (
            <section className="mo-parties">
              {data.parties.map((p) => (
                <div key={p.id} className={`mo-card mo-party mo-p-${p.party}`}>
                  <h3 className="mo-h3">{p.short}</h3>
                  <p className="mo-muted mo-small">{p.name}</p>
                  {p.available ? (
                    <dl className="num">
                      <dt>Raised</dt><dd>{usd(p.receipts)}</dd>
                      <dt>Spent</dt><dd>{usd(p.disbursements)}</dd>
                      <dt>Cash on hand</dt><dd>{usd(p.cash)}</dd>
                    </dl>
                  ) : (
                    <p className="mo-muted">Not loaded yet (FEC rate limit).</p>
                  )}
                  {p.coverageEnd && <p className="mo-muted mo-small">Through {p.coverageEnd}</p>}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </main>
  );
}
