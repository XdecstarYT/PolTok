/**
 * /country/:code — profile for ~40 major democracies.
 * Heads of government/state (Wikidata), lower-house composition (Wikipedia infobox, seat total from
 * Wikidata) drawn as a hemicycle, next/last national election (/api/world/elections), country-tagged
 * international news (/api/world/news) and Polymarket markets naming the country. All cited.
 */
import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { COUNTRY_CODES, daysUntil, fmtDate, relDays, todayUTC, useCountryProfile, useWorldElections, useWorldNews, type Party } from './data';
import './world.css';

const PALETTE = ['#6b7280', '#9ca3af', '#4b5563', '#a1a1aa', '#71717a'];

/** Classic parliament hemicycle: seats laid out in concentric rows, filled party by party left→right. */
function Hemicycle({ parties, total }: { parties: Party[]; total: number }) {
  const seats = useMemo(() => {
    const n = Math.max(total, 1);
    const rows = Math.max(3, Math.min(14, Math.round(Math.sqrt(n / 2.2))));
    const r0 = 0.38;
    const radii = Array.from({ length: rows }, (_, i) => r0 + ((1 - r0) * i) / Math.max(rows - 1, 1));
    const sumR = radii.reduce((a, b) => a + b, 0);
    const per = radii.map((r) => Math.round((n * r) / sumR));
    per[rows - 1] += n - per.reduce((a, b) => a + b, 0);
    const pts: { x: number; y: number; a: number }[] = [];
    radii.forEach((r, i) => {
      const k = per[i];
      for (let j = 0; j < k; j++) {
        const a = Math.PI - (k === 1 ? Math.PI / 2 : (Math.PI * j) / (k - 1));
        pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), a });
      }
    });
    pts.sort((p, q) => q.a - p.a);
    const dotR = Math.min(0.045, (0.62 / rows) * 0.42);
    const colors: string[] = [];
    parties.forEach((p, i) => {
      for (let s = 0; s < p.seats; s++) colors.push(p.color || PALETTE[i % PALETTE.length]);
    });
    return pts.map((p, i) => ({ ...p, c: colors[i] || 'var(--line-3)', r: dotR }));
  }, [parties, total]);
  return (
    <svg viewBox="-1.05 -1.05 2.1 1.12" className="cp-hemi" role="img" aria-label={`Hemicycle: ${parties.map((p) => `${p.name} ${p.seats}`).join(', ')}`}>
      <g transform="scale(1,-1)">
        {seats.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} />
        ))}
      </g>
      <text x="0" y="-0.04" textAnchor="middle" className="cp-hemi__n">{total}</text>
    </svg>
  );
}

const fmtVol = (v: number) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`);
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default function CountryPage() {
  const { code: raw = '' } = useParams();
  const code = raw.toUpperCase();
  const prof = useCountryProfile(code);
  const news = useWorldNews(code);
  const world = useWorldElections();
  const p = prof.data;
  const name = p?.name || Object.keys(COUNTRY_CODES).find((k) => COUNTRY_CODES[k] === code) || code;

  useEffect(() => {
    document.title = `${name} — PolTok`;
  }, [name]);

  const today = todayUTC();
  const els = useMemo(() => {
    const list = (world?.elections || []).filter((e) => COUNTRY_CODES[e.country] === code && !e.dependent);
    const withD = list.map((e) => ({ e, d: daysUntil(e.date, today) }));
    const next = withD.filter((x) => x.d == null || x.d >= 0).sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9))[0];
    const last = withD.filter((x) => x.d != null && x.d < 0).sort((a, b) => (b.d ?? 0) - (a.d ?? 0))[0];
    return { next, last };
  }, [world, code, today]);

  const L = p?.legislature;
  const total = L ? L.totalSeats || L.parties.reduce((a, x) => a + x.seats, 0) : 0;
  const ordered = useMemo(() => [...(L?.parties || [])].sort((a, b) => b.seats - a.seats), [L]);
  const majority = total ? Math.floor(total / 2) + 1 : 0;

  return (
    <div className="wd cp">
      <div className="wd-head">
        <div>
          <div className="wd-kicker"><Link to="/world">World</Link> · {code}</div>
          <h1 className="wd-title">{name}</h1>
          <p className="wd-sub">Government, parliament, elections, news &amp; markets</p>
        </div>
      </div>

      {prof.err && <div className="wd-note">Country profile unavailable ({prof.err}). {prof.err.includes('404') ? 'Not one of the ~40 profiled countries.' : ''}</div>}
      {prof.loading && <div className="wd-muted">Loading Wikidata &amp; Wikipedia…</div>}

      {p && (
        <section className="cp-grid">
          {[p.headOfGovernment, p.headOfState].map((h, i) =>
            h ? (
              <div className="cp-card" key={i}>
                <div className="cp-card__k">{i === 0 ? 'Head of government' : 'Head of state'}</div>
                <div className="cp-card__office">{h.office}</div>
                {h.check === 'disagree' && (
                  <div className="cp-card__flag" title={h.note}>
                    Unverified — sources disagree
                  </div>
                )}
                {h.people.length ? (
                  h.people.map((x) => (
                    <a
                      key={x.qid || x.name}
                      className="cp-card__name"
                      href={x.qid ? `https://www.wikidata.org/wiki/${x.qid}` : x.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {x.name}
                      {h.check === 'disagree' && <span className="wd-muted"> ({x.source === 'wikipedia' ? 'per Wikipedia infobox' : 'per Wikidata'})</span>}
                    </a>
                  ))
                ) : (
                  <div className="wd-muted">Not listed on Wikidata</div>
                )}
              </div>
            ) : null,
          )}
          <div className="cp-card">
            <div className="cp-card__k">Next national election</div>
            {els.next ? (
              <>
                <div className="cp-card__name">{fmtDate(els.next.e)}</div>
                <div className="cp-card__office">{els.next.e.office} · {relDays(els.next.e.approx ? null : els.next.d)}</div>
              </>
            ) : (
              <div className="wd-muted">None scheduled in this/next year's Wikipedia calendar</div>
            )}
            {els.last && (
              <div className="wd-muted" style={{ marginTop: 6 }}>
                Last: {els.last.e.office}, {fmtDate(els.last.e)}
                {els.last.e.articleUrl && <> · <a href={els.last.e.articleUrl} target="_blank" rel="noreferrer">results ↗</a></>}
              </div>
            )}
          </div>
        </section>
      )}

      {L && (
        <section className="cp-leg">
          <h2 className="wd-h2">
            {L.chamber} <span className="wd-muted">· {total} seats{majority ? ` · majority ${majority}` : ''}</span>
          </h2>
          {L.uncertain && (
            <div className="wd-note">
              ⚠ Uncertain: {L.parties.length ? 'parsed party seats do not match the official seat total' : 'party composition could not be parsed'} — verify on{' '}
              <a href={L.url} target="_blank" rel="noreferrer">Wikipedia</a>.
            </div>
          )}
          {L.parties.length > 0 && (
            <div className="cp-leg__body">
              <Hemicycle parties={L.parties} total={total} />
              <ul className="cp-legend">
                {ordered.map((x) => (
                  <li key={x.name}>
                    <i style={{ background: x.color || 'var(--line-3)' }} />
                    <span>{x.name}</span>
                    <b className="num">{x.seats}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="wd-muted">
            Composition: <a href={L.url} target="_blank" rel="noreferrer">Wikipedia infobox</a>
            {L.revid ? ` (rev ${L.revid})` : ''}; seat total &amp; office holders: <a href={p?.qid ? `https://www.wikidata.org/wiki/${p.qid}` : 'https://www.wikidata.org'} target="_blank" rel="noreferrer">Wikidata</a>.
            {p?.stale ? ' Showing cached copy.' : ''} Fetched {p ? new Date(p.fetchedAt).toLocaleString() : ''}.
          </div>
          {p?.notes.map((n) => <div key={n} className="wd-muted">{n}</div>)}
        </section>
      )}

      <section>
        <h2 className="wd-h2">Latest news</h2>
        {news.loading && <div className="wd-muted">Loading headlines…</div>}
        {news.err && <div className="wd-muted">News unavailable ({news.err}).</div>}
        {news.data && !news.data.items.length && <div className="wd-muted">No recent headlines tagged {name} from the international feeds.</div>}
        <ul className="wd-news cp-news">
          {news.data?.items.map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
              <span className="wd-muted"> · {n.source}{n.sourceLean !== 'Unrated' ? ` (${n.sourceLean})` : ''} · {ago(n.publishedAt)}</span>
            </li>
          ))}
        </ul>
        {news.data && <div className="wd-muted">{news.data.note} {news.data.sources.filter((s) => s.ok).length}/{news.data.sources.length} feeds up.</div>}
      </section>

      <section>
        <h2 className="wd-h2">Prediction markets</h2>
        {p && !p.marketsOk && <div className="wd-muted">Polymarket unavailable right now.</div>}
        {p && p.marketsOk && !p.markets.length && <div className="wd-muted">No active Polymarket events mention {name}.</div>}
        <div className="cp-mk">
          {p?.markets.map((m) => (
            <a key={m.url} className="cp-card cp-mk__ev" href={m.url} target="_blank" rel="noreferrer">
              <div className="cp-card__office">{m.title}</div>
              {m.markets.map((x) => (
                <div key={x.label} className="cp-mk__row">
                  <span>{x.label}</span>
                  <b className="num">{Math.round(x.yes * 100)}%</b>
                </div>
              ))}
              <div className="wd-muted">Vol {fmtVol(m.volume)} · Polymarket ↗</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
