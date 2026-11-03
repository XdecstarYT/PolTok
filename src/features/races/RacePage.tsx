import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { POLL_SERIES, RACES, raceById, racesByState, stateByAbbr } from '../../data';
import { useLive } from '../../lib/live';
import { Avatar, RatingBadge, SimBadge } from '../../components';
import { PARTY_HEX, PARTY_NAME, RATING_HEX } from '../../lib/format';
import { USMap } from '../map/USMap';
import { CallBanner, ExpectedMeter, NewsList, Needle, NotFound, PollPanel, PresBar, RaceCard, ResultRows, ShareButton, AnimatedNum } from './parts';
import { demMargin, fmtCloseET, headlinePair, longTitle, relatedNews, sortRacesForState, totalVotes } from './util';
import './races.css';

export default function RacePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const race = raceById.get(id) ?? raceById.get(id.toUpperCase()) ?? RACES.find((r) => r.id.toLowerCase() === id.toLowerCase());
  const live = useLive();

  useEffect(() => {
    if (race) document.title = `${longTitle(race)} · PolTok`;
  }, [race]);

  const st = race ? stateByAbbr.get(race.state) : undefined;
  const stateRaces = useMemo(() => (race ? sortRacesForState(racesByState(race.state)) : []), [race]);
  const news = useMemo(() => relatedNews(live.news, st, stateRaces, 8), [live.news, st, stateRaces]);

  if (!race) return <NotFound kind="race" query={id} />;

  const result = live.results[race.id];
  const [a, b] = headlinePair(race);
  const ca = a ? PARTY_HEX[a.party] : PARTY_HEX.O;
  const cb = b ? PARTY_HEX[b.party] : PARTY_HEX.O;
  const pa = a ? result?.winProb?.[a.id] : undefined;
  const pb = b ? result?.winProb?.[b.id] : undefined;
  const right = pa !== undefined || pb !== undefined ? (pb ?? 0) / ((pa ?? 0) + (pb ?? 0) || 1) : undefined;
  const series = POLL_SERIES.find((p) => p.id === race.id);
  const others = stateRaces.filter((r) => r.id !== race.id);
  const margin = demMargin(race, result);
  const total = totalVotes(result);
  const chamberLabel = race.chamber === 'house' ? 'U.S. House' : race.chamber === 'senate' ? (race.special ? 'U.S. Senate · Special' : 'U.S. Senate') : 'Governor';
  const winnerId = result?.calledFor;

  return (
    <div className="page rx-page">
      <nav className="rx-crumbs" aria-label="Breadcrumb">
        <Link to="/races">Races</Link>
        <span aria-hidden>/</span>
        {st ? <Link to={`/state/${st.abbr}`}>{st.name}</Link> : <span>{race.state}</span>}
        <span aria-hidden>/</span>
        <span aria-current="page" className="mono">
          {race.id}
        </span>
      </nav>

      {/* ---------- HERO ---------- */}
      <motion.section
        className="rx-hero"
        style={{ ['--ca' as string]: ca, ['--cb' as string]: cb, ['--rc' as string]: RATING_HEX[race.rating] }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <div className="rx-hero-bg" aria-hidden>
          <span className="rx-hero-abbr">{race.state}</span>
        </div>
        <div className="rx-hero-top">
          <div>
            <span className="rx-eyebrow">
              {chamberLabel}
              {race.open ? ' · Open seat' : ''}
              {race.key ? ' · Key race' : ''}
            </span>
            <h1 className="rx-h1">{longTitle(race)}</h1>
          </div>
          <div className="rx-hero-actions">
            <RatingBadge rating={race.rating} />
            <SimBadge />
            <ShareButton title={longTitle(race)} />
          </div>
        </div>

        <div className="rx-faceoff">
          {[a, b].map((c, i) =>
            c ? (
              <motion.div
                key={c.id}
                className={`rx-fighter ${i === 1 ? 'is-right' : ''} ${winnerId === c.id ? 'is-winner' : winnerId ? 'is-loser' : ''}`}
                style={{ ['--pc' as string]: PARTY_HEX[c.party] }}
                initial={{ opacity: 0, x: i === 0 ? -30 : 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 120, damping: 18 }}
              >
                <div className="rx-fighter-av">
                  <Avatar name={c.name} party={c.party} src={c.photo} size={112} />
                  {winnerId === c.id && <span className="rx-fighter-check">✓</span>}
                </div>
                <div className="rx-fighter-txt">
                  <span className="rx-party" style={{ color: PARTY_HEX[c.party] }}>
                    {PARTY_NAME[c.party]}
                  </span>
                  <h2>{c.name}</h2>
                  {c.incumbent && <span className="rx-inc">Incumbent</span>}
                  {c.bio && <p className="rx-bio">{c.bio}</p>}
                  {result && total > 0 && (
                    <b className="rx-fighter-pct mono">
                      <AnimatedNum value={(result.votes[c.id] ?? 0) / total * 100} format={(n) => `${n.toFixed(1)}%`} />
                    </b>
                  )}
                </div>
              </motion.div>
            ) : (
              <div key={i} className={`rx-fighter ${i === 1 ? 'is-right' : ''}`}>
                <div className="rx-fighter-txt">
                  <span className="rx-party">Candidate</span>
                  <h2>TBD</h2>
                </div>
              </div>
            ),
          )}
          <div className="rx-vs" aria-hidden>
            VS
          </div>
        </div>
        {race.notes && <p className="rx-notes">{race.notes}</p>}
      </motion.section>

      <CallBanner race={race} result={result} />

      <div className="rx-grid">
        <div className="rx-main">
          {/* ---------- LIVE RESULTS ---------- */}
          <section className="card rx-sec" aria-labelledby="rx-results-h">
            <header className="rx-sec-head">
              <h3 id="rx-results-h">Live results</h3>
              <span className="rx-inline">
                {total > 0 && (
                  <span className="mono rx-muted">
                    <AnimatedNum value={total} /> votes
                  </span>
                )}
                <SimBadge />
              </span>
            </header>
            <ResultRows race={race} result={result} big />
            <ExpectedMeter pct={result?.expectedPct ?? 0} />
            {!result && <p className="rx-muted rx-small">Waiting for the results feed{st ? ` — polls close ${fmtCloseET(st.pollClose)}` : ''}.</p>}
          </section>

          {/* ---------- NEEDLE ---------- */}
          <section className="card rx-sec" aria-labelledby="rx-needle-h">
            <header className="rx-sec-head">
              <h3 id="rx-needle-h">Win probability</h3>
              <SimBadge />
            </header>
            <Needle right={right} leftLabel={a?.name ?? 'TBD'} rightLabel={b?.name ?? 'TBD'} leftColor={ca} rightColor={cb} jitter={!winnerId && result?.status === 'counting'} />
          </section>

          {/* ---------- POLLS ---------- */}
          <section className="card rx-sec" aria-labelledby="rx-polls-h">
            <header className="rx-sec-head">
              <h3 id="rx-polls-h">Polls</h3>
              {series && <span className="rx-muted rx-small">{series.polls?.length ?? 0} polls</span>}
            </header>
            {series ? <PollPanel series={series} /> : <p className="rx-muted">No public polling on file for this race.</p>}
          </section>

          {/* ---------- NEWS ---------- */}
          <section className="card rx-sec" aria-labelledby="rx-news-h">
            <header className="rx-sec-head">
              <h3 id="rx-news-h">Related coverage</h3>
              <span className="rx-muted rx-small">Real headlines · opens source</span>
            </header>
            <NewsList items={news} empty={`No headlines mentioning ${st?.name ?? race.state} or the candidates in the feed yet.`} />
          </section>
        </div>

        <aside className="rx-side">
          <section className="card rx-sec rx-mapcard">
            <header className="rx-sec-head">
              <h3>{st?.name ?? race.state}</h3>
              {st && (
                <Link to={`/state/${st.abbr}`} className="rx-link">
                  State hub →
                </Link>
              )}
            </header>
            <USMap
              fills={{ [race.state]: margin !== undefined ? (margin >= 0 ? PARTY_HEX.D : PARTY_HEX.R) : RATING_HEX[race.rating] }}
              focus={[race.state]}
              highlight={[race.state]}
              selected={race.state}
              labels={false}
              onStateClick={(abbr) => navigate(`/state/${abbr}`)}
              title={`Map highlighting ${st?.name ?? race.state}`}
            />
            {st && <PresBar st={st} current={margin} />}
            {st && (
              <dl className="rx-facts">
                <div>
                  <dt>Polls close</dt>
                  <dd className="mono">{fmtCloseET(st.pollClose)}</dd>
                </div>
                <div>
                  <dt>Electoral votes</dt>
                  <dd className="mono">{st.ev}</dd>
                </div>
                <div>
                  <dt>House seats</dt>
                  <dd className="mono">{st.houseSeats}</dd>
                </div>
              </dl>
            )}
          </section>

          {others.length > 0 && (
            <section className="rx-sec rx-others" aria-labelledby="rx-others-h">
              <h3 id="rx-others-h" className="rx-sec-title">
                Also on the {race.state} ballot
              </h3>
              <div className="rx-stack">
                {others.slice(0, 8).map((r) => (
                  <RaceCard key={r.id} race={r} result={live.results[r.id]} />
                ))}
                {others.length > 8 && st && (
                  <Link to={`/state/${st.abbr}`} className="rx-btn">
                    All {others.length + 1} {st.name} races →
                  </Link>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
