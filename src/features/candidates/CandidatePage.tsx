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
import { fecUrl, usd } from '../money/data';
import { VIC_CANDIDATES } from '../../data/au';
import { AU_CANDS, type AuCand, fmtDate, useMoneyIndex, useProfile } from './profile';
import { Career, HeroPhoto, IdeologyMeter, QuickFacts, SourcesList, WikiBlurb } from './ProfileParts';
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
  const au = AU_CANDS.find((c) => c.id === id.toLowerCase());
  return au ? <AuCandidatePage c={au} /> : <UsCandidatePage id={id} />;
}

function AuCandidatePage({ c }: { c: AuCand }) {
  const prof = useProfile({ name: c.name, state: c.state, office: c.office, party: c.party, country: 'au' });
  const p = prof.data;
  useEffect(() => {
    document.title = `${c.name} · PolTok`;
  }, [c.name]);
  const today = new Date().toISOString().slice(0, 10);
  const extra = [
    { name: c.office === 'vic' ? 'Victorian Electoral Commission — 2026 nominations (as at ' + VIC_CANDIDATES.asAt + ')' : 'PolTok Australian research pack (AEC 2025 results)', url: c.office === 'vic' ? 'https://www.vec.vic.gov.au/voting/2026-state-election' : 'https://results.aec.gov.au/', retrieved: today },
  ];
  return (
    <div className="page cd-page">
      <nav className="cd-crumbs" aria-label="Breadcrumb">
        <Link to="/candidates?country=au">Candidates · Australia</Link> / <span>{c.seat}</span>
      </nav>
      <section className="cd-hero" style={{ ['--pc' as string]: c.color }}>
        <HeroPhoto name={c.name} color={c.color} profile={p} />
        <div className="cd-hero__info">
          <span className="kicker">{c.officeLabel} · {c.seat}</span>
          <h1>{c.name}</h1>
          <div className="cd-facts">
            <span className="cd-pill" style={{ borderColor: c.color }}>{c.partyLabel}</span>
            <span className="cd-pill">{c.incumbent ? 'Sitting member' : 'Candidate'}</span>
            {c.margin != null && <span className="cd-pill mono">Seat margin {c.margin.toFixed(1)} pts</span>}
          </div>
          {c.note && <p className="cd-muted">{c.note}</p>}
          <QuickFacts profile={p} />
          <div className="cd-actions">
            {c.memberKey && <Link className="rx-btn" to={`/member/${c.memberKey}`}>Member profile →</Link>}
            <Link className="rx-btn" to={c.office === 'vic' ? '/au/victoria' : '/au'}>{c.office === 'vic' ? 'Victoria 2026' : 'Australia'}</Link>
          </div>
        </div>
      </section>
      <div className="cd-cols">
        <section className="card rx-sec" aria-labelledby="cd-bio-h"><div className="rx-sec-head"><h3 id="cd-bio-h">Profile</h3></div><WikiBlurb profile={p} loading={prof.loading} name={c.name} /></section>
        <section className="card rx-sec" aria-labelledby="cd-car-h"><div className="rx-sec-head"><h3 id="cd-car-h">Offices held</h3></div>{prof.loading ? <p className="cd-muted">Loading…</p> : <Career profile={p} />}</section>
      </div>
      <SourcesList sources={p?.sources} extra={extra} generatedAt={p?.generatedAt} />
    </div>
  );
}

function UsCandidatePage({ id }: { id: string }) {
  const all = useCandidates();
  const live = useLive();
  const e = all.find((x) => x.cand.id === id.toLowerCase());
  const [copied, setCopied] = useState(false);
  const prof = useProfile(e ? { name: e.cand.name, state: e.race.state, office: e.race.chamber, party: e.cand.party } : null);
  const p = prof.data;
  const money = useMoneyIndex();

  useEffect(() => {
    if (e) document.title = `${e.cand.name} · PolTok`;
  }, [e]);

  const field = useMemo(() => (e ? all.filter((x) => x.race.id === e.race.id).sort((a, b) => b.votes - a.votes) : []), [all, e]);
  const news = useMemo(() => {
    if (!e) return { mine: [], state: [] };
    const st = stateByAbbr.get(e.race.state);
    const mine = candidateNews(live.news, e.cand, st?.name ?? e.race.state, 8);
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
  const mc = money.byId.get(cand.id);
  const today = new Date().toISOString().slice(0, 10);
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
        <HeroPhoto name={cand.name} color={PARTY_HEX[cand.party]} profile={p} fallback={cand.photo} />
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
          <QuickFacts profile={p} />
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
        <section className="card rx-sec" aria-labelledby="cd-bio-h">
          <div className="rx-sec-head"><h3 id="cd-bio-h">Profile</h3></div>
          <WikiBlurb profile={p} loading={prof.loading} name={cand.name} />
        </section>
        <section className="card rx-sec" aria-labelledby="cd-car-h">
          <div className="rx-sec-head"><h3 id="cd-car-h">Career &amp; offices held</h3></div>
          {prof.loading ? <p className="cd-muted">Loading…</p> : <Career profile={p} />}
        </section>
      </div>

      <div className="cd-cols">
        <section className="card rx-sec" aria-labelledby="cd-ideo-h">
          <div className="rx-sec-head"><h3 id="cd-ideo-h">Ideology · Voteview</h3></div>
          {prof.loading ? <p className="cd-muted">Loading…</p> : <IdeologyMeter profile={p} />}
          {p?.congress?.committees.length ? (
            <>
              <h4 className="cd-subh">Committees</h4>
              <ul className="cd-list">
                {p.congress.committees.filter((c) => !c.sub).map((c) => (
                  <li key={c.code}>{c.name}{c.title ? <span className="cd-muted"> · {c.title}</span> : null}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section className="card rx-sec" aria-labelledby="cd-money-h">
          <div className="rx-sec-head"><h3 id="cd-money-h">Money · FEC 2026 cycle</h3></div>
          {mc?.fecId ? (
            <>
              <dl className="cd-qf cd-qf--3">
                <div><dt>Raised</dt><dd className="mono">{usd(mc.receipts)}</dd></div>
                <div><dt>Spent</dt><dd className="mono">{usd(mc.disbursements)}</dd></div>
                <div><dt>Cash on hand</dt><dd className="mono">{usd(mc.cash)}</dd></div>
                <div><dt>From individuals</dt><dd className="mono">{usd(mc.indiv)}</dd></div>
                <div><dt>Outside $ for</dt><dd className="mono">{usd(mc.ieSupport)}</dd></div>
                <div><dt>Outside $ against</dt><dd className="mono">{usd(mc.ieOppose)}</dd></div>
              </dl>
              <p className="cd-muted cd-src">
                Coverage through {fmtDate(mc.coverageEnd?.slice(0, 10)) || 'latest filing'} · <a href={fecUrl(mc.fecId)} target="_blank" rel="noopener noreferrer">FEC filing {mc.fecId}</a> ·{' '}
                <Link to={`/money`}>All race money</Link>
              </p>
            </>
          ) : race.chamber === 'governor' ? (
            <p className="cd-muted">Governor campaigns file with the state, not the FEC — no federal totals.</p>
          ) : (
            <p className="cd-muted">{money.summary ? 'No FEC candidate committee matched for this candidate.' : 'Loading FEC totals…'}</p>
          )}
        </section>
      </div>

      {p?.congress?.votes.length ? (
        <section className="card rx-sec" aria-labelledby="cd-votes-h">
          <div className="rx-sec-head"><h3 id="cd-votes-h">Recent roll-call votes</h3><span className="cd-muted">Voteview · 119th Congress</span></div>
          <ul className="cd-votes">
            {p.congress.votes.map((v) => (
              <li key={`${v.chamber}-${v.roll}`}>
                <span className={`cd-vote cd-vote--${v.vote}`}>{{ Y: 'Yea', N: 'Nay', P: 'Present', X: 'Missed' }[v.vote]}</span>
                <span>
                  <b>{v.bill || `Roll ${v.roll}`}</b> {v.description || v.question}
                  <span className="cd-muted"> · {fmtDate(v.date)}{v.result ? ` · ${v.result}` : ''}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="cd-muted cd-src"><Link to={`/member/${p.congress.bioguide}`}>Full voting record →</Link></p>
        </section>
      ) : null}

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

      <SourcesList
        sources={p?.sources}
        generatedAt={p?.generatedAt}
        extra={[
          { name: 'Candidate list, results & headshots — AP (via The New York Times feed)', url: 'https://www.ap.org/elections/', retrieved: today },
          ...(mc?.fecId ? [{ name: `Federal Election Commission — ${mc.fecName ?? mc.fecId}`, url: fecUrl(mc.fecId), retrieved: money.summary ? new Date(money.summary.generatedAt).toISOString().slice(0, 10) : undefined }] : []),
          ...(p?.ballotpedia ? [{ name: `Ballotpedia — ${cand.name} (link only)`, url: p.ballotpedia }] : []),
          { name: 'Race ratings — Cook Political Report (2024 results & polls: PolTok research pack)', url: 'https://www.cookpolitical.com/ratings' },
        ]}
      />
    </div>
  );
}
