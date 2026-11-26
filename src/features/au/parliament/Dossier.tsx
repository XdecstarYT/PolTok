/** The full person page sections ("dossier"): who they are, their position, what they stand for (their party's own
 *  commitments + where they stand on headline issues), and voting record. Sourced only:
 *  biographies from Wikidata (CC0) + Wikipedia (CC BY-SA, credited); policies summarised in PolTok's own words from the ABC
 *  News Victorian election policy tracker; candidate details from the VEC. Nothing is inferred about an individual. */
import { useState, type CSSProperties } from 'react';
import PEOPLE from '../../../data/vic-people.json';
import POLICIES from '../../../data/vic-policies.json';
import { VIC_NAME, vicColor } from '../vicLive';
import type { Person } from './people';
import './profile.css';

type Bio = { qid: string; desc: string | null; wiki: string | null; summary: string | null; born: number | null; positions: { label: string; from: number | null; to: number | null }[]; education: string[]; occupations: string[]; parties: string[] };
type Stance = { stance: 'for' | 'against' | 'mixed' | 'unclear'; note: string };
const people = (PEOPLE as unknown as { people: Record<string, Bio> }).people;
const P = POLICIES as unknown as { source: { name: string; url: string; asAt: string }; topics: { id: string; label: string; emoji: string; parties: Record<string, string[]> }[]; stances: { id: string; issue: string; positions: Record<string, Stance> }[] };
const MAJORS = ['ALP', 'LNP', 'GRN', 'ONP'];
const STANCE_LABEL = { for: 'For', against: 'Against', mixed: 'Mixed', unclear: 'No clear position' } as const;
export const bioOf = (p: Person): Bio | null => people[`${p.seatId}|${p.name}`] ?? null;

export function Dossier({ p, rivals }: { p: Person; rivals: Person[] }) {
  const bio = bioOf(p);
  const major = MAJORS.includes(p.bucket);
  const [topic, setTopic] = useState(P.topics[0]?.id);
  const t = P.topics.find((x) => x.id === topic);
  const current = bio?.positions.filter((x) => !x.to) ?? [];
  const rivalParties = [...new Set(rivals.map((r) => r.bucket).filter((b) => MAJORS.includes(b) && b !== p.bucket))];
  const c = vicColor(p.bucket);
  return (
    <div className="ds" style={{ ['--c' as string]: c } as CSSProperties}>
      {/* WHO THEY ARE */}
      <section className="ds__sec lg">
        <h3 className="ds__h"><span>01</span>Who they are</h3>
        {bio?.summary ? (
          <>
            <p className="ds__lead">{bio.summary}</p>
            <dl className="ds__facts">
              {bio.born && <div><dt>Born</dt><dd>{bio.born} <small className="faint">(age about {2026 - bio.born})</small></dd></div>}
              {bio.occupations.length > 0 && <div><dt>Background</dt><dd>{bio.occupations.join(', ')}</dd></div>}
              {bio.education.length > 0 && <div><dt>Education</dt><dd>{bio.education.join(', ')}</dd></div>}
              {bio.parties.length > 0 && <div><dt>Party membership</dt><dd>{bio.parties.join(', ')}</dd></div>}
            </dl>
            <p className="ds__src">Biography: <a href={bio.wiki ?? `https://www.wikidata.org/wiki/${bio.qid}`} target="_blank" rel="noreferrer">Wikipedia</a> (CC BY-SA 4.0) and <a href={`https://www.wikidata.org/wiki/${bio.qid}`} target="_blank" rel="noreferrer">Wikidata</a>.</p>
          </>
        ) : (
          <p className="ds__lead">{p.name} is the {p.partyName === 'Independent' ? 'independent' : `${p.partyName}`} candidate for {p.seatName}, listed at position {p.ballot ?? '—'} on the ballot paper. PolTok couldn't find a verified public biography for this candidate, so we don't show one rather than guess. Their party's commitments are below{major ? '' : ' where available'}.</p>
        )}
      </section>

      {/* THEIR POSITION */}
      <section className="ds__sec lg">
        <h3 className="ds__h"><span>02</span>Their position</h3>
        <div className="ds__pos">
          <div className="ds__poscard"><small>On Saturday's ballot</small><b>Candidate for {p.seatName}</b><span>{p.partyName} · ballot #{p.ballot ?? '—'}</span></div>
          <div className="ds__poscard"><small>Status</small><b>{p.sitting ? `Sitting MP for ${p.seatName}` : 'Challenger'}</b><span>{p.leader ?? (p.sitting ? 'Defending the seat' : 'Not the current member')}</span></div>
          {current.map((x) => <div key={x.label} className="ds__poscard"><small>Current role</small><b>{x.label}</b><span>since {x.from ?? '—'}</span></div>)}
        </div>
        {bio && bio.positions.length > current.length && (
          <ol className="ds__timeline">
            {bio.positions.map((x, i) => <li key={x.label + i}><span className="num">{x.from ?? '?'}–{x.to ?? 'now'}</span><b>{x.label}</b></li>)}
          </ol>
        )}
      </section>

      {/* WHAT THEY STAND FOR */}
      <section className="ds__sec lg">
        <h3 className="ds__h"><span>03</span>What they stand for</h3>
        {major ? (
          <>
            <p className="ds__note">As a {VIC_NAME[p.bucket]} candidate, {p.name.split(' ')[0]} is standing on {p.bucket === 'LNP' ? 'the Liberal–National Coalition' : `the ${VIC_NAME[p.bucket]}`} platform. These are that party's own election commitments, summarised by PolTok.</p>
            <h4 className="ds__h4">Where they stand on the big issues</h4>
            <div className="ds__stances" role="table" aria-label="Positions on headline issues">
              <div className="ds__srow ds__srow--head" role="row"><span role="columnheader">Issue</span><span role="columnheader" style={{ color: c }}>{VIC_NAME[p.bucket]}</span>{rivalParties.map((r) => <span key={r} role="columnheader" style={{ color: vicColor(r) }}>{VIC_NAME[r]}</span>)}</div>
              {P.stances.filter((s) => s.positions[p.bucket]?.stance !== 'unclear').map((s) => (
                <div key={s.id} className="ds__srow" role="row">
                  <span role="cell" className="ds__issue">{s.issue}</span>
                  <span role="cell"><em className={`st st--${s.positions[p.bucket].stance}`}>{STANCE_LABEL[s.positions[p.bucket].stance]}</em><small>{s.positions[p.bucket].note}</small></span>
                  {rivalParties.map((r) => { const x = s.positions[r]; return <span key={r} role="cell">{x ? <em className={`st st--${x.stance}`}>{STANCE_LABEL[x.stance]}</em> : '—'}</span>; })}
                </div>
              ))}
            </div>
            <h4 className="ds__h4">Their party's promises, by topic</h4>
            <div className="ds__tabs" role="tablist">{P.topics.map((x) => <button key={x.id} role="tab" type="button" aria-selected={x.id === topic} onClick={() => setTopic(x.id)}>{x.emoji} {x.label}</button>)}</div>
            {t && (
              <ul className="ds__policies">{(t.parties[p.bucket] ?? []).map((b) => <li key={b}>{b}</li>)}{!(t.parties[p.bucket] ?? []).length && <li className="faint">No commitments listed on this topic.</li>}</ul>
            )}
            <p className="ds__src">Summarised in PolTok's own words from the <a href={P.source.url} target="_blank" rel="noreferrer">{P.source.name}</a> (as at {P.source.asAt}). A party platform, not a personal statement from the candidate.</p>
          </>
        ) : (
          <p className="ds__note">{p.partyName === 'Independent' ? 'Independents set their own platforms.' : `${p.partyName} isn't covered by the ABC's major-party policy tracker.`} PolTok only shows policies from published, sourced trackers, so check {p.name.split(' ')[0]}'s own materials and how-to-vote card (the <a href="https://www.vec.vic.gov.au/voting/2026-state-election/how-to-vote-cards" target="_blank" rel="noreferrer">VEC publishes them</a>).</p>
        )}
      </section>

      {/* VOTING RECORD */}
      <section className="ds__sec lg">
        <h3 className="ds__h"><span>04</span>Voting record</h3>
        {p.sitting || current.some((x) => /legislative (assembly|council)|minister|premier|leader/i.test(x.label)) ? (
          <p className="ds__note">The Parliament of Victoria records every division (vote) in Hansard, but doesn't publish them as data PolTok can verify per member, so we don't list individual votes rather than risk getting one wrong. Major-party MPs in Victoria almost always vote with their party, so the stances above are the best guide. Read the record directly: <a href="https://www.parliament.vic.gov.au/members/" target="_blank" rel="noreferrer">member profiles</a> · <a href="https://www.parliament.vic.gov.au/hansard/" target="_blank" rel="noreferrer">Hansard</a>.</p>
        ) : <p className="ds__note">{p.name} hasn't served in the Victorian Parliament, so there's no voting record yet.</p>}
      </section>
    </div>
  );
}
