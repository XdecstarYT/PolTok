import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, RatingBadge, SimBadge } from '../../components';
import { pollSeriesById, stateByAbbr } from '../../data';
import { useLive } from '../../lib/live';
import { fmtInt, PARTY_HEX, PARTY_NAME, timeAgo } from '../../lib/format';
import { NewsList, PollPanel, PresBar } from '../races/parts';
import { demMargin, relatedNews, statusText } from '../races/util';
import { type CandEntry, candidateNews, officeLabel, useCandidates } from './data';
import { OutcomeTag } from './CandidatesIndex';
import '../races/races.css';
import './candidates.css';

const signed = (m?: number) => (m === undefined ? '—' : `${m >= 0 ? '+' : '−'}${Math.abs(m).toFixed(1)} pts`);

function FaceCard({ e, me }: { e: CandEntry; me?: boolean }) {
  return (
    <Link to={`/candidate/${e.cand.id}`} className={`cd-face ${me ? 'is-me' : ''}`} style={{ ['--pc' as string]: PARTY_HEX[e.cand.party] }} aria-current={me ? 'page' : undefined}>
      <Avatar name={e.cand.name} party={e.cand.party} src={e.cand.photo} size={72} />
      <b>{e.cand.name}</b>
      <span className="cd-muted">
        {PARTY_NAME[e.cand.party]}
        {e.cand.incumbent ? ' · Incumbent' : ''}
      </span>
      <span className="cd-face__pct mono">{e.pct !== undefined ? `${e.pct.toFixed(1)}%` : '—'}</span>
      <span className="cd-muted mono">{e.votes > 0 ? `${fmtInt(e.votes)} votes` : 'no votes counted'}</span>
      <OutcomeTag e={e} />
    </Link>
  );
}

export default function CandidatePage() {
  const { id = '' } = useParams();
  const all = useCandidates();
  const live = useLive();
  const e = all.find((x) => x.cand.id === id.toLowerCase());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (e) document.title = `${e.cand.name} · PolTok`;
  }, [e]);

  const field = useMemo(() => (e ? all.filter((x) => x.race.id === e.race.id).sort((a, b) => b.votes - a.votes) : []), [all, e]);
  const news = useMemo(() => {
    if (!e) return { mine: [], state: [] };
    const mine = candidateNews(live.news, e.cand, 8);
    const st = stateByAbbr.get(e.race.state);
    const state = mine.length >= 3 ? [] : relatedNews(live.news, st, [e.race], 6).filter((n) => !mine.includes(n));
    return { mine, state };
  }, [live.news, e]);

  if (!e) {
    const loading = live.mode === 'connecting';
    return (
      <div className="page cd-page">
        <h1>{loading ? 'Loading candidate…' : 'Candidate not found'}</h1>
        {!loading && (
          <p className="cd-muted">
            No candidate with id <code>{id}</code>. <Link to={`/candidates?q=${encodeURIComponent(id.split('-')[0] ?? '')}`}>Browse all candidates</Link>.
          </p>
        )}
      </div>
    );
  }

  const { cand, race, result } = e;
  const st = stateByAbbr.get(race.state);
  const polls = pollSeriesById.get(race.id);
  const opponents = field.filter((x) => x.cand.id !== cand.id);
  const counted = (result?.votes && Object.values(result.votes).some((v) => v > 0)) ?? false;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `${cand.name} (${cand.party}) — ${race.title}${e.outcome === 'won' ? ': projected winner' : ''}`;

  const share = async () => {
    try {
      if (navigator.share) return void (await navigator.share({ title: shareText, url: shareUrl }));
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="page cd-page">
      <nav className="cd-crumbs" aria-label="Breadcrumb">
        <Link to="/candidates">Candidates</Link> / <Link to={`/race/${race.id}`}>{race.title}</Link>
      </nav>

      <section className={`cd-hero cd-card--${e.outcome}`} style={{ ['--pc' as string]: PARTY_HEX[cand.party] }}>
        <div className="cd-hero__photo">
          <Avatar name={cand.name} party={cand.party} src={cand.photo} size={160} />
        </div>
        <div className="cd-hero__info">
          <span className="kicker">{officeLabel(race)} · {st?.name ?? race.state}</span>
          <h1>{cand.name}</h1>
          <div className="cd-facts">
            <span className="cd-pill" style={{ borderColor: PARTY_HEX[cand.party] }}>
              {e.meta?.partyName ?? PARTY_NAME[cand.party]}
            </span>
            {cand.incumbent ? <span className="cd-pill">Incumbent</span> : race.open ? <span className="cd-pill">Open seat</span> : <span className="cd-pill">Challenger</span>}
            <RatingBadge rating={race.rating} />
            <SimBadge />
          </div>
          <div className="cd-result" role="status" aria-live="polite">
            <OutcomeTag e={e} />
            <dl>
              <div>
                <dt>Vote share</dt>
                <dd className="mono">{e.pct !== undefined ? `${e.pct.toFixed(1)}%` : '—'}</dd>
              </div>
              <div>
                <dt>Margin vs. top opponent</dt>
                <dd className="mono">{signed(e.margin)}</dd>
              </div>
              <div>
                <dt>Votes</dt>
                <dd className="mono">{e.votes > 0 ? fmtInt(e.votes) : '—'}</dd>
              </div>
              <div>
                <dt>Expected vote in</dt>
                <dd className="mono">{result ? `${Math.round(result.expectedPct)}%` : '—'}</dd>
              </div>
            </dl>
            <span className="cd-muted">
              {statusText(result, st)}
              {result?.calledAt && result.calledFor ? ` · called ${timeAgo(result.calledAt)}` : ''}
              {result?.updatedAt ? ` · updated ${timeAgo(result.updatedAt)}` : ''}
            </span>
          </div>
          <div className="cd-actions">
            <Link className="rx-btn" to={`/race/${race.id}#rx-county-h`}>
              County map &amp; full race →
            </Link>
            {st && (
              <Link className="rx-btn" to={`/state/${st.abbr}`}>
                {st.name} overview
              </Link>
            )}
            <button className="rx-btn" type="button" onClick={share} aria-label={`Share ${cand.name}`}>
              {copied ? 'Link copied' : 'Share'}
            </button>
          </div>
        </div>
      </section>

      {opponents.length > 0 && (
        <section className="card rx-sec" aria-labelledby="cd-vs-h">
          <div className="rx-sec-head">
            <h3 id="cd-vs-h">Face-off</h3>
            <span className="cd-muted">{counted ? 'Sorted by votes counted' : 'Before votes are counted'}</span>
          </div>
          <div className="cd-faceoff">
            {field.slice(0, 4).map((x, i) => (
              <div key={x.cand.id} className="cd-faceoff__slot">
                {i > 0 && <span className="cd-vs" aria-hidden>VS</span>}
                <FaceCard e={x} me={x.cand.id === cand.id} />
              </div>
            ))}
          </div>
          {counted && (
            <div className="cd-bar" aria-hidden>
              {field.map((x) => (
                <span key={x.cand.id} style={{ width: `${x.pct ?? 0}%`, background: PARTY_HEX[x.cand.party] }} />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="cd-cols">
        {st && (
          <section className="card rx-sec" aria-labelledby="cd-pres-h">
            <div className="rx-sec-head">
              <h3 id="cd-pres-h">{race.chamber === 'house' ? 'Statewide 2024 presidential vote' : '2024 presidential context'}</h3>
            </div>
            <PresBar st={st} current={race.chamber === 'house' ? undefined : demMargin(race, result)} />
            {race.chamber === 'house' && <p className="cd-muted">District-level 2024 results not on file; statewide result shown.</p>}
          </section>
        )}
        <section className="card rx-sec" aria-labelledby="cd-polls-h">
          <div className="rx-sec-head">
            <h3 id="cd-polls-h">Polls · {race.title}</h3>
          </div>
          {polls ? <PollPanel series={polls} /> : <p className="cd-muted">No public polls on file for this race.</p>}
        </section>
      </div>

      <section className="card rx-sec" aria-labelledby="cd-news-h">
        <div className="rx-sec-head">
          <h3 id="cd-news-h">In the news</h3>
        </div>
        <NewsList items={news.mine} empty={`No headlines naming ${cand.name} in the current feed.`} />
        {news.state.length > 0 && (
          <>
            <h4 className="cd-subh">More from {st?.name ?? race.state}</h4>
            <NewsList items={news.state} empty="" />
          </>
        )}
      </section>

      <p className="cd-muted cd-src">
        Sources: candidate names, incumbency and headshots from AP via The New York Times where available; ratings from Cook Political Report; 2024 results and polls from the
        PolTok research pack. No biographical details are shown unless backed by data.
      </p>
    </div>
  );
}
