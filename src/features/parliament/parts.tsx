import { Link } from 'react-router-dom';
import { fmtDay, fmtTime, tzAbbr } from '../../components';
import { fmtDate, type Bill, type Missing, type Vote } from './api';

export function partyColor(p: string): string {
  const s = p.toLowerCase();
  if (s === 'd' || s.startsWith('dem')) return 'var(--dem)';
  if (s === 'r' || s.startsWith('rep')) return 'var(--rep)';
  if (/labor/.test(s)) return '#e13940';
  if (/liberal|lnp/.test(s)) return '#1c6fd9';
  if (/green/.test(s)) return 'var(--grn)';
  if (/national/.test(s)) return '#1f9d55';
  if (/one nation/.test(s)) return '#f08c1a';
  if (s === 'i' || s.startsWith('ind')) return 'var(--ind)';
  return 'var(--oth)';
}

export function StageTracker({ bill, compact }: { bill: Pick<Bill, 'stage' | 'stages' | 'stageLabel'>; compact?: boolean }) {
  const unknown = bill.stage < 0;
  return (
    <div className={`pa-stages ${compact ? 'is-compact' : ''}`} role="img" aria-label={unknown ? 'Stage not reported by source' : `Stage: ${bill.stageLabel} (${bill.stage + 1} of ${bill.stages.length})`}>
      <ol>
        {bill.stages.map((s, i) => (
          <li key={s} className={unknown ? '' : i < bill.stage ? 'done' : i === bill.stage ? 'now' : ''}>
            <i aria-hidden />
            {!compact && <span>{s}</span>}
          </li>
        ))}
      </ol>
      {compact && <span className="pa-stages__lbl">{bill.stageLabel}</span>}
    </div>
  );
}

export function BillRow({ bill }: { bill: Bill }) {
  return (
    <li className="pa-bill">
      <Link to={`/parliament/bill/${encodeURIComponent(bill.id)}`} className="pa-bill__a">
        <div className="pa-bill__top">
          <b className="pa-bill__num">{bill.label}</b>
          {bill.policyArea && <span className="pa-tag">{bill.policyArea}</span>}
          <span className="pa-bill__ch">{bill.chamber}</span>
        </div>
        <h3 className="pa-bill__title">{bill.shortTitle || bill.title}</h3>
        {bill.sponsor && (
          <p className="pa-bill__sp">
            <i className="pa-dot" style={{ background: partyColor(bill.sponsor.party) }} aria-hidden />
            {bill.sponsor.name} ({bill.sponsor.party}
            {bill.sponsor.state ? `-${bill.sponsor.state}${bill.sponsor.district && bill.sponsor.district !== '0' ? `-${bill.sponsor.district}` : ''}` : ''})
            {!!bill.cosponsors && <span className="pa-muted"> · {bill.cosponsors} cosponsor{bill.cosponsors === 1 ? '' : 's'}</span>}
          </p>
        )}
        <StageTracker bill={bill} compact />
        {bill.latestAction && (
          <p className="pa-bill__act">
            <time>{fmtDate(bill.latestAction.date)}</time> — {bill.latestAction.text}
            {bill.source && <span className="pa-muted"> · {bill.source === 'mirror' ? 'via APH open-data mirror' : 'via Federal Register of Legislation'}</span>}
          </p>
        )}
        {bill.subjects.length > 0 && (
          <div className="pa-subjects">
            {bill.subjects.slice(0, 4).map((s) => (
              <span key={s} className="pa-tag pa-tag--ghost">{s}</span>
            ))}
            {bill.subjects.length > 4 && <span className="pa-muted">+{bill.subjects.length - 4}</span>}
          </div>
        )}
      </Link>
    </li>
  );
}

export function VoteCard({ v }: { v: Vote }) {
  const total = v.totals.yea + v.totals.nay || 1;
  const passed = /pass|agreed|adopted|confirmed/i.test(v.result) && !/not agreed|failed|rejected/i.test(v.result);
  return (
    <li className="pa-vote">
      <div className="pa-vote__top">
        <span className="pa-tag">{v.chamber} #{v.roll}</span>
        <span className="pa-muted">{v.ts ? `${fmtDay(v.ts, 'short')} · ${fmtTime(v.ts)} ${tzAbbr(v.ts)}` : fmtDate(v.date) || v.date}</span>
        <b className={`pa-res ${passed ? 'ok' : 'no'}`}>{v.result}</b>
      </div>
      <p className="pa-vote__q">
        {v.billId ? <Link to={`/parliament/bill/${v.billId}`}>{v.measure}</Link> : v.measure && <b>{v.measure}</b>} {v.description && <span>— {v.description}</span>}
      </p>
      <p className="pa-muted pa-small">{v.question}</p>
      <div className="pa-tally" role="img" aria-label={`Yea ${v.totals.yea}, Nay ${v.totals.nay}`}>
        <span className="y" style={{ width: `${(v.totals.yea / total) * 100}%` }} />
        <span className="n" style={{ width: `${(v.totals.nay / total) * 100}%` }} />
      </div>
      <div className="pa-small">
        <b>Yea {v.totals.yea}</b> · <b>Nay {v.totals.nay}</b>
        {v.totals.present > 0 && ` · Present ${v.totals.present}`}
        {v.totals.notVoting > 0 && ` · Not voting ${v.totals.notVoting}`}
      </div>
      {v.parties.length > 0 && (
        <table className="pa-ptable">
          <thead>
            <tr><th scope="col">Party</th><th scope="col">Yea</th><th scope="col">Nay</th><th scope="col">NV</th></tr>
          </thead>
          <tbody>
            {v.parties.filter((p) => p.yea + p.nay + p.present + p.notVoting > 0).map((p) => (
              <tr key={p.name}>
                <th scope="row"><i className="pa-dot" style={{ background: partyColor(p.name) }} aria-hidden />{p.name}</th>
                <td>{p.yea}</td><td>{p.nay}</td><td>{p.notVoting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <a className="pa-small" href={v.url} target="_blank" rel="noreferrer">Official record ↗</a>
    </li>
  );
}

export function MissingKeys({ missing }: { missing: Missing[] }) {
  if (!missing.length) return null;
  return (
    <div className="pa-connect" role="note">
      <b>Connect a data key</b>
      <p>This section needs a free API key set as a server-side environment variable (Netlify → Site configuration → Environment variables):</p>
      <ul>
        {missing.map((m) => (
          <li key={m.key}>
            <code>{m.key}</code> — {m.what}. <a href={m.where} target="_blank" rel="noreferrer">Get a key ↗</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Notes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <ul className="pa-notes">
      {notes.map((n) => <li key={n}>{n}</li>)}
    </ul>
  );
}
