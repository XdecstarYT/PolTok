/** /parliament/bill/:id — bill detail: stage tracker, timeline, text versions, roll calls. */
import { Link, useParams } from 'react-router-dom';
import { fmtTime, tzAbbr } from '../../components';
import { api, countryOf, fmtDate, useAsync } from './api';
import { StageTracker, VoteCard, partyColor } from './parts';
import './parliament.css';

export default function BillPage() {
  const { id = '' } = useParams();
  const c = countryOf(id);
  const { data: b, error, loading } = useAsync(() => api.bill(c, id), [id]);
  const back = <Link to={c === 'au' ? '/parliament?c=au' : '/parliament'}>← {c === 'au' ? 'Australian Parliament' : 'US Congress'} bills</Link>;

  if (loading && !b) return <div className="page pa-page"><div className="pa-kicker">{back}</div><p className="pa-muted">Loading bill…</p></div>;
  if (error || !b)
    return (
      <div className="page pa-page">
        <div className="pa-kicker">{back}</div>
        <div className="pa-connect"><b>Bill not available</b><p>{error || 'Not found'} — the live parliament API could not return this bill.</p></div>
      </div>
    );

  const updatedTs = b.updated && /(Z|[+-]\d\d:?\d\d)$/.test(b.updated) ? Date.parse(b.updated) : NaN; // zone-less stamps (FRL) are not shown
  return (
    <div className="page pa-page">
      <div className="pa-kicker">{back}</div>
      <header>
        <div className="pa-bill__top">
          <b className="pa-bill__num">{b.label}</b>
          <span className="pa-bill__ch">{b.chamber}</span>
          {b.policyArea && <span className="pa-tag">{b.policyArea}</span>}
        </div>
        <h1>{b.shortTitle || b.title}</h1>
        {b.shortTitle && b.shortTitle !== b.title && <p className="pa-sub">{b.title}</p>}
        {b.sponsor && (
          <p className="pa-bill__sp">
            <i className="pa-dot" style={{ background: partyColor(b.sponsor.party) }} aria-hidden />
            Sponsor: <b>{b.sponsor.name}</b> ({b.sponsor.party}-{b.sponsor.state}
            {b.sponsor.district && b.sponsor.district !== '0' ? `-${b.sponsor.district}` : ''}){!!b.cosponsors && ` · ${b.cosponsors} cosponsors`}
          </p>
        )}
        <p className="pa-src">
          {b.introduced && <>Introduced {fmtDate(b.introduced)} · </>}
          {Number.isFinite(updatedTs) && <>Record updated {fmtDate(new Date(updatedTs).toISOString())} {fmtTime(updatedTs)} {tzAbbr(updatedTs)} · </>}
          <a href={b.url} target="_blank" rel="noreferrer">Official page ↗</a>
        </p>
      </header>

      <section className="pa-panel">
        <h2>Progress — {b.stageLabel}</h2>
        <StageTracker bill={b} />
        {b.laws && b.laws.length > 0 && <p className="pa-small">Enacted as {b.laws.join(', ')}.</p>}
      </section>

      {b.summary && (
        <section className="pa-panel">
          <h2>CRS summary</h2>
          <p className="pa-summary">{b.summary}</p>
        </section>
      )}

      <div className="pa-grid">
        <section className="pa-panel pa-main">
          <h2>Timeline ({b.actions.length} actions)</h2>
          <ol className="pa-timeline">
            {b.actions.map((a, i) => (
              <li key={i}>
                <time>{fmtDate(a.date)}</time>
                {a.chamber && <span className="pa-tag pa-tag--ghost">{a.chamber}</span>}
                <p>{a.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <aside className="pa-side">
          {b.texts.length > 0 && (
            <section className="pa-panel">
              <h2>Text</h2>
              <ul className="pa-links">
                {b.texts.map((t) => (
                  <li key={t.url}><a href={t.url} target="_blank" rel="noreferrer">{t.label}</a>{t.date && <span className="pa-muted"> · {fmtDate(t.date)}</span>}</li>
                ))}
              </ul>
            </section>
          )}
          {(b.subjects.length > 0 || (b.committees?.length ?? 0) > 0) && (
            <section className="pa-panel">
              {b.committees && b.committees.length > 0 && (<><h2>Committees</h2><div className="pa-subjects">{b.committees.map((s) => <span key={s} className="pa-tag pa-tag--ghost">{s}</span>)}</div></>)}
              {b.subjects.length > 0 && (<><h2 style={{ marginTop: 12 }}>Subjects</h2><div className="pa-subjects">{b.subjects.map((s) => <span key={s} className="pa-tag pa-tag--ghost">{s}</span>)}</div></>)}
            </section>
          )}
          {b.votes.length > 0 && (
            <section>
              <h2>Roll-call votes</h2>
              <ul className="pa-votes">{b.votes.map((v) => <VoteCard key={v.id} v={v} />)}</ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
