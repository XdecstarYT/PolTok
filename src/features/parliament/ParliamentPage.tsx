/**
 * /parliament — live bill tracker: US Congress (119th) and the Parliament of Australia.
 * Data: /api/parliament/* (server/parliament.js · netlify/functions/parliament.mjs). Never fabricated.
 */
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fmtTime, tzAbbr } from '../../components';
import { api, useAsync, type Bill, type Country } from './api';
import { BillRow, MissingKeys, Notes, VoteCard } from './parts';
import './parliament.css';

const BILL_NO = /^\s*(h\.?\s*r\.?|s\.?|h\.?\s*j\.?\s*res\.?|s\.?\s*j\.?\s*res\.?)\s*\d+\s*$/i;

export default function ParliamentPage() {
  const [sp, setSp] = useSearchParams();
  const country: Country = sp.get('c') === 'au' ? 'au' : 'us';
  const setCountry = (c: Country) => setSp(c === 'us' ? {} : { c }, { replace: true });
  const [q, setQ] = useState('');
  const [lookup, setLookup] = useState('');
  const [stage, setStage] = useState<number | 'all'>('all');
  const [chamber, setChamber] = useState('all');
  const [party, setParty] = useState('all');

  const bills = useAsync(() => api.bills(country, lookup), [country, lookup]);
  const votes = useAsync(() => api.votes(country), [country]);
  const floor = useAsync(() => (country === 'us' ? api.floor() : Promise.resolve(undefined)), [country]);

  const list = bills.data?.bills ?? [];
  const chambers = useMemo(() => [...new Set(list.map((b) => b.chamber))], [list]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter(
      (b: Bill) =>
        (stage === 'all' || b.stage === stage) &&
        (chamber === 'all' || b.chamber === chamber) &&
        (party === 'all' || b.sponsor?.party === party) &&
        (!needle || BILL_NO.test(q) || `${b.label} ${b.title} ${b.shortTitle ?? ''} ${b.sponsor?.name ?? ''} ${b.policyArea ?? ''} ${b.subjects.join(' ')}`.toLowerCase().includes(needle)),
    );
  }, [list, q, stage, chamber, party]);
  const stages = list[0]?.stages ?? [];
  const counts = stages.map((_, i) => list.filter((b) => b.stage === i).length);

  return (
    <div className="page pa-page">
      <header>
        <div className="pa-kicker">PARLIAMENT · LIVE BILL TRACKER</div>
        <h1>{country === 'us' ? '119th U.S. Congress' : 'Parliament of Australia'}</h1>
        <p className="pa-sub">
          {country === 'us'
            ? 'Bills with the most recent official activity, straight from the Library of Congress Bill Status data, plus House roll calls with party breakdowns.'
            : 'Federal bills from the Parliament of Australia and Acts that have received Royal Assent, from official parliamentary and legislation registers.'}
        </p>
        <div className="pa-tabs" role="tablist" aria-label="Legislature">
          {(['us', 'au'] as const).map((c) => (
            <button key={c} role="tab" aria-selected={country === c} className={country === c ? 'on' : ''} onClick={() => { setCountry(c); setStage('all'); setChamber('all'); setParty('all'); setLookup(''); setQ(''); }}>
              {c === 'us' ? '🇺🇸 US Congress' : '🇦🇺 Australia'}
            </button>
          ))}
        </div>
      </header>

      {country === 'us' && (
        <section className="pa-panel" aria-labelledby="pa-floor">
          <h2 id="pa-floor">What’s on the floor today</h2>
          {floor.loading && !floor.data ? (
            <p className="pa-muted">Loading floor activity…</p>
          ) : floor.data ? (
            <div className="pa-floor">
              {(['house', 'senate'] as const).map((ch) => (
                <div key={ch}>
                  <h3>{ch === 'house' ? 'House' : 'Senate'}</h3>
                  {!floor.data!.ok[ch] ? (
                    <p className="pa-muted pa-small">Feed unavailable.</p>
                  ) : floor.data![ch].length === 0 ? (
                    <p className="pa-muted pa-small">No measures listed on today’s {ch === 'house' ? 'House' : 'Senate'} floor feed — the chamber may not be in session.</p>
                  ) : (
                    <ul>
                      {floor.data![ch].slice(0, 12).map((i) => (
                        <li key={i.link + i.title}><a href={i.link} target="_blank" rel="noreferrer">{i.title}</a></li>
                      ))}
                    </ul>
                  )}
                  <a className="pa-small" href={floor.data!.links[ch]} target="_blank" rel="noreferrer">Official floor proceedings ↗</a>
                </div>
              ))}
            </div>
          ) : (
            <p className="pa-muted">Floor feed unavailable.</p>
          )}
        </section>
      )}

      <div className="pa-grid">
        <section aria-labelledby="pa-bills" className="pa-main">
          <h2 id="pa-bills">{country === 'us' ? 'Recently active bills' : 'Bills & Acts'}</h2>
          {stages.length > 0 && (
            <div className="pa-funnel" aria-label="Bills by stage">
              {stages.map((s, i) => (
                <button key={s} className={stage === i ? 'on' : ''} onClick={() => setStage(stage === i ? 'all' : i)} aria-pressed={stage === i}>
                  <b>{counts[i]}</b>
                  <span>{s}</span>
                </button>
              ))}
            </div>
          )}
          <form
            className="pa-filters"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setLookup(country === 'us' && BILL_NO.test(q) ? q.trim() : '');
            }}
          >
            <input type="search" value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value) setLookup(''); }} placeholder={country === 'us' ? 'Filter, or look up e.g. “H.R. 1” + Enter' : 'Filter by title'} aria-label="Search bills" />
            {chambers.length > 1 && (
              <select value={chamber} onChange={(e) => setChamber(e.target.value)} aria-label="Chamber">
                <option value="all">All chambers</option>
                {chambers.map((c) => <option key={c}>{c}</option>)}
              </select>
            )}
            {country === 'us' && (
              <select value={party} onChange={(e) => setParty(e.target.value)} aria-label="Sponsor party">
                <option value="all">Any sponsor party</option>
                <option value="D">Democrat</option>
                <option value="R">Republican</option>
                <option value="I">Independent</option>
              </select>
            )}
          </form>
          {bills.data && (
            <p className="pa-src">
              Source: {bills.data.source} · fetched {fmtTime(bills.data.fetchedAt)} {tzAbbr(bills.data.fetchedAt)}
            </p>
          )}
          <Notes notes={bills.data?.notes} />
          {bills.loading && !bills.data ? (
            <ul className="pa-bills">{Array.from({ length: 6 }, (_, i) => <li key={i} className="pa-bill pa-skel" />)}</ul>
          ) : bills.error ? (
            <div className="pa-connect"><b>Couldn’t load bills</b><p>{bills.error}. The live parliament API may be unreachable; try again shortly.</p></div>
          ) : shown.length === 0 ? (
            <p className="pa-muted">No bills match these filters.</p>
          ) : (
            <ul className="pa-bills">{shown.map((b) => <BillRow key={b.id} bill={b} />)}</ul>
          )}
        </section>

        <aside aria-labelledby="pa-votes" className="pa-side">
          <h2 id="pa-votes">Recent votes</h2>
          {votes.data && <MissingKeys missing={votes.data.missing} />}
          <Notes notes={votes.data?.notes} />
          {votes.loading && !votes.data ? (
            <p className="pa-muted">Loading roll calls…</p>
          ) : votes.error ? (
            <p className="pa-muted">Votes unavailable ({votes.error}).</p>
          ) : votes.data && votes.data.votes.length === 0 && !votes.data.missing.length ? (
            <p className="pa-muted">No recorded votes returned.</p>
          ) : (
            <ul className="pa-votes">{votes.data?.votes.map((v) => <VoteCard key={v.id} v={v} />)}</ul>
          )}
        </aside>
      </div>
    </div>
  );
}
