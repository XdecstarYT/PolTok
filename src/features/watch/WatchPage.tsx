import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, EmptyState, SectionHeader, SimBadge, useToast } from '../../components';
import { RACES } from '../../data';
import { useLive } from '../../lib/live';
import { useSettings } from '../../lib/settings';
import { useWatchlist, isAuWatchId } from '../../lib/watchlist';
import { useAuResults } from '../au/api';
import { AuWatchCard, UsWatchCard } from './WatchCard';
import { WatchStar } from './WatchStar';
import { demMarginOf, resolveWatch, type WatchItem } from './model';
import './watch.css';

type Sort = 'custom' | 'closest' | 'reporting' | 'alpha';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'custom', label: 'My order' },
  { id: 'closest', label: 'Closest' },
  { id: 'reporting', label: '% in' },
  { id: 'alpha', label: 'A–Z' },
];

function NotifyButton() {
  const { settings } = useSettings();
  const toast = useToast();
  const supported = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState<string>(supported ? Notification.permission : 'unsupported');
  if (settings.alerts === 'off')
    return <span className="wt-hint mono">Alerts are off in Settings</span>;
  if (!supported) return <span className="wt-hint mono">Browser notifications unsupported</span>;
  if (perm === 'granted') return <span className="wt-hint mono">🔔 Browser alerts on</span>;
  if (perm === 'denied') return <span className="wt-hint mono">Browser alerts blocked</span>;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          const p = await Notification.requestPermission();
          setPerm(p);
          if (p === 'granted') toast.push({ kicker: 'ALERTS', title: 'Browser alerts enabled', body: 'You’ll be notified when a watched race is called or flips leader.', tone: 'ok' });
        } catch {
          setPerm('denied');
        }
      }}
    >
      🔔 Enable browser alerts
    </Button>
  );
}

export default function WatchPage() {
  const wl = useWatchlist();
  const { results, news } = useLive();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const shared = useMemo(() => (params.get('w') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40), [params]);
  const viewingShared = shared.length > 0;
  const ids = viewingShared ? shared : wl.ids;
  const [sort, setSort] = useState<Sort>('custom');
  const items = useMemo(() => ids.map(resolveWatch).filter((x): x is WatchItem => !!x), [ids]);
  const hasVic = items.some((i) => i.kind === 'au' && i.seat.chamber === 'vic');
  const au = useAuResults(hasVic ? 'vic2026' : null);

  const sorted = useMemo(() => {
    if (sort === 'custom') return items;
    const key = (i: WatchItem) => {
      if (i.kind === 'au') return { close: Math.abs(i.seat.margin ?? 99), pct: au.data?.seats?.[i.seat.id]?.counted ?? 0, name: i.seat.name };
      const r = results[i.id];
      const m = demMarginOf(i.race, r);
      return { close: m == null ? 99 : Math.abs(m), pct: r?.expectedPct ?? 0, name: i.race.title };
    };
    return [...items].sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (sort === 'closest') return ka.close - kb.close;
      if (sort === 'reporting') return kb.pct - ka.pct;
      return ka.name.localeCompare(kb.name);
    });
  }, [items, sort, results, au.data]);

  const share = async () => {
    const url = `${location.origin}/watch?w=${encodeURIComponent(wl.ids.join(','))}`.replace(/%2C/g, ',').replace(/%3A/g, ':');
    try {
      if (navigator.share) await navigator.share({ title: 'My PolTok watchlist', url });
      else {
        await navigator.clipboard.writeText(url);
        toast.push({ kicker: 'SHARE', title: 'Link copied', body: url, tone: 'ok' });
      }
    } catch {
      toast.push({ kicker: 'SHARE', title: 'Copy this link', body: url, duration: 0 });
    }
  };

  const suggestions = RACES.filter((r) => r.key && !wl.has(r.id)).slice(0, 10);
  const compareIds = items.filter((i) => i.kind === 'us').slice(0, 4).map((i) => i.id);

  return (
    <div className="page wt">
      <header className="wt-head">
        <div>
          <span className="wt-kick mono">★ {viewingShared ? 'SHARED WATCHLIST' : 'YOUR WATCHLIST'}</span>
          <h1 className="wt-h1">{viewingShared ? 'Shared races' : 'My races'}</h1>
          <p className="wt-sub">Live cards for every race you star. Alerts fire when a watched race is called or changes leader.</p>
        </div>
        <div className="wt-head__acts">
          <SimBadge />
          {!viewingShared && <NotifyButton />}
          {!viewingShared && wl.ids.length > 0 && <Button variant="ghost" size="sm" onClick={share}>Share list</Button>}
          {compareIds.length >= 2 && <Button variant="ghost" size="sm" to={`/compare?r=${compareIds.join(',')}`}>Compare</Button>}
        </div>
      </header>

      {viewingShared && (
        <div className="wt-banner">
          <span>Viewing a shared list of {items.length} race{items.length === 1 ? '' : 's'}.</span>
          <div className="row" style={{ gap: 8 }}>
            <Button size="sm" onClick={() => { wl.add(shared); setParams({}); toast.push({ kicker: 'WATCHLIST', title: `Added ${items.length} races`, tone: 'ok' }); }}>Add all to mine</Button>
            <Button size="sm" variant="ghost" onClick={() => setParams({})}>Back to my list</Button>
          </div>
        </div>
      )}

      {items.length > 0 ? (
        <>
          <div className="wt-sort" role="group" aria-label="Sort watchlist">
            {SORTS.map((s) => (
              <button key={s.id} type="button" className={sort === s.id ? 'is-on' : ''} aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>
            ))}
            <span className="wt-hint mono">{items.length} watched</span>
          </div>
          <div className="wt-grid">
            {sorted.map((i, idx) => {
              const ctl = !viewingShared && sort === 'custom' ? {
                onUp: idx > 0 ? () => wl.move(i.id, -1) : undefined,
                onDown: idx < sorted.length - 1 ? () => wl.move(i.id, 1) : undefined,
                onRemove: () => wl.remove(i.id),
              } : {};
              return i.kind === 'us'
                ? <UsWatchCard key={i.id} race={i.race} result={results[i.id]} news={news} {...ctl} />
                : <AuWatchCard key={i.id} seat={i.seat} result={au.data?.seats?.[i.seat.id]} {...ctl} />;
            })}
          </div>
        </>
      ) : (
        <EmptyState
          title="No races starred yet"
          description={<>Tap ★ on any <Link to="/races">race</Link> or <Link to="/au">Australian seat</Link>, or start with these key races.</>}
          icon={<span style={{ fontSize: 26 }}>★</span>}
        />
      )}

      {!viewingShared && suggestions.length > 0 && (
        <section className="wt-suggest">
          <SectionHeader kicker="SUGGESTED" title="Key races to watch" action={<Button size="sm" variant="ghost" onClick={() => wl.add(suggestions.map((r) => r.id))}>Watch all</Button>} />
          <ul className="wt-suggest__list">
            {suggestions.map((r) => (
              <li key={r.id}>
                <Link to={`/race/${r.id}`}>{r.title}</Link>
                <WatchStar raceId={r.id} label={r.title} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {items.some((i) => isAuWatchId(i.id)) && <p className="wt-hint mono">AU seat counts from the Victorian results feed when available.</p>}
    </div>
  );
}
