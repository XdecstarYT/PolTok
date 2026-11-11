/** "Latest results" for recent national elections worldwide — parsed live from each election's
 * Wikipedia infobox (/api/world/results). Always labelled unofficial; nothing is estimated. */
import { useEffect, useState } from 'react';
import type { WorldElection } from './data';

interface Row { party: string | null; candidate: string | null; votes: number | null; pct: number | null; seats: number | null }
interface Res { title: string; url: string; fetchedAt: number; results: null | { kind: 'legislative' | 'executive'; rows: Row[]; turnout: number | null } }

const clean = (s: string | null) =>
  (s || '')
    .replace(/\s*\((?:United States|politician|party)\)/gi, '')
    .replace(/ politicians in [A-Z][\w ]+$/, 's')
    .trim();

function useResults(title?: string) {
  const [r, setR] = useState<Res | null | 'err'>(null);
  useEffect(() => {
    if (!title) return;
    let on = true;
    fetch(`/api/world/results?title=${encodeURIComponent(title)}`)
      .then((x) => (x.ok ? x.json() : Promise.reject(x.status)))
      .then((j) => { if (on) setR(j); })
      .catch(() => { if (on) setR('err'); });
    return () => { on = false; };
  }, [title]);
  return r;
}

function ResultCard({ e }: { e: WorldElection }) {
  const r = useResults(e.article);
  if (r === 'err' || (r && !r.results)) return null; // no published results yet: don't show an empty card
  const rows = r && r.results ? r.results.rows.slice(0, 5) : [];
  const leg = r && r.results?.kind === 'legislative';
  const max = Math.max(1, ...rows.map((x) => (leg ? x.seats ?? 0 : x.pct ?? 0)));
  return (
    <article className="wd-res">
      <header className="wd-res__h">
        <span className="wd-res__c">{e.country}</span>
        <span className="wd-res__o">{e.office} · {e.dateLabel}</span>
      </header>
      {!r ? (
        <div className="wd-muted">Loading results…</div>
      ) : (
        <>
          <ul className="wd-res__rows">
            {rows.map((x, i) => {
              const v = leg ? x.seats ?? 0 : x.pct ?? 0;
              return (
                <li key={i}>
                  <span className="wd-res__n">{clean(leg ? x.party || x.candidate : x.candidate || x.party)}</span>
                  <span className="wd-res__bar" aria-hidden="true"><span style={{ width: `${(v / max) * 100}%` }} /></span>
                  <span className="wd-res__v mono">
                    {leg ? `${x.seats ?? '–'} seats` : x.pct != null ? `${x.pct}%` : '–'}
                    {leg && x.pct != null ? <small> · {x.pct}%</small> : null}
                  </span>
                </li>
              );
            })}
          </ul>
          <footer className="wd-res__f">
            Unofficial · <a href={r.url} target="_blank" rel="noreferrer">Wikipedia</a> (community-edited) · checked {new Date(r.fetchedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            {r.results?.turnout != null ? <> · turnout {r.results.turnout}%</> : null}
          </footer>
        </>
      )}
    </article>
  );
}

export default function LatestResults({ elections }: { elections: WorldElection[] }) {
  if (!elections.length) return null;
  return (
    <section className="wd-results" aria-label="Latest results">
      <h2 className="wd-h2">Latest results</h2>
      <p className="wd-muted">Recent national elections, read live from each election's Wikipedia article. Unofficial until the official count is certified.</p>
      <div className="wd-results__grid">
        {elections.map((e) => <ResultCard key={e.id} e={e} />)}
      </div>
    </section>
  );
}
