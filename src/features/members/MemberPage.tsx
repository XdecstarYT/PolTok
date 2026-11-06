/** /member/:id — profile. US: bioguide id (congress-legislators + Voteview). AU: au-h-{seat} / au-s-{slug}. */
import { Link, useParams } from 'react-router-dom';
import { useLive } from '../../lib/live';
import { AU_MEMBERS, US_PARTY, auSeatFor, useJson, type DirMember, type UsMemberResp } from './data';
import { Avatar } from './MembersPage';
import { PARTY_HEX } from '../../lib/format';
import './members.css';

const VOTE = { Y: 'Yea', N: 'Nay', P: 'Present', X: 'Not voting' } as const;
const yr = (d: string) => d.slice(0, 4);

function News({ name }: { name: string }) {
  const { news } = useLive();
  const last = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(-1)[0];
  const first = name.trim().split(/\s+/)[0];
  const hits = news.filter((n) => n.title.includes(last) && (n.title.includes(first) || last.length > 5)).slice(0, 8);
  return (
    <section className="mb-panel">
      <h2>In the news</h2>
      {hits.length ? <ul className="mb-list">{hits.map((n) => <li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.title}</a> <small>{n.source} · {new Date(n.publishedAt).toLocaleDateString()}</small></li>)}</ul>
        : <p className="mb-muted">No headlines mentioning {name} in the current PolTok news feed.</p>}
    </section>
  );
}

function IdeologyBar({ v }: { v: number }) {
  return (
    <div className="mb-ideo" aria-label={`DW-NOMINATE first dimension ${v.toFixed(3)}`}>
      <div className="mb-ideo-track"><i style={{ left: `${((v + 1) / 2) * 100}%` }} /></div>
      <div className="mb-ideo-lbl"><span>−1 Liberal</span><span>0</span><span>Conservative +1</span></div>
    </div>
  );
}

function AuProfile({ m }: { m: DirMember }) {
  const seat = auSeatFor(m.key);
  return (
    <main className="page mb-page">
      <div className="mb-kicker"><Link to="/members?c=au">MEMBERS</Link> · AUSTRALIA · {m.chamber === 'senate' ? 'SENATE' : 'HOUSE OF REPRESENTATIVES'}</div>
      <header className="mb-hero">
        <Avatar m={m} size={96} />
        <div><h1>{m.name}</h1><p className="mb-sub"><b style={{ color: m.color }}>{m.partyLabel}</b> · {m.chamber === 'senate' ? `Senator for ${m.state}` : `Member for ${m.seat} (${m.state})`}</p>
          {m.note && <p className="mb-muted">{m.note}</p>}
          {m.photoCredit && <p className="mb-muted mb-small">{m.photoCredit.replace(/ via Wikimedia Commons$/, '')} via <a href={m.photoSource} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>{m.photoLicenceUrl && <> (<a href={m.photoLicenceUrl} target="_blank" rel="noopener noreferrer">licence</a>)</>}</p>}</div>
      </header>
      <div className="mb-stats">
        {seat && <div>Seat<b>{seat.name}</b><small><Link to={`/au/seat/${seat.id}`}>Seat page</Link></small></div>}
        {seat && <div>2025 margin<b>{seat.margin != null ? `${seat.margin.toFixed(1)}%` : '—'}</b><small>{seat.contest || 'two-candidate-preferred'}</small></div>}
        {seat?.party2025 && seat.party2025 !== seat.party && <div>Won in 2025 by<b>{seat.party2025}</b></div>}
        {m.chamber === 'senate' && <div>State<b>{m.state}</b><small><Link to="/au/senate">Senate page</Link></small></div>}
        <div>Party<b>{m.party}</b><small><Link to={`/au/party/${m.party}`}>Party page</Link></small></div>
      </div>
      <p className="mb-muted mb-small">Voting records and committees are not shown for Australian members: PolTok has no verified keyless source wired up yet (TheyVoteForYou needs a key). Source: PolTok research compilation from AEC/APH records.</p>
      <News name={m.name} />
    </main>
  );
}

export default function MemberPage() {
  const { id = '' } = useParams();
  const isAu = id.startsWith('au-');
  const au = isAu ? AU_MEMBERS.find((m) => m.key === id) : undefined;
  const r = useJson<UsMemberResp>(isAu ? null : `/api/members/us/${encodeURIComponent(id)}`);
  if (isAu) return au ? <AuProfile m={au} /> : <main className="page mb-page"><p>Unknown member. <Link to="/members?c=au">All members</Link></p></main>;
  if (r.loading) return <main className="page mb-page"><p className="mb-muted">Loading…</p></main>;
  if (!r.data) return <main className="page mb-page"><p>Could not load this member ({r.error}). <Link to="/members">All members</Link></p></main>;
  const m = r.data.member;
  const color = PARTY_HEX[m.party];
  const s = m.stats;
  const age = m.birthday ? Math.floor((Date.now() - Date.parse(m.birthday)) / 31557600000) : null;
  const social = Object.entries(m.social).filter(([k]) => ['twitter', 'facebook', 'youtube', 'instagram', 'mastodon'].includes(k));
  const SOC: Record<string, (h: string) => string> = { twitter: (h) => `https://x.com/${h}`, facebook: (h) => `https://facebook.com/${h}`, youtube: (h) => `https://youtube.com/${h}`, instagram: (h) => `https://instagram.com/${h}`, mastodon: (h) => h.startsWith('http') ? h : `https://${h}` };
  const span = [Date.parse(m.terms[0].start), Date.now()];
  const committees = m.committees.filter((c) => !c.sub), subs = m.committees.filter((c) => c.sub);

  return (
    <main className="page mb-page">
      <div className="mb-kicker"><Link to="/members">MEMBERS</Link> · US {m.chamber === 'senate' ? 'SENATE' : 'HOUSE'} · 119TH CONGRESS</div>
      <header className="mb-hero">
        <Avatar m={{ name: m.name, photo: m.photo, color }} size={110} />
        <div>
          <h1>{m.name}</h1>
          <p className="mb-sub"><b style={{ color }}>{m.partyName}</b> · {m.chamber === 'senate' ? `${m.rank ? m.rank[0].toUpperCase() + m.rank.slice(1) + ' senator' : 'Senator'} for ${m.state}${m.senClass ? ` (Class ${m.senClass})` : ''}` : `Representative, ${m.state}-${m.district === 0 ? 'At-large' : m.district}`}</p>
          <p className="mb-muted mb-small">In this chamber since {m.since} · current term ends {m.termEnd}{age != null ? ` · born ${m.birthday} (age ${age})` : ''}</p>
          <p className="mb-links">
            {m.contact.url && <a href={m.contact.url} target="_blank" rel="noreferrer">Official site</a>}
            {m.contact.phone && <span>{m.contact.phone}</span>}
            {social.map(([k, h]) => <a key={k} href={SOC[k](h)} target="_blank" rel="noreferrer">{k === 'twitter' ? 'X' : k[0].toUpperCase() + k.slice(1)}</a>)}
            <a href={`https://www.congress.gov/member/${m.id}`} target="_blank" rel="noreferrer">Sponsored bills (congress.gov)</a>
            {m.ids.opensecrets && <a href={`https://www.opensecrets.org/members-of-congress/summary?cid=${m.ids.opensecrets}`} target="_blank" rel="noreferrer">OpenSecrets</a>}
            {m.ids.wikipedia && <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(m.ids.wikipedia.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">Wikipedia</a>}
          </p>
        </div>
      </header>

      {s && <div className="mb-stats">
        <div>Ideology (dim 1)<b>{s.dim1 != null ? s.dim1.toFixed(2) : '—'}</b><small>DW-NOMINATE</small></div>
        <div>Votes with party<b>{s.partyUnityPct != null ? `${s.partyUnityPct}%` : '—'}</b><small>on {s.unityVotes ?? 0} party-line votes</small></div>
        <div>Missed votes<b>{s.missedPct != null ? `${s.missedPct}%` : '—'}</b><small>of {s.votes ?? 0} roll calls</small></div>
        <div>Committees<b>{committees.length}</b><small>{subs.length} subcommittees</small></div>
      </div>}

      <div className="mb-grid">
        <div className="mb-col">
          {s?.dim1 != null && <section className="mb-panel"><h2>Ideology position</h2><IdeologyBar v={s.dim1} /><p className="mb-muted mb-small">Voteview DW-NOMINATE first dimension, estimated from all roll calls this member has cast. “Votes with party” counts roll calls where most Democrats and most Republicans voted opposite ways.</p></section>}
          <section className="mb-panel">
            <h2>Recent votes</h2>
            {m.votes.length ? <ul className="mb-votes">{m.votes.map((v) => (
              <li key={v.roll}><span className={`mb-v mb-v-${v.vote}`}>{VOTE[v.vote]}</span>
                <div><b>{v.bill ? `${v.bill} · ` : ''}{v.question}</b>{v.description && <small>{v.description}</small>}<small>{v.date} · roll {v.roll} · {v.result}{v.yea != null ? ` (${v.yea}–${v.nay})` : ''}</small></div></li>
            ))}</ul> : <p className="mb-muted">No Voteview roll calls available.</p>}
            {r.data.voteview && <p className="mb-muted mb-small">Voteview republishes official roll calls with a lag — latest {m.chamber === 'senate' ? r.data.voteview.latest.Senate : r.data.voteview.latest.House}.</p>}
          </section>
        </div>
        <div className="mb-col">
          <section className="mb-panel">
            <h2>Committees</h2>
            {committees.length ? <ul className="mb-list">{committees.map((c) => <li key={c.code}>{c.url ? <a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> : c.name}{c.title && <b className="mb-tag">{c.title}</b>}</li>)}</ul> : <p className="mb-muted">No committee assignments listed.</p>}
            {subs.length > 0 && <details><summary>{subs.length} subcommittees</summary><ul className="mb-list">{subs.map((c) => <li key={c.code}>{c.name}{c.title && <b className="mb-tag">{c.title}</b>}</li>)}</ul></details>}
          </section>
          <section className="mb-panel">
            <h2>Terms in Congress</h2>
            <div className="mb-tl">{m.terms.map((t) => {
              const a = Date.parse(t.start), b = Math.min(Date.parse(t.end), span[1]);
              return <span key={t.start} title={`${t.type === 'sen' ? 'Senate' : 'House'} ${t.state}${t.district != null ? `-${t.district}` : ''}, ${t.start} – ${t.end} (${t.party})`}
                className={`mb-tl-${t.type}`} style={{ left: `${((a - span[0]) / (span[1] - span[0])) * 100}%`, width: `${Math.max(0.6, ((b - a) / (span[1] - span[0])) * 100)}%`, background: PARTY_HEX[t.party.startsWith('Dem') ? 'D' : t.party.startsWith('Rep') ? 'R' : 'I'] }} />;
            })}</div>
            <div className="mb-tl-lbl"><span>{yr(m.terms[0].start)}</span><span>today</span></div>
            <ul className="mb-list mb-small">{m.terms.slice().reverse().map((t) => <li key={t.start}>{yr(t.start)}–{yr(t.end)} · {t.type === 'sen' ? 'Senate' : 'House'} · {t.state}{t.district != null ? `-${t.district === 0 ? 'AL' : t.district}` : ''} · {US_PARTY[t.party[0]] ?? t.party}{t.how ? ` (${t.how.replace(/-/g, ' ')})` : ''}</li>)}</ul>
          </section>
          <News name={m.name} />
        </div>
      </div>
      <footer className="mb-src">Sources: {r.data.sources.map((x, i) => <span key={x.url}>{i ? ' · ' : ''}<a href={x.url} target="_blank" rel="noreferrer">{x.name}</a></span>)}</footer>
    </main>
  );
}
