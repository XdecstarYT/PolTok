import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Kbd, RatingBadge } from '../../components';
import { IconSearch, IconArrow } from './icons';
import { KINDS, KIND_PLURAL, PAGES, clearRecent, loadRecent, pushRecent, search, useSearchIndex, type Entry, type Kind } from '../../features/search/searchIndex';
import { Highlight } from '../../features/search/Highlight';
import '../../features/search/search.css';

type Row = { type: 'head'; label: string; clear?: boolean } | { type: 'item'; e: Entry; i: number };

const PER_GROUP: Partial<Record<Kind, number>> = { News: 4, Action: 4 };

/** ⌘K / Ctrl+K palette: global fuzzy search, quick actions, recents. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const index = useSearchIndex();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const [recent, setRecent] = useState(loadRecent);
  const listRef = useRef<HTMLUListElement>(null);

  const { rows, items, total } = useMemo(() => {
    const rows: Row[] = [];
    const items: Entry[] = [];
    const add = (e: Entry) => { rows.push({ type: 'item', e, i: items.length }); items.push(e); };
    const query = q.trim();
    if (!query) {
      if (recent.length) {
        rows.push({ type: 'head', label: 'Recent', clear: true });
        for (const r of recent) add({ ...r, id: `recent:${r.id}`, keys: '', sub: r.q ? `Search · “${r.q}”` : r.kind });
      }
      rows.push({ type: 'head', label: 'Pages' });
      PAGES.slice(0, 8).forEach((p) => add(index.find((e) => e.id === `p${p.to}`)!));
      rows.push({ type: 'head', label: 'Quick actions' });
      index.filter((e) => e.id === 'x:ui' || e.id === 'x:tz:Australia/Melbourne' || e.id === 'x:tz:America/New_York' || e.id === 'x:settings').forEach(add);
      return { rows, items, total: 0 };
    }
    const hits = search(index, query);
    const groups = new Map<Kind, Entry[]>();
    for (const h of hits) {
      const g = groups.get(h.e.kind) ?? [];
      if (g.length < (PER_GROUP[h.e.kind] ?? 6)) g.push(h.e);
      groups.set(h.e.kind, g);
    }
    // groups ordered by their best hit (hits are sorted, so Map insertion order already reflects that)
    for (const [k, g] of groups) {
      rows.push({ type: 'head', label: KIND_PLURAL[k] });
      g.forEach(add);
    }
    if (hits.length) {
      rows.push({ type: 'head', label: '' });
      add({ id: 'all', kind: 'Page', label: `See all ${hits.length} results for “${query}”`, to: `/search?q=${encodeURIComponent(query)}`, keys: '' });
    }
    return { rows, items, total: hits.length };
  }, [q, index, recent]);

  useEffect(() => {
    setIdx(0);
  }, [q]);
  useEffect(() => {
    if (open) { setQ(''); setRecent(loadRecent()); }
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const go = (e?: Entry) => {
    if (!e) return;
    const query = q.trim();
    const realId = e.id.replace(/^recent:/, '');
    if (e.id === 'all') pushRecent({ id: `q:${query}`, kind: 'Page', label: query, to: e.to, q: query });
    else if (!e.run && !realId.startsWith('q:')) pushRecent({ id: realId, kind: e.kind, label: e.label, to: e.to, href: e.href });
    onClose();
    if (e.run) e.run();
    else if (e.href) window.open(e.href, '_blank', 'noopener');
    else if (e.to) nav(e.to);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (ev.key === 'Home' && ev.ctrlKey) { ev.preventDefault(); setIdx(0); }
    else if (ev.key === 'Enter') {
      ev.preventDefault();
      if ((ev.metaKey || ev.ctrlKey) && q.trim()) go({ id: 'all', kind: 'Page', label: '', to: `/search?q=${encodeURIComponent(q.trim())}`, keys: '' });
      else go(items[idx]);
    }
  };

  const query = q.trim();
  return (
    <Modal open={open} onClose={onClose} hideClose ariaLabel="Search PolTok" width={640}>
      <div className="cmdk">
        <div className="cmdk__input">
          <IconSearch />
          <input
            data-autofocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search races, candidates, states, AU seats, news…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-autocomplete="list"
            aria-activedescendant={items[idx] ? `cmdk-${items[idx].id}` : undefined}
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="cmdk__list" id="cmdk-list" role="listbox" ref={listRef} aria-label="Results">
          {query && items.length === 0 && <li className="cmdk__empty">No matches for “{q}”.</li>}
          {rows.map((r, k) =>
            r.type === 'head' ? (
              r.label ? (
                <li key={`h${k}`} className="cmdk__group" role="presentation">
                  <span>{r.label}</span>
                  {r.clear && <button type="button" onClick={() => { clearRecent(); setRecent([]); }}>Clear</button>}
                </li>
              ) : null
            ) : (
              <li
                key={r.e.id}
                id={`cmdk-${r.e.id}`}
                data-i={r.i}
                role="option"
                aria-selected={r.i === idx}
                className={`cmdk__item${r.e.id === 'all' ? ' cmdk__item--all' : ''}`}
                onMouseMove={() => setIdx(r.i)}
                onClick={() => go(r.e)}
              >
                <span className={`cmdk__kind cmdk__kind--${r.e.kind.toLowerCase().replace(/\s+/g, '-')}`}>{r.e.kind}</span>
                <span className="cmdk__text">
                  <span className="cmdk__label truncate">{r.e.id === 'all' ? r.e.label : <Highlight text={r.e.label} q={query} />}</span>
                  {r.e.sub && <span className="cmdk__sub truncate">{r.e.sub}</span>}
                </span>
                {r.e.rating && <RatingBadge rating={r.e.rating} />}
                <IconArrow width={16} height={16} className="cmdk__go" />
              </li>
            ),
          )}
        </ul>
        <div className="cmdk__foot">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> open</span>
          <span><Kbd>⌘↵</Kbd> all results</span>
          <span className="faint">{query ? `${total} matches` : `${index.length} items · ${KINDS.length} types`}</span>
        </div>
      </div>
    </Modal>
  );
}
