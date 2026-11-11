/**
 * /my — "Your area". US: address/ZIP → Census Geocoder (server-side, /api/myarea) → House, Senate,
 * governor, state-legislative races and ballot measures from the NYT/AP state results file, plus
 * current members (/api/members/us). AU: postcode/suburb → federal division(s) (+ Vic district)
 * from a bundled ABS ASGS Edition 3 mesh-block join (public/data/au-postcodes.json, CC BY 4.0).
 * Owned by src/features/myarea/**.
 */
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { PageHeader } from '../../components';
import { Link } from 'react-router-dom';
import { useSeo } from '../../lib/seo';
import { RACES, stateByAbbr } from '../../data';
import { FEDERAL, VICTORIA, SENATORS, AU_PARTIES, auPartyColor, type AuSeat } from '../../data/au';
import { AUMap } from '../au/map/AUMap';
import { parseContest, useNyt, slug, type Contest, type NytRace } from '../governors/data';
import './myarea.css';

type Country = 'US' | 'AU';
interface UsGeo {
  kind: 'address' | 'zip'; matched: string; approximate: boolean; state: string; stateName: string; county: string | null;
  cd: { district: number; name: string; layer: string; congress: number | null } | null;
  upper: { name: string; layer: string } | null; lower: { name: string; layer: string } | null;
  sources: { name: string; url: string }[];
}
interface UsMember { id: string; name: string; chamber: 'senate' | 'house'; party: string; state: string; district: number | null; photo?: string }
type AuData = { p: Record<string, [string, [string, number][], [string, number][]?]>; s: Record<string, string[]> };

const KEY = 'poltok.myarea.v1';
const load = (): { country: Country; q: string } | null => { try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
const save = (v: { country: Country; q: string } | null) => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } };
const PCOL: Record<string, string> = { D: 'var(--dem)', R: 'var(--rep)', I: 'var(--ind, #8b93a7)', O: 'var(--text-3)' };
const pad = (n: number) => String(n).padStart(2, '0');
const num = (s: string) => Number((s.match(/(\d+)/) || [])[1]);

export default function MyAreaPage() {
  useSeo({ title: 'Your area', description: 'Enter a US address or ZIP, or an Australian postcode or suburb, to see your representatives and races.' });
  const saved = useMemo(load, []);
  const [country, setCountry] = useState<Country>(saved?.country ?? 'US');
  const [q, setQ] = useState(saved?.q ?? '');
  const [remember, setRemember] = useState(!!saved);
  const [submitted, setSubmitted] = useState<{ country: Country; q: string } | null>(saved);
  const go = (e?: FormEvent) => {
    e?.preventDefault();
    const v = { country, q: q.trim() };
    if (!v.q) return;
    setSubmitted(v);
    save(remember ? v : null);
  };
  const toggleRemember = (on: boolean) => { setRemember(on); save(on && submitted ? submitted : null); };

  return (
    <div className="ma-page container">
      <PageHeader
        kicker="Your area"
        title="Your representatives & races"
        crumbLabel="Your area"
        sub="Find the districts you vote in, who represents you now, and how your 2026 races are going."
      />
      <form className="ma-form" onSubmit={go}>
        <div className="ma-seg" role="radiogroup" aria-label="Country">
          {(['US', 'AU'] as Country[]).map((c) => (
            <button type="button" key={c} role="radio" aria-checked={country === c} className={country === c ? 'on' : ''} onClick={() => setCountry(c)}>
              {c === 'US' ? 'United States' : 'Australia'}
            </button>
          ))}
        </div>
        <div className="ma-row">
          <label className="sr-only" htmlFor="ma-q">{country === 'US' ? 'Street address or ZIP' : 'Postcode or suburb'}</label>
          <input id="ma-q" value={q} onChange={(e) => setQ(e.target.value)} autoComplete={country === 'US' ? 'street-address' : 'postal-code'}
            placeholder={country === 'US' ? '350 Fifth Ave, New York, NY 10118 — or a ZIP' : '3101 — or a suburb, e.g. Kew VIC'} />
          <button type="submit" className="ma-go">Look up</button>
        </div>
        <label className="ma-remember"><input type="checkbox" checked={remember} onChange={(e) => toggleRemember(e.target.checked)} /> Remember my area on this device</label>
        <p className="ma-privacy">
          {country === 'US'
            ? 'Privacy: your address is sent only to the U.S. Census Bureau geocoder (via our server, not logged or stored). Nothing is saved unless you tick “remember”, and then only in this browser.'
            : 'Privacy: postcode lookups happen entirely in your browser from a bundled ABS dataset — nothing is sent anywhere.'}
        </p>
      </form>
      {submitted && (submitted.country === 'US' ? <UsResult key={submitted.q} q={submitted.q} /> : <AuResult key={submitted.q} q={submitted.q} />)}
    </div>
  );
}

/* ------------------------------------------------------------------ US ------------------------------------------------------------------ */
function UsResult({ q }: { q: string }) {
  const [geo, setGeo] = useState<UsGeo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [members, setMembers] = useState<UsMember[] | null>(null);
  useEffect(() => {
    const ctl = new AbortController();
    fetch(`/api/myarea/us?address=${encodeURIComponent(q)}`, { signal: ctl.signal })
      .then(async (r) => { const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` })); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`); setGeo(j); })
      .catch((e) => !ctl.signal.aborted && setErr(String(e.message || e)));
    fetch('/api/members/us', { signal: ctl.signal }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setMembers(j.members)).catch(() => {});
    return () => ctl.abort();
  }, [q]);
  const st = geo ? stateByAbbr.get(geo.state) : undefined;
  const nyt = useNyt<{ races?: NytRace[] }>(st ? `results-${slug(st.name)}.json` : null, 90_000);
  if (err) return <div className="ma-err" role="alert">{err}</div>;
  if (!geo) return <div className="ma-empty">Looking up districts with the Census geocoder…</div>;

  const races = nyt.data?.races || [];
  const at = (o: string, cov?: string) => races.filter((r) => r.office_id === o && (!cov || r.coverage === cov));
  const cdN = geo.cd?.district ?? 0;
  const at_large = (st?.houseSeats ?? 2) <= 1 || cdN === 0;
  const houseKey = `${geo.state}-${at_large ? 'AL' : pad(cdN)}`;
  const house = at('H').find((r) => at_large || Number(r.seat_number) === cdN);
  const senate = at('S');
  const gov = at('G');
  const sUp = geo.upper ? at('SS').filter((r) => num(r.seat_number || r.seat || '') === num(geo.upper!.name)) : [];
  const sLo = geo.lower ? at('SH').filter((r) => num(r.seat_number || r.seat || '') === num(geo.lower!.name)) : [];
  const measures = at('I', 'state');
  const myMembers = (members || []).filter((m) => m.state === geo.state && (m.chamber === 'senate' || at_large || m.district === cdN));
  const raceLink = (id: string) => (RACES.some((r) => r.id === id) ? `/race/${id}` : null);
  const senIds = RACES.filter((r) => r.state === geo.state && r.chamber === 'senate').map((r) => r.id);

  return (
    <section className="ma-res" aria-live="polite">
      <div className="ma-card ma-where">
        <div><span className="ma-lbl">Matched</span><b>{geo.matched}</b>{geo.county && <span className="ma-muted"> · {geo.county}</span>}</div>
        <div className="ma-chips">
          <Link className="ma-chip" to={`/state/${geo.state}`}>{geo.stateName} hub →</Link>
          {geo.cd && <span className="ma-chip">{at_large ? 'At-large district' : geo.cd.name}</span>}
          {geo.upper && <span className="ma-chip">{geo.upper.name}</span>}
          {geo.lower && <span className="ma-chip">{geo.lower.name}</span>}
        </div>
        {geo.approximate && <p className="ma-note">ZIP-only lookup uses the ZIP's centre point. ZIPs often span several districts — enter a full street address for an exact match.</p>}
        <p className="ma-note">
          District boundaries: {geo.cd?.layer || 'Congressional Districts'} from the Census “Current” vintage — the lines used for the November 2026 election.
          Several states redrew maps for 2026 (mid-decade redistricting and court-ordered changes); if your state's map changed, your 2026 district number may differ from the one your current member was elected in.
        </p>
      </div>

      <div className="ma-grid">
        <Block title={`U.S. House 2026 · ${houseKey}`} link={raceLink(houseKey) ?? '/house'} linkLabel={raceLink(houseKey) ? 'Race page' : 'All House races'}>
          {house ? <ContestView c={parseContest(house)} /> : <Pending nyt={nyt} what="House race" />}
        </Block>
        <Block title="U.S. Senate 2026" link={senIds[0] ? `/race/${senIds[0]}` : undefined} linkLabel="Race page">
          {senate.length ? senate.map((r) => <ContestView key={r.nyt_id} c={parseContest(r)} label={r.seat ? String(r.seat) : undefined} />) : <p className="ma-muted">{nyt.data ? `No Senate race in ${geo.stateName} this year.` : 'Loading…'}</p>}
        </Block>
        <Block title="Governor 2026" link={gov.length ? `/governors/${geo.state}` : undefined} linkLabel="Governor race">
          {gov.length ? gov.map((r) => <ContestView key={r.nyt_id} c={parseContest(r)} />) : <p className="ma-muted">{nyt.data ? `No governor race in ${geo.stateName} this year.` : 'Loading…'}</p>}
        </Block>
        <Block title="Your members of Congress (now)" link="/members" linkLabel="All members">
          {members === null ? <p className="ma-muted">Loading members…</p> : myMembers.length ? (
            <ul className="ma-mem">
              {myMembers.sort((a, b) => (a.chamber > b.chamber ? -1 : 1)).map((m) => (
                <li key={m.id}>
                  {m.photo && <img src={m.photo} alt="" loading="lazy" width={36} height={44} />}
                  <Link to={`/member/${m.id}`}><b>{m.name}</b></Link>
                  <span className="ma-pty" style={{ color: PCOL[m.party] || PCOL.O }}>{m.party}</span>
                  <span className="ma-muted">{m.chamber === 'senate' ? 'Senator' : `Rep. ${geo.state}-${m.district ? pad(m.district) : 'AL'}`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="ma-muted">No current member found (seat may be vacant, or the member directory is unavailable).</p>}
          <p className="ma-note">Current (119th Congress) members, matched by district number.</p>
        </Block>
        {(sUp.length > 0 || sLo.length > 0) && (
          <Block title="State legislature 2026">
            {[...sUp, ...sLo].map((r) => <ContestView key={r.nyt_id} c={parseContest(r)} label={`${r.office_id === 'SS' ? geo.upper?.name : geo.lower?.name}`} />)}
          </Block>
        )}
        <Block title={`Ballot measures in ${geo.stateName}`} link="/measures" linkLabel="All measures">
          {measures.length ? measures.map((r) => <MeasureRow key={r.nyt_id} r={r} />) : <p className="ma-muted">{nyt.data ? 'No statewide measures on the ballot.' : 'Loading…'}</p>}
        </Block>
      </div>
      <p className="ma-src">
        Districts: {geo.sources.map((s, i) => <span key={s.url}>{i ? ' · ' : ''}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a></span>)}.
        {' '}Results: AP via The New York Times{nyt.at ? `, fetched ${new Date(nyt.at).toLocaleTimeString()}` : ''}{nyt.error ? ` (error: ${nyt.error})` : ''}. Members: unitedstates/congress-legislators.
      </p>
    </section>
  );
}

function Pending({ nyt, what }: { nyt: { data?: unknown; error?: string }; what: string }) {
  return <p className="ma-muted">{nyt.error ? `Results unavailable (${nyt.error}).` : nyt.data ? `No ${what} found in the results file.` : 'Loading results…'}</p>;
}

function Block({ title, link, linkLabel, children }: { title: string; link?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <article className="ma-card">
      <header className="ma-bh"><h2>{title}</h2>{link && <Link to={link}>{linkLabel ?? 'More'} →</Link>}</header>
      {children}
    </article>
  );
}

function ContestView({ c, label }: { c: Contest; label?: string }) {
  const lines = c.lines.slice(0, 4);
  return (
    <div className="ma-contest">
      <div className="ma-cstat">
        {label && <b>{label}</b>}
        <span className={c.called ? 'ma-called' : 'ma-muted'}>{c.called ? `Called${c.gained ? ' · flip' : ''}` : c.lines.length < 2 ? 'Uncontested' : `${Math.round(c.eevp)}% expected vote in`}</span>
      </div>
      {lines.map((l) => (
        <div className="ma-line" key={l.id}>
          <span className="ma-sw" style={{ background: PCOL[l.party] }} />
          <span className="ma-nm">{l.name}{l.incumbent ? ' (inc.)' : ''}{l.won ? ' ✓' : ''}</span>
          <span className="ma-pct">{c.total ? `${l.pct.toFixed(1)}%` : '—'}</span>
          <span className="ma-bar"><span style={{ width: `${l.pct}%`, background: PCOL[l.party] }} /></span>
        </div>
      ))}
    </div>
  );
}

function MeasureRow({ r }: { r: NytRace }) {
  const c = parseContest(r);
  const yes = c.lines.find((l) => /yes|for/i.test(l.name)), no = c.lines.find((l) => /^no|against/i.test(l.name));
  const name = r.seat || r.title?.default || r.long_description || r.nyt_id;
  return (
    <div className="ma-meas">
      <b>{String(name)}</b>
      <span className="ma-muted">{yes && no && c.total ? `Yes ${yes.pct.toFixed(1)}% · No ${no.pct.toFixed(1)}%` : 'No votes yet'}{c.called ? ` · ${c.lines.find((l) => l.won)?.name ?? 'called'}` : ''}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ AU ------------------------------------------------------------------ */
let auCache: Promise<AuData> | null = null;
const loadAu = () => (auCache ??= fetch('/data/au-postcodes.json').then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }));

function AuResult({ q }: { q: string }) {
  const [data, setData] = useState<AuData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => { loadAu().then(setData).catch((e) => { auCache = null; setErr(String(e.message || e)); }); }, []);
  const fed = useMemo(() => new Map(FEDERAL.seats.map((s) => [s.id, s])), []);
  const vic = useMemo(() => new Map(VICTORIA.seats.map((s) => [s.id, s])), []);
  if (err) return <div className="ma-err" role="alert">Could not load postcode data ({err}).</div>;
  if (!data) return <div className="ma-empty">Loading postcode data…</div>;

  let postcodes: { pc: string; suburb?: string }[] = [];
  const m = q.match(/^\s*(\d{4})\s*$/);
  if (m) postcodes = [{ pc: m[1] }];
  else {
    const stM = q.toUpperCase().match(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/);
    const name = q.replace(/\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b/i, '').replace(/[,\s]+$/, '').trim().toLowerCase();
    const hits = Object.entries(data.s).filter(([k]) => { const [n, s] = k.split('|'); return n.toLowerCase() === name && (!stM || s === stM[1]); });
    postcodes = hits.flatMap(([k, pcs]) => pcs.slice(0, 1).map((pc) => ({ pc, suburb: k.replace('|', ' ') })));
  }
  const found = postcodes.filter((p) => data.p[p.pc]);
  if (!found.length) return <div className="ma-err" role="alert">No match for “{q}”. Try a 4-digit postcode, or a suburb with state (e.g. “Kew VIC”).</div>;
  const cur = found.find((f) => f.pc === pick) ?? found[0];
  const [state, ceds, seds] = data.p[cur.pc];
  const seats = ceds.map(([id, share]) => ({ id, share, seat: fed.get(id) }));
  const vseats = (seds || []).map(([id, share]) => ({ id, share, seat: vic.get(id) }));
  const senators = SENATORS.filter((s) => s.state === state);

  return (
    <section className="ma-res" aria-live="polite">
      {found.length > 1 && (
        <div className="ma-seg" role="radiogroup" aria-label="Matching suburbs">
          {found.map((f) => <button type="button" key={f.pc + f.suburb} className={f === cur ? 'on' : ''} onClick={() => setPick(f.pc)}>{f.suburb} {f.pc}</button>)}
        </div>
      )}
      <div className="ma-card ma-where">
        <div><span className="ma-lbl">Postcode</span><b>{cur.pc}</b>{cur.suburb && <span className="ma-muted"> · {cur.suburb}</span>} <span className="ma-muted">· {state}</span></div>
        {seats.length > 1 && <p className="ma-note">This postcode spans {seats.length} federal divisions. Shares are the approximate fraction of the postcode's ABS mesh blocks in each — check the <a href="https://electorate.aec.gov.au/" target="_blank" rel="noreferrer">AEC electorate finder</a> with your street address.</p>}
      </div>
      <div className="ma-grid">
        <Block title="Federal House of Representatives" link={seats[0] ? `/au/seat/${seats[0].id}` : '/au'} linkLabel="Seat page">
          {seats.map(({ id, share, seat }) => <AuSeatRow key={id} id={id} share={share} seat={seat} multi={seats.length > 1} />)}
          <div className="ma-map">
            <AUMap layer="federal" variant="hex" labels={false} highlight={seats.map((s) => s.id)} selected={seats[0]?.id}
              fills={Object.fromEntries(FEDERAL.seats.map((s) => [s.id, seats.some((x) => x.id === s.id) ? auPartyColor(s.party) : 'var(--bg-3)']))}
              title="Your division" />
          </div>
        </Block>
        {state === 'VIC' && (
          <Block title="Victorian Legislative Assembly (election 28 Nov 2026)" link={vseats[0] ? `/au/seat/${vseats[0].id}` : '/au/victoria'} linkLabel="District page">
            {vseats.length ? vseats.map(({ id, share, seat }) => <AuSeatRow key={id} id={id} share={share} seat={seat} multi={vseats.length > 1} />) : <p className="ma-muted">No Victorian district mapped for this postcode.</p>}
            <p className="ma-note">Districts: ABS SED 2022 (Victoria's 2021 redivision, used for the 2022 and 2026 elections).</p>
          </Block>
        )}
        {state !== 'VIC' && state !== 'OT' && (
          <Block title="State parliament"><p className="ma-muted">State district lookup is currently Victoria-only. {state === 'NSW' ? <Link to="/au/nsw">NSW 2027 election →</Link> : null}</p></Block>
        )}
        <Block title={`Your senators · ${state}`} link="/au/senate" linkLabel="Senate">
          <ul className="ma-mem">
            {senators.map((s) => (
              <li key={s.name}><b>{s.name}</b><span className="ma-pty" style={{ color: auPartyColor(s.party) }}>{AU_PARTIES[s.party]?.short ?? s.party}</span>{s.note && <span className="ma-muted">{s.note}</span>}</li>
            ))}
          </ul>
        </Block>
      </div>
      <p className="ma-src">
        Postcode → division: derived from the <a href="https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/allocation-files" target="_blank" rel="noreferrer">ABS ASGS Edition 3 allocation files</a> (POA 2021, CED 2024, SED 2022, SAL 2021 mesh-block joins), © Commonwealth of Australia, CC BY 4.0. ABS postal areas approximate Australia Post postcodes. Members &amp; margins: PolTok AU research data (2025 federal / 2022-redistributed Vic TCP margins).
      </p>
    </section>
  );
}

function AuSeatRow({ id, share, seat, multi }: { id: string; share: number; seat?: AuSeat; multi: boolean }) {
  if (!seat) return <div className="ma-line"><span className="ma-nm">{id}</span>{multi && <span className="ma-pct">{Math.round(share * 100)}%</span>}</div>;
  return (
    <div className="ma-au">
      <span className="ma-sw" style={{ background: auPartyColor(seat.party) }} />
      <div className="ma-au-main">
        <Link to={`/au/seat/${seat.id}`}><b>{seat.name}</b></Link>
        <span>{seat.vacant ? 'Vacant' : seat.member} · {AU_PARTIES[seat.party]?.name ?? seat.party}</span>
        <span className="ma-muted">{seat.margin != null ? `Margin ${seat.margin.toFixed(1)} pts (2CP)` : 'Margin n/a'}{seat.vs ? ` vs ${seat.vs}` : ''}{seat.note ? ` · ${seat.note}` : ''}</span>
      </div>
      {multi && <span className="ma-pct">~{Math.round(share * 100)}%</span>}
    </div>
  );
}

