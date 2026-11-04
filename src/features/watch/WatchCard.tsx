import { Link } from 'react-router-dom';
import type { NewsItem, RaceResult } from '../../types';
import type { AuSeat } from '../../data/au';
import type { SeatResult } from '../au/api';
import { Needle, ProgressBar, RatingBadge, fmtTime } from '../../components';
import { PARTY_HEX, fmtInt } from '../../lib/format';
import { party as auParty, pColor } from '../au/model';
import type { Race } from '../../types';
import { WatchStar } from './WatchStar';
import { demMarginOf, demProbOf, fmtMargin, headlinesFor, shares, statusLabel } from './model';

interface Controls { onUp?: () => void; onDown?: () => void; onRemove?: () => void }

function Reorder({ onUp, onDown, onRemove, name }: Controls & { name: string }) {
  if (!onUp && !onDown && !onRemove) return null;
  return (
    <div className="wt-reorder">
      {onUp && <button type="button" onClick={onUp} aria-label={`Move ${name} up`}>↑</button>}
      {onDown && <button type="button" onClick={onDown} aria-label={`Move ${name} down`}>↓</button>}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}>✕</button>}
    </div>
  );
}

export function UsWatchCard({ race, result, news, ...ctl }: { race: Race; result?: RaceResult; news: NewsItem[] } & Controls) {
  const rows = shares(race, result).slice(0, 3);
  const called = result?.status === 'called' ? result.calledFor : undefined;
  const m = demMarginOf(race, result);
  const prob = demProbOf(race, result);
  const heads = headlinesFor(news, race, 3);
  const st = result?.status ?? 'not-started';
  return (
    <article className={`wt-card ${called ? 'is-called' : ''}`} style={{ ['--wc' as string]: called ? PARTY_HEX[rows.find((x) => x.cand.id === called)?.cand.party ?? 'O'] : 'var(--line-2)' }}>
      <header className="wt-card__h">
        <div className="wt-card__t">
          <span className="wt-kick mono">{race.chamber.toUpperCase()} · {race.state}</span>
          <Link to={`/race/${race.id}`} className="wt-card__name">{race.title}</Link>
        </div>
        <div className="wt-card__acts">
          <WatchStar raceId={race.id} label={race.title} compact />
          <Reorder {...ctl} name={race.title} />
        </div>
      </header>
      <div className="wt-card__meta">
        <span className={`wt-status wt-status--${st}`}>{called ? '✓ ' : ''}{statusLabel(result)}</span>
        <RatingBadge rating={race.rating} />
        {m != null && <span className="wt-margin num" style={{ color: PARTY_HEX[m >= 0 ? 'D' : 'R'] }}>{fmtMargin(m)}</span>}
      </div>
      <div className="wt-card__body">
        <ul className="wt-rows">
          {rows.map((x) => (
            <li key={x.cand.id} className={called === x.cand.id ? 'is-win' : ''}>
              <div className="wt-row__top">
                <span className="wt-row__n"><i style={{ background: PARTY_HEX[x.cand.party] }} />{x.cand.name}{called === x.cand.id && <b className="wt-check" aria-label="winner"> ✓</b>}</span>
                <span className="num wt-row__p">{x.pct.toFixed(1)}%</span>
              </div>
              <div className="wt-bar"><span style={{ width: `${x.pct}%`, background: PARTY_HEX[x.cand.party] }} /></div>
              <span className="wt-row__v num">{fmtInt(x.votes)} votes</span>
            </li>
          ))}
        </ul>
        <div className="wt-needle">
          <Needle demProb={prob} size={150} showBands={false} jitter={!called} label="Win prob." />
        </div>
      </div>
      <div className="wt-in">
        <ProgressBar value={result?.expectedPct ?? 0} label={`${race.title} expected vote counted`} />
        <span className="num mono">{Math.round(result?.expectedPct ?? 0)}% in{result?.updatedAt ? ` · ${fmtTime(result.updatedAt)}` : ''}</span>
      </div>
      {heads.length > 0 && (
        <ul className="wt-news">
          {heads.map((n) => (
            <li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> <span className="mono">{n.source}</span></li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function AuWatchCard({ seat, result, ...ctl }: { seat: AuSeat; result?: SeatResult } & Controls) {
  const c = pColor(seat.party);
  return (
    <article className="wt-card" style={{ ['--wc' as string]: c }}>
      <header className="wt-card__h">
        <div className="wt-card__t">
          <span className="wt-kick mono">{seat.chamber === 'vic' ? 'VIC ASSEMBLY' : 'AU FEDERAL'} · {seat.state}</span>
          <Link to={`/au/seat/${seat.id}`} className="wt-card__name">{seat.name}</Link>
        </div>
        <div className="wt-card__acts">
          <WatchStar auSeatId={seat.id} label={seat.name} compact />
          <Reorder {...ctl} name={seat.name} />
        </div>
      </header>
      <div className="wt-card__meta">
        <span className="wt-status" style={{ color: c }}>Held: {auParty(seat.party).short}</span>
        <span className="mono">{seat.member || 'TBD'}</span>
        <span className="num mono">Margin {seat.margin != null ? `${seat.margin.toFixed(1)}%` : 'TBD'}</span>
      </div>
      {result?.tcp?.length ? (
        <ul className="wt-rows">
          {result.tcp.map((t) => (
            <li key={t.party} className={result.called === t.party ? 'is-win' : ''}>
              <div className="wt-row__top">
                <span className="wt-row__n"><i style={{ background: pColor(t.party) }} />{auParty(t.party).short}{result.called === t.party && <b className="wt-check"> ✓</b>}</span>
                <span className="num wt-row__p">{t.pct.toFixed(1)}%</span>
              </div>
              <div className="wt-bar"><span style={{ width: `${t.pct}%`, background: pColor(t.party) }} /></div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="wt-note">{seat.chamber === 'vic' ? 'No two-candidate-preferred count yet.' : 'Next federal election not yet due — tracking holder & margin.'}{seat.note ? ` ${seat.note}` : ''}</p>
      )}
      {result && <div className="wt-in"><ProgressBar value={result.counted} label={`${seat.name} counted`} /><span className="num mono">{Math.round(result.counted)}% counted</span></div>}
    </article>
  );
}
