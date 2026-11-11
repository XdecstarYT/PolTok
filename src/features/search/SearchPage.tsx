/** /search?q=&type= — full global search results with type filters and highlighted matches. */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RatingBadge, PageHeader } from '../../components';
import { IconSearch } from '../../app/shell/icons';
import { KINDS, KIND_PLURAL, pushRecent, search, useSearchIndex, type Entry, type Kind } from './searchIndex';
import { Highlight } from './Highlight';
import './search.css';

const PAGE = 60;

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const type = (params.get('type') ?? '') as Kind | '';
  const [draft, setDraft] = useState(q);
  const [shown, setShown] = useState(PAGE);
  const index = useSearchIndex();

  useEffect(() => {
    setDraft(q);
  }, [q]);
  useEffect(() => {
    setShown(PAGE);
  }, [q, type]);
  // debounce typing into the URL (replace, so history isn't spammed)
  useEffect(() => {
    if (draft === q) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(params);
      if (draft.trim()) p.set('q', draft); else p.delete('q');
      setParams(p, { replace: true });
    }, 160);
    return () => clearTimeout(t);
  }, [draft]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = q ? `“${q}” · Search · PolTok` : 'Search · PolTok';
  }, [q]);

  const hits = useMemo(() => search(index, q, 2000), [index, q]);
  const counts = useMemo(() => {
    const c = new Map<Kind, number>();
    for (const h of hits) c.set(h.e.kind, (c.get(h.e.kind) ?? 0) + 1);
    return c;
  }, [hits]);
  const filtered = type ? hits.filter((h) => h.e.kind === type) : hits;

  const setType = (k: Kind | '') => {
    const p = new URLSearchParams(params);
    if (k) p.set('type', k); else p.delete('type');
    setParams(p, { replace: true });
  };
  const remember = (e: Entry) => pushRecent({ id: e.id, kind: e.kind, label: e.label, to: e.to, href: e.href });

  return (
    <div className="srch">
      <PageHeader className="srch__head" kicker="Find anything" title="Search" sub="Races, candidates, states, Australian seats, parties and news." />
      <form className="srch__box" role="search" onSubmit={(ev) => { ev.preventDefault(); setParams(draft.trim() ? { q: draft } : {}); }}>
        <IconSearch />
        <input
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Races, candidates, states, AU seats, parties, news…"
          aria-label="Search PolTok"
          autoFocus
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
        />
      </form>

      {q.trim() && (
        <div className="srch__filters" role="group" aria-label="Filter by type">
          <button type="button" className="srch__chip" aria-pressed={!type} onClick={() => setType('')}>All <span>{hits.length}</span></button>
          {KINDS.filter((k) => counts.get(k)).map((k) => (
            <button key={k} type="button" className="srch__chip" aria-pressed={type === k} onClick={() => setType(type === k ? '' : k)}>
              {KIND_PLURAL[k]} <span>{counts.get(k)}</span>
            </button>
          ))}
        </div>
      )}

      {!q.trim() ? (
        <p className="srch__empty">Type to search {index.length.toLocaleString()} items — fuzzy and typo tolerant (try “pensilvania”, “ossof”, “kooyong”, “melbourne”).</p>
      ) : filtered.length === 0 ? (
        <p className="srch__empty">No matches for “{q}”{type ? ` in ${KIND_PLURAL[type]}` : ''}.</p>
      ) : (
        <>
          <p className="srch__meta" aria-live="polite">{filtered.length.toLocaleString()} result{filtered.length === 1 ? '' : 's'}{type ? ` · ${KIND_PLURAL[type]}` : ''}</p>
          <ul className="srch__list">
            {filtered.slice(0, shown).map(({ e }) => {
              const body = (
                <>
                  <span className={`cmdk__kind cmdk__kind--${e.kind.toLowerCase().replace(/\s+/g, '-')}`}>{e.kind}</span>
                  <span className="cmdk__text">
                    <span className="srch__label"><Highlight text={e.label} q={q} /></span>
                    {e.sub && <span className="srch__sub"><Highlight text={e.sub} q={q} /></span>}
                  </span>
                  {e.rating && <RatingBadge rating={e.rating} />}
                </>
              );
              return (
                <li key={e.id} className="srch__item">
                  {e.run ? (
                    <button type="button" onClick={e.run}>{body}</button>
                  ) : e.href ? (
                    <a href={e.href} target="_blank" rel="noopener noreferrer" onClick={() => remember(e)}>{body}</a>
                  ) : (
                    <Link to={e.to ?? '/'} onClick={() => remember(e)}>{body}</Link>
                  )}
                </li>
              );
            })}
          </ul>
          {filtered.length > shown && (
            <button type="button" className="srch__chip srch__more" onClick={() => setShown((s) => s + PAGE)}>
              Show more <span>{filtered.length - shown}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
