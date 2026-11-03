import { memo, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Chamber } from '../../types';
import { Avatar } from '../../components';
import { PARTY_HEX, fmtInt, timeAgo } from '../../lib/format';
import type { FilterKey, RaceView, SortKey } from './model';
import { filterViews, fmtClock, sortViews } from './model';
import { AnimNum, StatusChip } from './widgets';

const SORTS: { k: SortKey; label: string }[] = [
  { k: 'key', label: 'Key races' },
  { k: 'closest', label: 'Closest' },
  { k: 'recent', label: 'Recently updated' },
  { k: 'close-time', label: 'Poll closing' },
];
const FILTERS: { k: FilterKey; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'called', label: 'Called' },
  { k: 'uncalled', label: 'Uncalled' },
  { k: 'flips', label: 'Flips' },
];
const TABS: { k: Chamber; label: string }[] = [
  { k: 'senate', label: 'Senate' },
  { k: 'governor', label: 'Governor' },
  { k: 'house', label: 'House' },
];
const PAGE = 36;

export function RaceGrid({ views, now }: { views: RaceView[]; now: number }) {
  const [tab, setTab] = useState<Chamber>('senate');
  const [sort, setSort] = useState<SortKey>('key');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const counts = useMemo(() => {
    const c: Record<Chamber, { n: number; called: number }> = { senate: { n: 0, called: 0 }, governor: { n: 0, called: 0 }, house: { n: 0, called: 0 } };
    for (const v of views) {
      c[v.race.chamber].n++;
      if (v.winner) c[v.race.chamber].called++;
    }
    return c;
  }, [views]);

  const list = useMemo(() => sortViews(filterViews(views.filter((v) => v.race.chamber === tab), filter, q), sort), [views, tab, filter, q, sort]);
  const shown = list.slice(0, limit);
  const loading = views.length === 0;

  return (
    <section className="lv-panel lv-grid-panel" aria-labelledby="lv-grid-h">
      <header className="lv-panel-h lv-grid-h">
        <h2 id="lv-grid-h">Race results</h2>
        <div className="lv-tabs" role="tablist" aria-label="Chamber">
          {TABS.map((t) => (
            <button
              key={t.k}
              role="tab"
              aria-selected={tab === t.k}
              className={`lv-tab ${tab === t.k ? 'is-on' : ''}`}
              onClick={() => {
                setTab(t.k);
                setLimit(PAGE);
              }}
              disabled={!loading && counts[t.k].n === 0}
            >
              {t.label}
              <span className="mono lv-tab-n">
                {counts[t.k].called}/{counts[t.k].n}
              </span>
            </button>
          ))}
        </div>
      </header>
      <div className="lv-grid-controls">
        <div className="lv-seg" role="group" aria-label="Filter races">
          {FILTERS.map((f) => (
            <button key={f.k} className={`lv-seg-b ${filter === f.k ? 'is-on' : ''}`} aria-pressed={filter === f.k} onClick={() => setFilter(f.k)}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="lv-select">
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.k} value={s.k}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <input className="lv-search" type="search" placeholder="Search state or candidate" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search races" />
      </div>

      {loading ? (
        <div className="lv-cards">
          {Array.from({ length: 9 }, (_, i) => (
            <div key={i} className="lv-card lv-card-skel" aria-hidden>
              <span className="lv-skel lv-skel-line" style={{ width: '50%' }} />
              <span className="lv-skel lv-skel-line" style={{ width: '90%', marginTop: 16 }} />
              <span className="lv-skel lv-skel-line" style={{ width: '80%' }} />
              <span className="lv-skel lv-skel-line" style={{ width: '40%', marginTop: 12 }} />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="lv-empty">No races match these filters.</p>
      ) : (
        <div className="lv-cards">
          {shown.map((v) => (
            <RaceCard key={v.race.id} v={v} now={now} />
          ))}
        </div>
      )}
      {list.length > limit && (
        <button className="lv-more" onClick={() => setLimit((l) => l + PAGE * 2)}>
          Show more · {list.length - limit} remaining
        </button>
      )}
    </section>
  );
}

export const RaceCard = memo(function RaceCard({ v, now }: { v: RaceView; now: number }) {
  const r = v.race;
  const top = v.cands.slice(0, 3);
  const counting = v.total > 0;
  const fav = [...v.cands].sort((a, b) => b.prob - a.prob)[0];
  const recent = v.updatedAt && now - v.updatedAt < 4000;
  const subtitle = r.chamber === 'house' ? `District ${r.district === 0 ? 'At-large' : r.district}` : r.special ? 'Special' : r.chamber === 'senate' ? 'Senate' : 'Governor';
  return (
    <Link
      to={`/race/${r.id}`}
      className={`lv-card ${v.winner ? 'is-called' : ''} ${v.status === 'too-close' ? 'is-tooclose' : ''} ${recent ? 'is-fresh' : ''}`}
      style={{ ['--pc' as string]: v.winner ? PARTY_HEX[v.winner.party] : 'transparent' }}
      aria-label={`${r.title}: ${v.winner ? `called for ${v.winner.name}` : v.status}`}
    >
      <div className="lv-card-h">
        <span className="lv-card-st mono">{r.state}</span>
        <span className="lv-card-t">
          <b>{v.state?.name ?? r.title}</b>
          <small>
            {subtitle}
            {r.key && <em className="lv-key">KEY</em>}
          </small>
        </span>
        <StatusChip v={v} />
      </div>
      <ul className="lv-cands">
        {top.length === 0 && <li className="lv-empty">Candidates TBD</li>}
        {top.map((c) => {
          const won = v.winner?.id === c.c.id;
          return (
            <li key={c.c.id} className={won ? 'is-won' : ''}>
              <Avatar name={c.c.name} party={c.c.party} src={c.c.photo} size={26} />
              <span className="lv-cand-n">
                <span className="lv-cand-name">
                  {c.c.name}
                  {c.c.incumbent && <sup title="Incumbent">INC</sup>}
                  {won && <span className="lv-check" aria-label="winner">✓</span>}
                </span>
                <span className="lv-cand-bar">
                  <i style={{ width: `${counting ? c.pct : 0}%`, background: PARTY_HEX[c.c.party] }} />
                </span>
              </span>
              <span className="lv-cand-v mono">
                <b>{counting ? <AnimNum value={c.pct} format={(n) => `${n.toFixed(1)}%`} /> : '—'}</b>
                <small>{counting ? <AnimNum value={c.votes} format={fmtInt} flash={false} /> : c.c.party}</small>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="lv-card-f mono">
        <span className="lv-exp" title="Estimated share of expected vote counted">
          <span className="lv-exp-track">
            <i style={{ width: `${Math.min(100, v.expectedPct)}%` }} />
          </span>
          <span>
            {v.status === 'not-started' ? `Polls close ${fmtClock(v.closeMin)} ET` : `${Math.round(v.expectedPct)}% in`}
          </span>
        </span>
        {!v.winner && fav && fav.prob > 0 && (
          <span className="lv-prob" style={{ color: PARTY_HEX[fav.c.party] }} title="Model win probability (simulated)">
            {fav.c.party} {Math.round(fav.prob * 100)}%
          </span>
        )}
        {v.winner && v.result?.calledAt && <span className="lv-prob muted">called {timeAgo(v.result.calledAt, now)}</span>}
      </div>
    </Link>
  );
});
