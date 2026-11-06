import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar, SimBadge } from '../../components';
import { STATES } from '../../data';
import { VIC_CANDIDATES } from '../../data/au';
import { auPhoto } from '../../data/au-photo';
const VIC_ASAT = VIC_CANDIDATES.asAt;
import { PARTY_HEX, PARTY_NAME } from '../../lib/format';
import type { Party } from '../../types';
import { type CandEntry, type Office, officeLabel, useCandidates } from './data';
import { usd } from '../money/data';
import { AU_CANDS, useMoneyIndex } from './profile';
import './candidates.css';

const OUTCOME_LABEL: Record<CandEntry['outcome'], string> = {
  won: 'Won',
  lost: 'Lost',
  leading: 'Leading',
  trailing: 'Trailing',
  pending: 'No votes yet',
};

export function OutcomeTag({ e }: { e: CandEntry }) {
  return (
    <span className={`cd-tag cd-tag--${e.outcome}`}>
      {e.outcome === 'won' && '✓ '}
      {OUTCOME_LABEL[e.outcome]}
      {e.pct !== undefined && <span className="mono"> · {e.pct.toFixed(1)}%</span>}
    </span>
  );
}

function CardMeta({ e, raised }: { e: CandEntry; raised?: number | null }) {
  if (raised == null && e.margin === undefined) return null;
  return (
    <span className="cd-card__meta">
      {e.margin !== undefined && <span>Margin <span className="mono">{e.margin >= 0 ? '+' : '−'}{Math.abs(e.margin).toFixed(1)}</span></span>}
      {raised != null && <span>Raised <span className="mono">{usd(raised)}</span></span>}
    </span>
  );
}

export default function CandidatesIndex() {
  const all = useCandidates();
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const party = sp.get('party') ?? '';
  const office = (sp.get('office') ?? '') as Office | '';
  const state = sp.get('state') ?? '';
  const res = sp.get('result') ?? '';
  const status = sp.get('status') ?? '';
  const sort = sp.get('sort') ?? '';
  const country = sp.get('country') === 'au' ? 'au' : 'us';
  const money = useMoneyIndex();
  const [text, setText] = useState(q);

  useEffect(() => {
    document.title = 'Candidates · PolTok';
  }, []);

  const set = (k: string, v: string) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    setSp(n, { replace: true });
  };
  useEffect(() => {
    const t = setTimeout(() => text !== q && set('q', text.trim()), 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const list = useMemo(() => {
    const needle = q.toLowerCase();
    const ord: Record<string, number> = { senate: 0, governor: 1, house: 2 };
    return all
      .filter((e) => {
        if (party && (party === 'O' ? ['D', 'R', 'I'].includes(e.cand.party) : e.cand.party !== party)) return false;
        if (office && e.race.chamber !== office) return false;
        if (state && e.race.state !== state) return false;
        if (res === 'won' && e.outcome !== 'won') return false;
        if (res === 'lost' && e.outcome !== 'lost') return false;
        if (res === 'uncalled' && (e.outcome === 'won' || e.outcome === 'lost')) return false;
        if (status === 'incumbent' && !e.cand.incumbent) return false;
        if (status === 'challenger' && e.cand.incumbent) return false;
        if (needle) {
          const st = STATES.find((s) => s.abbr === e.race.state)?.name ?? '';
          const hay = `${e.cand.name} ${e.race.title} ${e.race.id} ${st}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sort === 'money') return (money.byId.get(b.cand.id)?.receipts ?? -1) - (money.byId.get(a.cand.id)?.receipts ?? -1);
        if (sort === 'margin') return (b.margin ?? -999) - (a.margin ?? -999);
        if (sort === 'close') return Math.abs(a.margin ?? 999) - Math.abs(b.margin ?? 999);
        if (sort === 'name') return a.cand.name.split(' ').slice(-1)[0].localeCompare(b.cand.name.split(' ').slice(-1)[0]);
        return ord[a.race.chamber] - ord[b.race.chamber] || a.race.id.localeCompare(b.race.id) || b.votes - a.votes;
      });
  }, [all, q, party, office, state, res, status, sort, money]);

  const auList = useMemo(() => {
    const needle = q.toLowerCase();
    return AU_CANDS.filter((c) => {
      if (office && c.office !== (office as string)) return false;
      if (state && c.state !== state) return false;
      if (party && c.party !== party) return false;
      if (status === 'incumbent' && !c.incumbent) return false;
      if (status === 'challenger' && c.incumbent) return false;
      return !needle || `${c.name} ${c.seat} ${c.partyLabel}`.toLowerCase().includes(needle);
    }).sort((a, b) => (sort === 'margin' ? (b.margin ?? -1) - (a.margin ?? -1) : sort === 'name' ? a.name.split(' ').slice(-1)[0].localeCompare(b.name.split(' ').slice(-1)[0]) : 0));
  }, [q, office, state, party, status, sort]);
  const auParties = useMemo(() => [...new Map(AU_CANDS.map((c) => [c.party, c.partyLabel])).entries()].sort((a, b) => a[1].localeCompare(b[1])), []);

  const won = all.filter((e) => e.outcome === 'won').length;
  const states = useMemo(() => [...new Set(all.map((e) => e.race.state))].sort(), [all]);

  return (
    <div className="page cd-page">
      <header className="cd-head">
        <div>
          <span className="kicker">2026 Midterms</span>
          <h1>Candidates</h1>
          <p className="cd-muted">
            Every Senate and governor nominee plus candidates in {new Set(all.filter((e) => e.race.chamber === 'house').map((e) => e.race.id)).size} key House
            races. {won > 0 && `${won} declared winners so far.`} Headshots: NYT/AP where available.
          </p>
        </div>
        <SimBadge />
      </header>

      <div className="cd-seg" role="group" aria-label="Country">
        {(['us', 'au'] as const).map((c) => (
          <button key={c} type="button" aria-pressed={country === c} className={country === c ? 'is-on' : ''}
            onClick={() => { const n = new URLSearchParams(); if (c === 'au') n.set('country', 'au'); setSp(n, { replace: true }); }}>
            {c === 'us' ? 'United States 2026' : 'Australia (federal + Vic 2026)'}
          </button>
        ))}
      </div>

      {country === 'au' ? (
        <>
          <div className="cd-filters" role="search">
            <input type="search" className="cd-input" placeholder="Search name, seat or party…" aria-label="Search candidates" value={text} onChange={(e) => setText(e.target.value)} />
            <select aria-label="Office" value={office} onChange={(e) => set('office', e.target.value)}>
              <option value="">All offices</option>
              <option value="au-house">Federal House (members)</option>
              <option value="au-senate">Federal Senate (senators)</option>
              <option value="vic">Victoria 2026 nominees</option>
            </select>
            <select aria-label="Party" value={party} onChange={(e) => set('party', e.target.value)}>
              <option value="">All parties</option>
              {auParties.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <select aria-label="State" value={state} onChange={(e) => set('state', e.target.value)}>
              <option value="">All states</option>
              {['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select aria-label="Status" value={status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Sitting & challengers</option>
              <option value="incumbent">Sitting members</option>
              <option value="challenger">Challengers</option>
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value)}>
              <option value="">Sort: default</option>
              <option value="margin">Sort: safest seat</option>
              <option value="name">Sort: surname</option>
            </select>
          </div>
          <p className="cd-muted cd-count" aria-live="polite">{auList.length} people · Victorian nominations as at {VIC_ASAT} (not final)</p>
          <ul className="cd-grid">
            {auList.slice(0, 300).map((c) => { const ph = auPhoto(c.name); return (
              <li key={c.id}>
                <Link to={`/candidate/${c.id}`} className="cd-card" style={{ ['--pc' as string]: c.color }}>
                  <span className="pt-avatar" style={{ width: 56, height: 56, fontSize: 20, borderColor: c.color, background: `radial-gradient(circle at 30% 25%, ${c.color}, #05070d 85%)` }} aria-hidden="true" title={ph?.credit}>
                    {ph ? <img src={ph.thumbUrl} alt="" width={56} height={56} loading="lazy" /> : c.name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 1).join('') + (c.name.split(/\s+/).slice(-1)[0]?.[0] ?? '')}
                  </span>
                  <div className="cd-card__body">
                    <b className="cd-card__name">{c.name}</b>
                    <span className="cd-card__sub">
                      <span className="cd-pp">{c.party}</span> {c.office === 'vic' ? `Vic · ${c.seat}` : c.office === 'au-senate' ? `Senator · ${c.state}` : `MP · ${c.seat}`}
                      {c.incumbent && <span className="cd-inc">Sitting</span>}
                    </span>
                    {c.margin != null && <span className="cd-card__meta">Seat margin <span className="mono">{c.margin.toFixed(1)}</span></span>}
                  </div>
                </Link>
              </li>
            ); })}
          </ul>
          {auList.length > 300 && <p className="cd-muted">Showing 300 of {auList.length} — narrow with the filters.</p>}
        </>
      ) : (
      <>
      <div className="cd-filters" role="search">
        <input
          type="search"
          className="cd-input"
          placeholder="Search name, state or race…"
          aria-label="Search candidates"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <select aria-label="Party" value={party} onChange={(e) => set('party', e.target.value)}>
          <option value="">All parties</option>
          {(['D', 'R', 'I'] as Party[]).map((p) => (
            <option key={p} value={p}>
              {PARTY_NAME[p]}
            </option>
          ))}
          <option value="O">Other / third party</option>
        </select>
        <select aria-label="Office" value={office} onChange={(e) => set('office', e.target.value)}>
          <option value="">All offices</option>
          <option value="senate">Senate</option>
          <option value="governor">Governor</option>
          <option value="house">House (key races)</option>
        </select>
        <select aria-label="State" value={state} onChange={(e) => set('state', e.target.value)}>
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s} value={s}>
              {STATES.find((x) => x.abbr === s)?.name ?? s}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => set('status', e.target.value)}>
          <option value="">Incumbents & challengers</option>
          <option value="incumbent">Incumbents</option>
          <option value="challenger">Challengers</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => set('sort', e.target.value)}>
          <option value="">Sort: by race</option>
          <option value="money">Sort: most raised (FEC)</option>
          <option value="margin">Sort: biggest margin</option>
          <option value="close">Sort: closest margin</option>
          <option value="name">Sort: surname</option>
        </select>
        <div className="cd-seg" role="group" aria-label="Result">
          {[
            ['', 'All'],
            ['won', 'Won'],
            ['lost', 'Lost'],
            ['uncalled', 'Uncalled'],
          ].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={res === v} className={res === v ? 'is-on' : ''} onClick={() => set('result', v)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <p className="cd-muted cd-count" aria-live="polite">
        {list.length} candidate{list.length === 1 ? '' : 's'}
      </p>

      {list.length === 0 ? (
        <p className="cd-empty">No candidates match these filters.</p>
      ) : (
        <ul className="cd-grid">
          {list.map((e) => (
            <li key={e.cand.id}>
              <Link to={`/candidate/${e.cand.id}`} className={`cd-card cd-card--${e.outcome}`} style={{ ['--pc' as string]: PARTY_HEX[e.cand.party] }}>
                <Avatar name={e.cand.name} party={e.cand.party} src={e.cand.photo} size={64} />
                <div className="cd-card__body">
                  <b className="cd-card__name">{e.cand.name}</b>
                  <span className="cd-card__sub">
                    <span className="cd-pp">{e.cand.party}</span> {officeLabel(e.race)} · {e.race.state}
                    {e.cand.incumbent && <span className="cd-inc">Incumbent</span>}
                  </span>
                  <OutcomeTag e={e} />
                  <CardMeta e={e} raised={money.byId.get(e.cand.id)?.receipts} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </div>
  );
}
