import { fmtHHMM, tzAbbr } from '../../components/time';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RACES, STATES } from '../../data';
import { Modal, Kbd, RatingBadge } from '../../components';
import { IconSearch, IconArrow } from './icons';

interface Entry {
  id: string;
  kind: 'Page' | 'State' | 'Race';
  label: string;
  sub?: string;
  to: string;
  hay: string;
  rating?: import('../../types').Rating;
}

const PAGES: { to: string; label: string; sub: string }[] = [
  { to: '/', label: 'Home', sub: 'Election night dashboard' },
  { to: '/live', label: 'Live results', sub: 'Election night command center' },
  { to: '/map', label: 'Map', sub: 'Electoral & results map' },
  { to: '/map/senate', label: 'Senate map', sub: 'Map · Senate races' },
  { to: '/map/house', label: 'House map', sub: 'Map · House races' },
  { to: '/map/governor', label: 'Governor map', sub: 'Map · Governor races' },
  { to: '/map/pres2024', label: '2024 presidential map', sub: 'Map · baseline' },
  { to: '/feed', label: 'PolTok feed', sub: 'Vertical story feed' },
  { to: '/news', label: 'News', sub: 'Aggregated headlines with bias' },
  { to: '/polls', label: 'Polls', sub: 'Generic ballot, approval & race polls' },
  { to: '/forecast', label: 'Forecast & markets', sub: 'Model & prediction markets' },
  { to: '/races', label: 'All races', sub: 'Senate, House, Governor' },
  { to: '/flips', label: 'Seats that flipped', sub: 'Seats that changed hands · net gains' },
  { to: '/measures', label: 'Ballot measures', sub: 'Statewide ballot measures · live results' },
  { to: '/au', label: 'Australia', sub: 'Federal parliament, polls, markets, AU news' },
  { to: '/au/victoria', label: 'Victorian election 2026', sub: 'Australia · 28 Nov results night' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ⌘K / Ctrl+K palette searching pages, states and races. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const all = useMemo<Entry[]>(() => {
    const pages: Entry[] = PAGES.map((p) => ({ id: `p${p.to}`, kind: 'Page', label: p.label, sub: p.sub, to: p.to, hay: norm(`${p.label} ${p.sub}`) }));
    const states: Entry[] = (STATES ?? []).map((s) => ({ id: `s${s.abbr}`, kind: 'State', label: s.name, sub: `${s.abbr} · polls close ${fmtHHMM(s.pollClose)} ${tzAbbr()}`, to: `/state/${s.abbr}`, hay: norm(`${s.name} ${s.abbr}`) }));
    const races: Entry[] = (RACES ?? []).map((r) => ({
      id: `r${r.id}`, kind: 'Race', label: r.title, sub: `${r.id} · ${(r.candidates ?? []).map((c) => `${c.name} (${c.party})`).join(' vs ') || 'Candidates TBD'}`,
      to: `/race/${r.id}`, rating: r.rating, hay: norm(`${r.title} ${r.id} ${r.state} ${r.chamber} ${(r.candidates ?? []).map((c) => c.name).join(' ')}`),
    }));
    return [...pages, ...states, ...races];
  }, []);

  const results = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return all.filter((e) => e.kind === 'Page' || (e.kind === 'Race' && RACES.find((r) => `r${r.id}` === e.id)?.key)).slice(0, 14);
    const terms = n.split(/\s+/);
    const scored: { e: Entry; s: number }[] = [];
    for (const e of all) {
      if (!terms.every((t) => e.hay.includes(t))) continue;
      let s = 0;
      const l = norm(e.label);
      if (l === n) s += 100;
      if (l.startsWith(n)) s += 40;
      if (e.kind === 'State' && e.id.slice(1).toLowerCase() === n) s += 120;
      if (e.kind === 'Page') s += 10;
      s -= l.length * 0.1;
      scored.push({ e, s });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, 30).map((x) => x.e);
  }, [q, all]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  const go = (e?: Entry) => {
    if (!e) return;
    onClose();
    nav(e.to);
  };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (ev.key === 'Enter') { ev.preventDefault(); go(results[idx]); }
  };

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
            placeholder="Search states, races, candidates, pages…"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={results[idx] ? `cmdk-${results[idx].id}` : undefined}
          />
          <Kbd>esc</Kbd>
        </div>
        <ul className="cmdk__list" id="cmdk-list" role="listbox" ref={listRef}>
          {results.length === 0 && <li className="cmdk__empty">No matches for “{q}”.</li>}
          {results.map((e, i) => (
            <li
              key={e.id}
              id={`cmdk-${e.id}`}
              data-i={i}
              role="option"
              aria-selected={i === idx}
              className="cmdk__item"
              onMouseMove={() => setIdx(i)}
              onClick={() => go(e)}
            >
              <span className={`cmdk__kind cmdk__kind--${e.kind.toLowerCase()}`}>{e.kind}</span>
              <span className="cmdk__text">
                <span className="cmdk__label truncate">{e.label}</span>
                {e.sub && <span className="cmdk__sub truncate">{e.sub}</span>}
              </span>
              {e.rating && <RatingBadge rating={e.rating} />}
              <IconArrow width={16} height={16} className="cmdk__go" />
            </li>
          ))}
        </ul>
        <div className="cmdk__foot">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> open</span>
          <span className="faint">{all.length} items indexed</span>
        </div>
      </div>
    </Modal>
  );
}
