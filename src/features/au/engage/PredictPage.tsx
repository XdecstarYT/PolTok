/** /au/victoria/predict — "Make your calls": pick the 15 closest seats (by the PolTok model) and the overall result before
 *  polls close; on election night every call is scored live against the VEC count, head to head with the model. */
import { useMemo, useState, type CSSProperties } from 'react';
import { m } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PageHeader, useNow } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { PersonAvatar } from '../../../components/PersonAvatar';
import { AuNav } from '../AuNav';
import { useAuResults } from '../api';
import { partyKey } from '../model';
import { VIC_NAME, useVicLive, vicColor } from '../vicLive';
import { personFor, seatById } from '../parliament/people';
import { loadJson, saveJson } from './passport';
import '../au.css';
import '../parliament/profile.css';
import './engage.css';

const LOCK = Date.parse('2026-11-28T18:00:00+11:00');
const KEY = 'poltok.vic.predict';
type Picks = { seats: Record<string, string>; gov?: 'ALP' | 'LNP' | 'hung' };
const grp = (x?: string | null) => { if (!x) return null; const k = partyKey(x); return ['LIB', 'NAT', 'LNP'].includes(k) ? 'LNP' : ['ALP', 'GRN', 'ONP', 'IND'].includes(k) ? k : 'OTH'; };
const pct = (x: number) => (x >= 0.995 ? '>99%' : x <= 0.005 ? '<1%' : `${Math.round(x * 100)}%`);

export default function PredictPage() {
  useSeo({ title: 'Make your calls · Victoria 2026', description: 'Call the 15 closest seats and the overall result before polls close, then get scored live on election night against the PolTok model.' });
  const now = useNow(1000);
  const locked = now >= LOCK;
  const { data } = useVicLive();
  const res = useAuResults('vic2026');
  const [picks, setPicks] = useState<Picks>(() => loadJson(KEY, { seats: {} }));
  const [copied, setCopied] = useState(false);
  const model = data?.model;
  const seats = useMemo(() => {
    if (!model) return [];
    return Object.entries(model.seats)
      .map(([id, s]) => ({ id, s, top: Math.max(...Object.values(s.prob)) }))
      .sort((a, b) => a.top - b.top).slice(0, 15)
      .map(({ id, s }) => ({ id, s, opts: Object.entries(s.prob).filter(([, p]) => p >= 0.05).sort((a, b) => b[1] - a[1]).map(([k]) => k) }));
  }, [model]);
  const set = (p: Picks) => { if (locked) return; setPicks(p); saveJson(KEY, p); };
  const result = (id: string) => { const r = res.data?.seats?.[id]; return r?.called ? grp(r.called) : null; };
  const scored = seats.map((x) => ({ ...x, res: result(x.id), mine: picks.seats[x.id], model: x.s.fav }));
  const settled = scored.filter((x) => x.res);
  const you = settled.filter((x) => x.mine === x.res).length;
  const them = settled.filter((x) => x.model === x.res).length;
  const nPicked = Object.keys(picks.seats).filter((k) => seats.some((s) => s.id === k)).length;
  const left = LOCK - now;
  const share = async () => {
    const text = settled.length ? `I called ${you}/${settled.length} of Victoria's closest seats on PolTok (the model got ${them}). Beat me:` : `My calls for Victoria's 15 closest seats are locked in on PolTok. Make yours before 6pm Saturday:`;
    const url = `${location.origin}/au/victoria/predict`;
    try { if (navigator.share) await navigator.share({ text, url }); else { await navigator.clipboard.writeText(`${text} ${url}`); setCopied(true); } } catch { /* cancelled */ }
  };
  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · Sat 28 Nov" title="Make your calls" crumbLabel="Make your calls"
        sub="The 15 closest seats according to the PolTok model. Pick a winner in each before polls close, then watch your score tick up live on election night.">
        <AuNav />
      </PageHeader>
      <div className="pr-score lg">
        {settled.length ? (
          <>
            <div><span className="pf__kicker">You</span><b className="num">{you}<small>/{settled.length}</small></b></div>
            <div className="pr-vs">v</div>
            <div><span className="pf__kicker">PolTok model</span><b className="num">{them}<small>/{settled.length}</small></b></div>
            <p>{you > them ? '🏆 You\'re beating the model!' : you === them ? '🤝 Neck and neck with the model' : '📉 The model is ahead. For now.'}</p>
          </>
        ) : (
          <>
            <div><span className="pf__kicker">Your calls</span><b className="num">{nPicked}<small>/{seats.length || 15}</small></b></div>
            <div className="pr-lock">{locked ? <><b>🔒 Locked</b><small>Scoring starts as the VEC calls seats</small></> : <><span className="pf__kicker">Locks in</span><b className="num">{Math.floor(left / 864e5) > 0 ? `${Math.floor(left / 864e5)}d ` : ''}{String(Math.floor((left % 864e5) / 36e5)).padStart(2, '0')}:{String(Math.floor((left % 36e5) / 6e4)).padStart(2, '0')}:{String(Math.floor((left % 6e4) / 1e3)).padStart(2, '0')}</b></>}</div>
          </>
        )}
        <button type="button" className="lg-btn" onClick={share} disabled={!nPicked}>{copied ? 'Copied ✓' : '📤 Share'}</button>
      </div>

      <section className="ds__sec lg" style={{ marginBottom: 14 }}>
        <h3 className="ds__h"><span>🏛️</span>Who forms government?</h3>
        <div className="pr-gov">
          {(['LNP', 'ALP', 'hung'] as const).map((k) => (
            <button key={k} type="button" disabled={locked} aria-pressed={picks.gov === k} className="pr-opt" style={{ ['--c' as string]: k === 'hung' ? 'var(--accent)' : vicColor(k) } as CSSProperties} onClick={() => set({ ...picks, gov: k })}>
              <b>{k === 'hung' ? 'Hung parliament' : `${VIC_NAME[k]} majority`}</b>
              {model && <small>Model: {pct(model.majority[k])}</small>}
            </button>
          ))}
        </div>
      </section>

      {!model && <p className="faint">Loading the closest seats…</p>}
      <div className="pr-grid">
        {scored.map((x, i) => {
          const seat = seatById.get(x.id);
          const ok = x.res ? x.mine === x.res : null;
          return (
            <m.article key={x.id} className={`pr-seat lg ${ok === true ? 'is-right' : ok === false ? 'is-wrong' : ''}`} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.06 }}>
              <header><b>{seat?.name ?? x.id}</b><small>{x.s.rating === 'tossup' ? 'Toss-up' : `Leans ${VIC_NAME[x.s.fav] ?? x.s.fav}`}</small>{x.res && <em className="pr-res" style={{ background: vicColor(x.res) }}>{ok ? '✓ ' : ''}{VIC_NAME[x.res] ?? x.res} won</em>}</header>
              <div className="pr-opts">
                {x.opts.map((k) => { const p = personFor(x.id, k, model); return (
                  <button key={k} type="button" disabled={locked} aria-pressed={x.mine === k} className="pr-opt" style={{ ['--c' as string]: vicColor(k) } as CSSProperties} onClick={() => set({ ...picks, seats: { ...picks.seats, [x.id]: k } })}>
                    {p && <PersonAvatar name={p.name} color={vicColor(k)} lookup={{ name: p.name, scope: 'au' }} size={40} />}
                    <span><b>{p?.name ?? VIC_NAME[k]}</b><small>{VIC_NAME[k] ?? k} · model {pct(x.s.prob[k])}</small></span>
                  </button>); })}
              </div>
              <Link className="pr-more" to={`/au/victoria/parliament?seat=${x.id}`}>Seat profile →</Link>
            </m.article>
          );
        })}
      </div>
      <p className="vp-method">Seats are the 15 where the PolTok model's favourite is least certain. Picks lock at 6pm AEDT Saturday and are stored only in this browser. On election night a pick scores once the VEC count has called that seat.</p>
    </div>
  );
}
