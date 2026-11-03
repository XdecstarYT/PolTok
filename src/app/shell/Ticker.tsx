import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLive } from '../../lib/live';
import { raceById } from '../../data';
import { PARTY_HEX } from '../../lib/format';
import { fmtET, useReducedMotion } from '../../components';

interface Item {
  id: string;
  text: string;
  label: string;
  color: string;
  to?: string;
}

/** Breaking-news / race-call marquee under the nav. Pauses on hover / focus. */
export function Ticker() {
  const { ticker, calls, news } = useLive();
  const reduce = useReducedMotion();
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const c of calls.slice(0, 8)) {
      const race = raceById.get(c.raceId);
      const cand = race?.candidates.find((x) => x.id === c.candidateId);
      out.push({
        id: `c-${c.raceId}`,
        label: c.flip ? 'FLIP' : 'CALL',
        color: PARTY_HEX[c.party] ?? '#fff',
        text: `${race?.title ?? c.raceId}: ${cand?.name ?? c.party} (${c.party}) projected winner · ${fmtET(c.at)}`,
        to: `/race/${c.raceId}`,
      });
    }
    for (const t of ticker.slice(0, 12))
      out.push({ id: t.id, label: t.level === 'breaking' ? 'BREAKING' : t.level === 'alert' ? 'ALERT' : 'UPDATE', color: t.level === 'info' ? '#22d3ee' : t.level === 'alert' ? '#f5c518' : '#ff2e63', text: t.text });
    if (out.length < 4)
      for (const n of news.slice(0, 8))
        out.push({ id: `n-${n.id}`, label: n.source.toUpperCase().slice(0, 14), color: '#a3adc8', text: n.title });
    if (!out.length)
      out.push(
        { id: 'w1', label: 'ELECTION DAY', color: '#c6ff3d', text: 'Polls are open across the country — results will stream in as polls close (simulated results)' },
        { id: 'w2', label: 'TIP', color: '#22d3ee', text: 'Press ⌘K / Ctrl+K to jump to any state, race or page' },
      );
    return out;
  }, [ticker, calls, news]);

  // duration scales with content length so speed stays ~40px/s
  const chars = items.reduce((a, i) => a + i.text.length + i.label.length + 8, 0);
  const duration = Math.max(30, Math.round((chars * 0.2) / 15) * 15);

  const row = (hidden: boolean) => (
    <ul className="tk__row" aria-hidden={hidden || undefined}>
      {items.map((it) => (
        <li key={it.id} className="tk__item">
          <span className="tk__label" style={{ color: it.color, borderColor: it.color + '66' }}>{it.label}</span>
          {it.to ? (
            <Link to={it.to} tabIndex={hidden ? -1 : 0}>{it.text}</Link>
          ) : (
            <span>{it.text}</span>
          )}
          <span className="tk__sep" aria-hidden="true">◆</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="tk" role="region" aria-label="Live ticker">
      <div className="tk__badge">
        <span className="pulse" aria-hidden="true" />
        <span>LIVE WIRE</span>
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
