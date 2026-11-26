/** /au/victoria/candidates — a profile card for every 2026 Victorian Legislative Assembly candidate. */
import { useDeferredValue, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, PageHeader } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { AuNav } from '../AuNav';
import { useVicLive, vicColor, VIC_NAME } from '../vicLive';
import { ProfileCard, SeatProfile } from './components';
import { SEATS, allCandidates, candidatesAsAt } from './people';
import { ProfileHost } from './Profile';
import '../au.css';

const GROUPS = ['ALP', 'LNP', 'GRN', 'ONP', 'IND', 'OTH'];
const PAGE = 48;

export default function CandidatesDirectory() {
  useSeo({ title: 'Every Victorian candidate · 2026', description: 'Profile cards for every candidate in the 2026 Victorian state election, by district and party.' });
  const { data } = useVicLive();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const dq = useDeferredValue(q.trim().toLowerCase());
  const [group, setGroup] = useState<string | null>(params.get('party'));
  const [seat, setSeat] = useState<string>(params.get('district') ?? '');
  const [n, setN] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const all = useMemo(() => allCandidates(), []);
  const list = useMemo(() => all.filter((c) => (!group || c.bucket === group) && (!seat || c.seatId === seat) && (!dq || c.name.toLowerCase().includes(dq) || c.seatName.toLowerCase().includes(dq) || c.partyName.toLowerCase().includes(dq))), [all, group, seat, dq]);
  const counts = useMemo(() => { const o: Record<string, number> = {}; for (const c of all) o[c.bucket] = (o[c.bucket] ?? 0) + 1; return o; }, [all]);
  const sync = (k: string, v: string | null) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · Sat 28 Nov 2026" title="Every candidate" crumbLabel="Victoria candidates"
        sub={<>{all.length} candidates across 88 districts, in ballot-paper order. Source: Victorian Electoral Commission, as at {candidatesAsAt}.</>}>
        <AuNav />
      </PageHeader>
      <div className="cd-tools lg">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setN(PAGE); sync('q', e.target.value || null); }} placeholder="Search a name, district or party…" aria-label="Search candidates" />
        <select value={seat} onChange={(e) => { setSeat(e.target.value); setN(PAGE); sync('district', e.target.value || null); }} aria-label="District">
          <option value="">All 88 districts</option>
          {SEATS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="cd-chips" role="group" aria-label="Party">
          <button type="button" aria-pressed={!group} onClick={() => { setGroup(null); setN(PAGE); sync('party', null); }}>All</button>
          {GROUPS.map((g) => <button key={g} type="button" aria-pressed={group === g} style={{ ['--c' as string]: vicColor(g) } as CSSProperties} onClick={() => { setGroup(g); setN(PAGE); sync('party', g); }}>{VIC_NAME[g] ?? g} {counts[g] ?? 0}</button>)}
        </div>
      </div>
      <p className="faint" style={{ margin: '0 0 10px' }}>{list.length} shown{seat ? <> · <button type="button" className="linklike" onClick={() => setOpen(seat)} style={{ background: 'none', border: 0, color: 'var(--accent)', cursor: 'pointer', fontWeight: 700 }}>Open the {SEATS.find((s) => s.id === seat)?.name} seat profile →</button></> : null}</p>
      <div className="cd-grid">
        {list.slice(0, n).map((c) => (
          <div key={c.seatId + c.name} onClick={() => setOpen(c.seatId)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(c.seatId); }} style={{ cursor: 'pointer' }}>
            <ProfileCard p={c} model={data?.model} />
          </div>
        ))}
      </div>
      {n < list.length && <div className="cd-more"><Button variant="ghost" size="lg" onClick={() => setN((x) => x + PAGE * 2)}>Show more ({list.length - n} left)</Button></div>}
      <p className="faint" style={{ fontSize: 12, marginTop: 18 }}>Names, parties and ballot positions as published by the VEC; contact details are deliberately not shown. Photos only where a freely licensed (Wikimedia Commons) or official portrait exists. <Link to="/au/victoria/parliament">See the seat model →</Link></p>
      <ProfileHost />
      {open && <SeatProfile id={open} data={data} onClose={() => setOpen(null)} />}
    </div>
  );
}
