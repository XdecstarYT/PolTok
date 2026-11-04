import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Avatar, SimBadge } from '../../components';
import { STATES } from '../../data';
import { PARTY_HEX, PARTY_NAME } from '../../lib/format';
import type { Party } from '../../types';
import { type CandEntry, type Office, officeLabel, useCandidates } from './data';
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

export default function CandidatesIndex() {
  const all = useCandidates();
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '';
  const party = sp.get('party') ?? '';
  const office = (sp.get('office') ?? '') as Office | '';
  const state = sp.get('state') ?? '';
  const res = sp.get('result') ?? '';
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
        if (needle) {
          const st = STATES.find((s) => s.abbr === e.race.state)?.name ?? '';
          const hay = `${e.cand.name} ${e.race.title} ${e.race.id} ${st}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => ord[a.race.chamber] - ord[b.race.chamber] || a.race.id.localeCompare(b.race.id) || b.votes - a.votes);
  }, [all, q, party, office, state, res]);

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
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
