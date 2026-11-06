/** Non-US hero panels for the home country switcher (lazy-loaded: AU data is ~65 KB). */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AU_POLLS, VICTORIA, auPartyColor } from '../../data/au';
import { Button, Countdown, Skeleton } from '../../components';
import { useWorldElections, daysUntil, relDays, fmtDate, TYPE_LABEL } from '../world/data';

const VIC_CLOSE = Date.parse(VICTORIA.pollsCloseUtc);
/** NZ general election: Sat 7 Nov 2026, polls close 7pm NZDT (UTC+13). */
export const NZ_CLOSE = Date.parse('2026-11-07T19:00:00+13:00');

export function AUHero() {
  const polls = AU_POLLS.victoria.filter((p) => p.tpp).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const avg = polls.length ? polls.reduce((s, p) => s + (p.tpp?.LNP ?? 0), 0) / polls.length : 0;
  return (
    <section className="hm-banner hm-hero2 is-au" aria-labelledby="hm-title">
      <div className="hm-banner__top">
        <span className="kicker kicker--accent">Australia · Victorian state election</span>
        <span className="kicker kicker--muted">Saturday 28 November 2026</span>
      </div>
      <h1 id="hm-title" className="hm-banner__title">Victoria votes in <Countdown to={VIC_CLOSE} compact doneLabel="— counting under way" /></h1>
      <p className="hm-banner__sub">
        {VICTORIA.totalSeats} Legislative Assembly seats, {VICTORIA.majority} for a majority. Labor's {VICTORIA.premier.name} faces the Coalition's {VICTORIA.opposition.name}.
      </p>
      {polls.length > 0 && (
        <div className="hm-tpp" aria-label={`Recent two-party preferred polls average: Coalition ${avg.toFixed(1)}, Labor ${(100 - avg).toFixed(1)}`}>
          <div className="row spread faint" style={{ fontSize: 12.5 }}>
            <span>Two-party preferred · avg of last {polls.length} polls</span>
          </div>
          <div className="hm-tpp__bar">
            <span style={{ width: `${100 - avg}%`, background: auPartyColor('ALP') }}><b>ALP {(100 - avg).toFixed(1)}</b></span>
            <span style={{ width: `${avg}%`, background: auPartyColor('LIB') }}><b>L/NP {avg.toFixed(1)}</b></span>
          </div>
          <ul className="hm-tpp__list">
            {polls.map((p) => (
              <li key={p.pollster + p.date}><span className="truncate">{p.pollster}</span><span className="num faint">{p.date.slice(5)}</span><b className="num">{p.tpp?.ALP}–{p.tpp?.LNP}</b></li>
            ))}
          </ul>
        </div>
      )}
      <div className="row row-wrap" style={{ gap: 10 }}>
        <Button variant="accent" size="lg" to="/au/victoria">Victoria hub →</Button>
        <Button variant="ghost" size="lg" to="/au/polls">All polls</Button>
        <Button variant="ghost" size="lg" to="/au/swingometer">Swingometer</Button>
      </div>
    </section>
  );
}

export function NZHero({ banner }: { banner?: ReactNode }) {
  const done = Date.now() > NZ_CLOSE;
  return (
    <section className="hm-banner hm-hero2 is-nz" aria-labelledby="hm-title">
      <div className="hm-banner__top">
        <span className="kicker kicker--accent">New Zealand · General election</span>
        <span className="kicker kicker--muted">Saturday 7 November 2026 · polls close 7pm NZDT</span>
      </div>
      <h1 id="hm-title" className="hm-banner__title">{done ? 'New Zealand has voted' : <>NZ election day: <Countdown to={NZ_CLOSE} compact doneLabel="counting" /></>}</h1>
      <p className="hm-banner__sub">120-seat MMP Parliament · 61 for a majority. Follow the party vote, electorates and coalition maths as the count comes in.</p>
      {banner}
      <div className="row row-wrap" style={{ gap: 10 }}>
        <Button variant="accent" size="lg" to="/nz">NZ election hub →</Button>
        <Button variant="ghost" size="lg" to="/world">World elections</Button>
      </div>
    </section>
  );
}

export function WorldHero() {
  const data = useWorldElections();
  const next = (data?.elections ?? [])
    .map((e) => ({ e, d: daysUntil(e.date) }))
    .filter((x) => x.d != null && x.d >= 0 && !x.e.dependent)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    .slice(0, 5);
  return (
    <section className="hm-banner hm-hero2 is-world" aria-labelledby="hm-title">
      <div className="hm-banner__top">
        <span className="kicker kicker--accent">World · National elections</span>
        {data && !data.live && <span className="kicker kicker--muted">Snapshot as of {data.asOf}</span>}
      </div>
      <h1 id="hm-title" className="hm-banner__title">The next five elections</h1>
      {!data ? (
        <Skeleton lines={5} height={22} />
      ) : (
        <ol className="hm-next5">
          {next.map(({ e, d }) => (
            <li key={e.id}>
              <span className="hm-next5__d num">{d === 0 ? 'Today' : `${d}d`}</span>
              <span className="stack" style={{ gap: 0, minWidth: 0 }}>
                <b className="truncate">{e.country}</b>
                <span className="faint truncate" style={{ fontSize: 12.5 }}>{e.office} · {TYPE_LABEL[e.type]} · {fmtDate(e)}</span>
              </span>
              <span className="faint" style={{ fontSize: 12 }}>{relDays(d)}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="row row-wrap" style={{ gap: 10 }}>
        <Button variant="accent" size="lg" to="/world">World calendar →</Button>
        <Link className="link" to="/calendar" style={{ alignSelf: 'center', fontSize: 14 }}>Key dates</Link>
      </div>
    </section>
  );
}
