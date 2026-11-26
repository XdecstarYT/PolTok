import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLive } from '../../lib/live';
import { useReducedMotion } from '../../components';

interface Item { id: string; text: string; label: string; color: string; to?: string; href?: string }

/** Victorian polls close 6pm AEDT Sat 28 Nov 2026. */
const VIC_CLOSE = Date.parse('2026-11-28T18:00:00+11:00');
const COL: Record<string, string> = { ALP: '#ff5a6a', LNP: '#5b93ff', LIB: '#5b93ff', NAT: '#5b93ff', GRN: '#36c46b', ONP: '#ff9a4a', IND: '#2ec4b6', OTH: '#a3adc8' };
const NAME: Record<string, string> = { ALP: 'Labor', LNP: 'Coalition', LIB: 'Coalition', NAT: 'Coalition', GRN: 'Greens', ONP: 'One Nation', IND: 'Independent', OTH: 'Other' };
const grp = (p?: string) => (!p ? 'OTH' : /^(LIB|NAT|LNP)/i.test(p) ? 'LNP' : /^ALP/i.test(p) ? 'ALP' : /^GRN/i.test(p) ? 'GRN' : /^ONP/i.test(p) ? 'ONP' : /^IND/i.test(p) ? 'IND' : 'OTH');
const title = (id: string) => id.replace(/^vic-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

type VicLite = { polls?: { newest?: { firm: string; date: string; ALP: number; LNP: number; GRN: number; ONP: number; tpp?: { ALP: number; LNP: number } | null } }; model?: { range: Record<string, { median: number }>; majority: { LNP: number; hung: number } }; earlyVotes?: { total: number }; projection?: { seats: Record<string, { win2022: string }> } };
type Res = { status: string; seats: Record<string, { leader?: string; called?: string }> };
type News = { id: string; title: string; url: string; source: string; publishedAt?: number };

/** One lightweight fetch per feed for the whole shell (kept out of the big AU bundles). */
function usePolled<T>(url: string, every: number): T | null {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    let dead = false, t: ReturnType<typeof setTimeout>;
    const run = () => fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => { if (!dead && j) setV(j); }).catch(() => {}).finally(() => { if (!dead) t = setTimeout(run, document.hidden ? every * 3 : every); });
    run();
    return () => { dead = true; clearTimeout(t); };
  }, [url, every]);
  return v;
}

/** The wire under the nav: the Victorian election first (polls, model, early votes; seat calls on the night), then the
 *  latest Australian and world news. Pauses on hover / focus. */
export function Ticker() {
  const { news } = useLive();
  const reduce = useReducedMotion();
  const vic = usePolled<VicLite>('/api/vic/live', 10 * 60_000);
  const counting = Date.now() >= VIC_CLOSE;
  const res = usePolled<Res>('/api/au/results?contest=vic2026', counting ? 60_000 : 30 * 60_000);
  const au = usePolled<{ items?: News[] }>('/api/au/news', 5 * 60_000);
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const seats = res && res.status !== 'pre-election' ? Object.entries(res.seats ?? {}) : [];
    if (seats.length) {
      const t: Record<string, number> = {};
      for (const [, s] of seats) { const g = grp(s.called ?? s.leader); t[g] = (t[g] ?? 0) + 1; }
      out.push({ id: 'tally', label: 'VIC COUNT', color: '#ff3d55', text: `Won + leading: ${Object.entries(t).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${NAME[k]} ${v}`).join(' · ')} · 45 to win`, to: '/au/victoria/live' });
      for (const [id, s] of seats.filter(([, s]) => s.called).slice(0, 10)) {
        const g = grp(s.called), held = vic?.projection?.seats[id]?.win2022;
        out.push({ id: 'c' + id, label: held && held !== g ? 'GAIN' : 'CALLED', color: COL[g], text: `${title(id)}: ${NAME[g]} ${held && held !== g ? `gain from ${NAME[held] ?? held}` : 'retain'}`, to: '/au/victoria/live' });
      }
      for (const [id, s] of seats.filter(([, s]) => !s.called && s.leader).slice(0, 6)) out.push({ id: 'l' + id, label: 'LEADING', color: COL[grp(s.leader)], text: `${title(id)}: ${NAME[grp(s.leader)]} ahead`, to: '/au/victoria/live' });
    } else {
      const days = Math.max(0, Math.ceil((VIC_CLOSE - Date.now()) / 864e5));
      out.push({ id: 'cd', label: 'VIC 2026', color: '#cdf25a', text: counting ? 'Polls have closed in Victoria: follow the count live' : `Victoria votes ${days <= 1 ? 'tomorrow' : `in ${days} days`}, Saturday 28 November · polls close 6pm AEDT`, to: counting ? '/au/victoria/live' : '/au/victoria' });
      const n = vic?.polls?.newest;
      if (n) out.push({ id: 'np', label: 'NEW POLL', color: '#ff3d55', text: `${n.firm.split('/')[0]} (${n.date}): Coalition ${n.LNP} · One Nation ${n.ONP} · Labor ${n.ALP} · Greens ${n.GRN}${n.tpp ? ` · 2PP ${n.tpp.LNP}–${n.tpp.ALP}` : ''}`, to: '/au/victoria' });
      const m = vic?.model;
      if (m) out.push({ id: 'md', label: 'MODEL', color: '#5b93ff', text: `PolTok seat model: Coalition ${m.range.LNP?.median ?? 0}, Labor ${m.range.ALP?.median ?? 0}, One Nation ${m.range.ONP?.median ?? 0}, Greens ${m.range.GRN?.median ?? 0} · ${Math.round(m.majority.LNP * 100)}% chance of a Coalition majority`, to: '/au/victoria/parliament' });
      if (vic?.earlyVotes) out.push({ id: 'ev', label: 'EARLY VOTES', color: '#cdf25a', text: `${(vic.earlyVotes.total / 1e6).toFixed(2)} million Victorians have already voted early`, to: '/au/victoria' });
      out.push({ id: 'fs', label: 'YOUR SEAT', color: '#2ec4b6', text: 'Find your seat, meet every candidate and see what they stand for', to: '/au/victoria/candidates' });
    }
    const vicNews = (au?.items ?? []).filter((x) => /victoria|victorian|melbourne|carroll|jess wilson|spring street|vec\b/i.test(x.title));
    const rest = (au?.items ?? []).filter((x) => !vicNews.includes(x));
    for (const x of vicNews.slice(0, 6)) out.push({ id: 'vn' + x.id, label: 'VIC NEWS', color: '#cdf25a', text: `${x.title} · ${x.source}`, href: x.url });
    for (const x of rest.slice(0, 5)) out.push({ id: 'an' + x.id, label: 'AUSTRALIA', color: '#7cc0ff', text: `${x.title} · ${x.source}`, href: x.url });
    for (const x of news.slice(0, 4)) out.push({ id: 'wn' + x.id, label: 'LATEST', color: '#a3adc8', text: `${x.title} · ${x.source}`, href: x.url });
    return out;
  }, [vic, res, au, news, counting]);

  const chars = items.reduce((a, i) => a + i.text.length + i.label.length + 8, 0);
  const duration = Math.max(40, Math.round((chars * 0.2) / 15) * 15);
  const row = (hidden: boolean) => (
    <ul className="tk__row" aria-hidden={hidden || undefined}>
      {items.map((it) => (
        <li key={it.id} className="tk__item">
          <span className="tk__label" style={{ color: it.color, borderColor: it.color + '66' }}>{it.label}</span>
          {it.to ? <Link to={it.to} tabIndex={hidden ? -1 : 0}>{it.text}</Link> : it.href ? <a href={it.href} target="_blank" rel="noreferrer" tabIndex={hidden ? -1 : 0}>{it.text}</a> : <span>{it.text}</span>}
          <span className="tk__sep" aria-hidden="true">◆</span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="tk" role="region" aria-label="Victorian election and news ticker">
      <div className="tk__badge tk__badge--vic">
        <span className="pulse" aria-hidden="true" />
        <span>{counting ? 'VIC LIVE' : 'VIC 2026'}</span>
      </div>
      <div className={`tk__viewport ${reduce ? 'is-static' : ''}`}>
        <div className="tk__track" style={{ animationDuration: `${duration}s` }}>
          {row(false)}
          {!reduce && row(true)}
        </div>
      </div>
    </div>
  );
}
