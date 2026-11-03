import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Race, RaceResult } from '../../types';
import { racesByState, stateByAbbr } from '../../data';
import { useLive } from '../../lib/live';
import { SimBadge } from '../../components';
import { marginColor, PARTY_HEX, RATING_HEX } from '../../lib/format';
import { USMap } from '../map/USMap';
import { NewsList, NotFound, PresBar, RaceCard, ShareButton } from './parts';
import { fmtCloseET, fmtSignedMargin, leaderOf, nearbyStates, presMargin, relatedNews, sortRacesForState, sortedStates } from './util';
import './races.css';

export default function StatePage() {
  const { abbr = '' } = useParams();
  const navigate = useNavigate();
  const st = stateByAbbr.get(abbr.toUpperCase());
  const live = useLive();
  const races = useMemo(() => (st ? sortRacesForState(racesByState(st.abbr)) : []), [st]);
  const news = useMemo(() => relatedNews(live.news, st, races, 10), [live.news, st, races]);

  useEffect(() => {
    if (st) document.title = `${st.name} · PolTok`;
  }, [st]);

  if (!st) return <NotFound kind="state" query={abbr} />;

  const statewide = races.filter((r) => r.chamber !== 'house');
  const house = races.filter((r) => r.chamber === 'house');
  const all = sortedStates();
  const idx = all.findIndex((s) => s.abbr === st.abbr);
  const prev = all[(idx - 1 + all.length) % all.length];
  const next = all[(idx + 1) % all.length];
  const near = nearbyStates(st);
  const m = presMargin(st);
  const called = races.filter((r) => live.results[r.id]?.calledFor).length;

  return (
    <div className="page rx-page">
      <nav className="rx-crumbs" aria-label="Breadcrumb">
        <Link to="/races">Races</Link>
        <span aria-hidden>/</span>
        <span aria-current="page">{st.name}</span>
      </nav>

      <motion.section
        className="rx-state-hero"
        style={{ ['--glow' as string]: m >= 0 ? PARTY_HEX.D : PARTY_HEX.R }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <span className="rx-hero-abbr" aria-hidden>
          {st.abbr}
        </span>
        <div className="rx-state-info">
          <span className="rx-eyebrow">State hub · Election Day 2026</span>
          <h1 className="rx-h1">{st.name}</h1>
          <dl className="rx-facts rx-facts-lg">
            <div>
              <dt>Electoral votes</dt>
              <dd className="mono">{st.ev}</dd>
            </div>
            <div>
              <dt>House seats</dt>
              <dd className="mono">{st.houseSeats}</dd>
            </div>
            <div>
              <dt>Polls close</dt>
              <dd className="mono">{fmtCloseET(st.pollClose)}</dd>
            </div>
            <div>
              <dt>Races tonight</dt>
              <dd className="mono">
                {races.length}
                {called > 0 && <small> · {called} called</small>}
              </dd>
            </div>
          </dl>
          <PresBar st={st} />
          <div className="rx-inline" style={{ marginTop: 12 }}>
            <SimBadge />
            <ShareButton title={`${st.name} election hub`} />
          </div>
        </div>
        <div className="rx-state-map">
          <USMap
            fills={{ [st.abbr]: marginColor(m) }}
            focus={[st.abbr, ...near.map((n) => n.abbr)]}
            highlight={[st.abbr]}
            selected={st.abbr}
            labels
            onStateClick={(a) => navigate(`/state/${a}`)}
            title={`Map highlighting ${st.name}`}
            describe={(a) => (a === st.abbr ? `current state, 2024 ${fmtSignedMargin(m)}` : 'open state hub')}
          />
        </div>
      </motion.section>

      {races.length === 0 ? (
        <div className="card rx-empty">
          <h3>No tracked races in {st.name} yet</h3>
          <p className="rx-muted">Race data is still loading, or {st.name} has no Senate or governor race on the 2026 ballot that we track.</p>
        </div>
      ) : (
        <>
          {statewide.length > 0 && (
            <section className="rx-sec" aria-labelledby="rx-sw-h">
              <h2 id="rx-sw-h" className="rx-sec-title">
                Statewide races
              </h2>
              <div className="rx-cards">
                {statewide.map((r) => (
                  <RaceCard key={r.id} race={r} result={live.results[r.id]} />
                ))}
              </div>
            </section>
          )}

          {house.length > 0 && (
            <section className="rx-sec" aria-labelledby="rx-house-h">
              <h2 id="rx-house-h" className="rx-sec-title">
                House delegation <span className="rx-muted mono">· {st.houseSeats} seats</span>
              </h2>
              <SeatStrip races={house} seats={st.houseSeats} results={live.results} />
              <div className="rx-cards">
                {house.map((r) => (
                  <RaceCard key={r.id} race={r} result={live.results[r.id]} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="card rx-sec" aria-labelledby="rx-snews-h">
        <header className="rx-sec-head">
          <h3 id="rx-snews-h">{st.name} in the news</h3>
          <span className="rx-muted rx-small">Real headlines · opens source</span>
        </header>
        <NewsList items={news} empty={`No headlines about ${st.name} in the feed right now.`} />
      </section>

      <nav className="rx-statenav" aria-label="Other states">
        <Link to={`/state/${prev.abbr}`} className="rx-btn">
          ← {prev.name}
        </Link>
        {near.length > 0 && (
          <div className="rx-near">
            <span className="rx-muted rx-small">Nearby</span>
            {near.map((n) => (
              <Link key={n.abbr} to={`/state/${n.abbr}`} className="rx-near-chip mono" style={{ ['--pc' as string]: marginColor(presMargin(n)) }} title={n.name}>
                {n.abbr}
              </Link>
            ))}
          </div>
        )}
        <Link to={`/state/${next.abbr}`} className="rx-btn">
          {next.name} →
        </Link>
      </nav>
    </div>
  );
}

function SeatStrip({ races, seats, results }: { races: Race[]; seats: number; results: Record<string, RaceResult> }) {
  const byDistrict = new Map(races.map((r) => [r.district ?? 0, r]));
  const n = Math.max(seats, races.length);
  const slots = Array.from({ length: n }, (_, i) => (seats === 1 ? 0 : i + 1));
  let d = 0;
  let r = 0;
  for (const race of races) {
    const p = leaderOf(race, results[race.id])?.cand.party;
    if (p === 'D' || p === 'I') d++;
    else if (p === 'R') r++;
  }
  return (
    <div className="rx-strip-wrap">
      <div className="rx-strip" role="list" aria-label="House delegation by district">
        {slots.map((dist) => {
          const race = byDistrict.get(dist);
          if (!race)
            return (
              <span key={dist} role="listitem" className="rx-seat-cell is-untracked" title={`District ${dist}: not tracked`}>
                <small className="mono">{dist || 'AL'}</small>
              </span>
            );
          const res = results[race.id];
          const lead = leaderOf(race, res);
          const color = lead ? PARTY_HEX[lead.cand.party] : RATING_HEX[race.rating];
          return (
            <Link
              key={dist}
              role="listitem"
              to={`/race/${race.id}`}
              className={`rx-seat-cell ${lead?.called ? 'is-called' : lead ? 'is-leading' : 'is-rating'}`}
              style={{ ['--pc' as string]: color }}
              title={`${race.id}: ${lead ? `${lead.called ? 'called' : 'leading'} ${lead.cand.name} (${lead.cand.party})` : race.rating}`}
              aria-label={`${race.id}, ${lead ? `${lead.called ? 'called for' : 'leading:'} ${lead.cand.name}` : `rated ${race.rating}`}`}
            >
              <small className="mono">{dist || 'AL'}</small>
              {lead?.called && <span aria-hidden>✓</span>}
            </Link>
          );
        })}
      </div>
      <div className="rx-strip-legend mono">
        {d + r > 0 ? (
          <>
            <span style={{ color: 'var(--dem)' }}>D {d}</span> · <span style={{ color: 'var(--rep)' }}>R {r}</span> leading or won
          </>
        ) : (
          <span className="rx-muted">Colored by pre-election rating until votes arrive</span>
        )}
      </div>
    </div>
  );
}
