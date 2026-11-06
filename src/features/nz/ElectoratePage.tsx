/** /nz/electorate/:id — one electorate: candidates, live count (Electoral Commission), 2023 result. */
import { Link, useParams } from 'react-router-dom';
import { Card, fmtTime } from '../../components';
import { NZ_ELECTORATES, callOf, partyMeta, useNzDetail } from './data';
import './nz.css';

export default function NzElectoratePage() {
  const { id = '' } = useParams();
  const info = NZ_ELECTORATES.find((e) => e.id === id);
  const d = useNzDetail(id);
  const e = d?.electorate;
  if (!info) return <div className="nz page"><p>Unknown electorate. <Link to="/nz">Back to NZ election</Link></p></div>;
  const total = e?.candidates.reduce((a, c) => a + c.votes, 0) || 0;
  const call = e && e.margin != null ? callOf({ margin: e.margin, countedPct: e.countedPct }, d!.status as 'counting' | 'final', null) : null;
  return (
    <div className="nz page">
      <Link to="/nz" className="nz-back">← NZ election 2026</Link>
      <header className="nz-hero">
        <div>
          <span className="kicker">{info.type === 'maori' ? 'Māori electorate' : 'General electorate'} · 2026</span>
          <h1>{info.name}</h1>
          {info.r2023 ? <p className="nz-sub">2023: {info.r2023.winner} ({info.r2023.party}) by {info.r2023.margin.toLocaleString()} — boundaries changed in 2025.</p> : <p className="nz-sub">New or substantially redrawn electorate for 2026.</p>}
        </div>
      </header>
      <Card title={e ? `Count — ${e.countedPct ?? '?'}% counted` : 'Live count'} kicker={e ? `${d!.status === 'final' ? 'Official' : 'Preliminary'} · Electoral Commission · ${fmtTime(d!.updatedAt)}` : 'Electoral Commission'} live={!!e && d?.status !== 'final'}>
        {!e ? (
          <p className="nz-note">{d?.error || 'Checking…'} Results stream from 7:00pm NZDT, Sat 7 Nov.</p>
        ) : (
          <>
            {call && <p className="nz-call" style={{ ['--pc' as string]: partyMeta(e.leadingParty || '').color }}>{call === 'official' ? 'Official result (Electoral Commission)' : call === 'likely' ? 'PolTok projection: likely' : 'Leading'} — <b>{e.leader}</b> by {e.margin?.toLocaleString()}</p>}
            <ul className="nz-bars">
              {e.candidates.map((c) => (
                <li key={c.name} style={{ ['--pc' as string]: partyMeta(c.party).color }}>
                  <span className="nz-bars__name">{c.name} <small>{c.partyName}</small></span>
                  <span className="nz-bars__track"><span style={{ width: `${total ? (c.votes / total) * 100 : 0}%` }} /></span>
                  <span className="nz-bars__val mono">{c.votes.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <h4>Party vote in this electorate</h4>
            <ul className="nz-chips">{e.partyVotes.slice(0, 10).map((p) => <li key={p.name} className="nz-chip" style={{ ['--pc' as string]: partyMeta(p.party).color }}><i /> {p.name} <b>{p.votes.toLocaleString()}</b></li>)}</ul>
            <p className="nz-note"><a href={d!.source} target="_blank" rel="noreferrer">Source page</a></p>
          </>
        )}
      </Card>
      <Card title="Candidates" kicker="Final candidate list (Electoral Commission, 9 Oct) via Wikipedia">
        <ul className="nz-chips">
          {info.candidates.map((c) => <li key={c.name} className="nz-chip" style={{ ['--pc' as string]: partyMeta(c.party).color }}><i /> {c.name} <small>{partyMeta(c.party).name}{c.inc ? ' · sitting MP' : ''}</small></li>)}
        </ul>
      </Card>
    </div>
  );
}
