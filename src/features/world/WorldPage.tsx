/**
 * /world — global elections hub: world map by days-until-election, "this week" strip,
 * chronological timeline (last ~3 months → next 12 months), region/type filters and a
 * country drawer with the Wikipedia summary + live headlines. Data: /api/world (Wikipedia).
 */
import { useEffect, useMemo, useState } from 'react';
import LatestResults from './LatestResults';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { PageHeader, Sheet } from '../../components';
import { useLive } from '../../lib/live';
import { useNavigate } from 'react-router-dom';
import { COUNTRY_CODES, TYPE_LABEL, atlasName, daysUntil, fmtDate, newsTerms, relDays, todayUTC, useSummary, useWorldElections, type ElectionType, type WorldElection } from './data';
import './world.css';

const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json';
const REGIONS = ['All', 'Africa', 'Americas', 'Asia', 'Europe', 'Middle East', 'Oceania'];
const TYPES: ('all' | ElectionType)[] = ['all', 'presidential', 'legislative', 'general', 'referendum'];
const BINS = [
  { max: 7, label: '≤ 1 week', cls: 'b0' },
  { max: 30, label: '≤ 1 month', cls: 'b1' },
  { max: 90, label: '≤ 3 months', cls: 'b2' },
  { max: 180, label: '≤ 6 months', cls: 'b3' },
  { max: 400, label: '≤ 13 months', cls: 'b4' },
];
const binOf = (d: number | null) => (d == null ? 'tba' : d < 0 ? 'past' : BINS.find((b) => d <= b.max)?.cls || 'tba');

let atlasP: Promise<Feature<Geometry, { name: string }>[]> | null = null;
function useAtlas() {
  const [f, setF] = useState<Feature<Geometry, { name: string }>[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    atlasP ||= fetch(ATLAS_URL)
      .then((r) => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((t: any) => (feature(t, t.objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>).features.filter((x) => x.properties.name !== 'Antarctica'));
    atlasP.then(setF).catch(() => {
      atlasP = null;
      setErr(true);
    });
  }, []);
  return { features: f, err };
}

export default function WorldPage() {
  const data = useWorldElections();
  const { features, err } = useAtlas();
  const { news } = useLive();
  const nav = useNavigate();
  const [region, setRegion] = useState('All');
  const [type, setType] = useState<'all' | ElectionType>('all');
  const [indirect, setIndirect] = useState(false);
  const [country, setCountry] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const today = todayUTC();

  useEffect(() => {
    document.title = 'World elections — PolTok';
  }, []);

  const inWindow = (e: WorldElection) => {
    const d = daysUntil(e.date, today);
    return d == null || (d >= -92 && d <= 380);
  };
  const filtered = useMemo(
    () =>
      (data?.elections || []).filter(
        (e) => inWindow(e) && (region === 'All' || e.region === region) && (type === 'all' || e.type === type) && (indirect || !e.indirect),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, region, type, indirect, today],
  );

  /** per country: nearest upcoming dated election, else most recent past */
  const byCountry = useMemo(() => {
    const m = new Map<string, { e: WorldElection; d: number | null }>();
    for (const e of filtered) {
      const d = daysUntil(e.date, today);
      const k = atlasName(e.country);
      const cur = m.get(k);
      const score = (x: number | null) => (x == null ? 1e6 : x >= 0 ? x : 1e5 - x);
      if (!cur || score(d) < score(cur.d)) m.set(k, { e, d });
    }
    return m;
  }, [filtered, today]);

  const { paths } = useMemo(() => {
    if (!features) return { paths: [] as { name: string; d: string }[] };
    const proj = geoNaturalEarth1().fitExtent([[4, 4], [956, 496]], { type: 'FeatureCollection', features } as FeatureCollection);
    const gp = geoPath(proj);
    return { paths: features.map((f) => ({ name: f.properties.name, d: gp(f) || '' })) };
  }, [features]);

  const thisWeek = filtered.filter((e) => {
    const d = daysUntil(e.date, today);
    return d != null && !e.approx && d >= -3 && d <= 7;
  }).sort((a, b) => (a.date! < b.date! ? -1 : 1));

  const groups = useMemo(() => {
    const g = new Map<string, WorldElection[]>();
    const sorted = [...filtered].sort((a, b) => (a.date || '9999') .localeCompare(b.date || '9999'));
    for (const e of sorted) {
      const k = e.date ? new Date(e.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }) : 'Date not yet set';
      (g.get(k) || g.set(k, []).get(k)!).push(e);
    }
    return [...g.entries()];
  }, [filtered]);

  const recent = (data?.elections || [])
    .filter((e) => { const d = daysUntil(e.date, today); return d != null && d <= 0 && d >= -45 && !!e.article && !e.indirect && !e.approx; })
    .sort((a, b) => (a.date! < b.date! ? 1 : -1))
    .slice(0, 9);

  const upcoming = filtered.filter((e) => (daysUntil(e.date, today) ?? -1) >= 0).length;
  const hov = hover ? byCountry.get(hover) : undefined;

  return (
    <div className="page wd">
      <PageHeader
        kicker="Global elections hub"
        title="World elections"
        crumbLabel="World"
        sub={<>National elections and referendums from the last 3 months and the next 12 — {upcoming} upcoming in view.</>}
        aside={<>
        {data && (
          <div className="wd-src">
            <span className={`wd-pill ${data.live ? 'is-live' : ''}`}>{data.live ? (data.stale ? 'CACHED' : 'LIVE SOURCE') : 'SNAPSHOT'}</span>
            Source:{' '}
            {data.source.urls.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer">
                {i ? ', ' : ''}Wikipedia {u.match(/(\d{4})/)?.[1]} calendar
              </a>
            ))}{' '}
            ({data.source.license}) · {data.live ? `fetched ${new Date(data.fetchedAt).toLocaleString()}` : `as of ${data.asOf}`}
            {data.notes.map((n) => (
              <div key={n} className="wd-note">{n}</div>
            ))}
          </div>
        )}
        </>}
      />

      <LatestResults elections={recent} />

      <section className="wd-week" aria-label="This week">
        <h2 className="wd-h2">This week</h2>
        {!data ? (
          <div className="wd-muted">Loading…</div>
        ) : thisWeek.length ? (
          <div className="wd-week__row">
            {thisWeek.map((e) => {
              const d = daysUntil(e.date, today)!;
              return (
                <button type="button" key={e.id} className={`wd-wk ${d < 0 ? 'is-past' : d === 0 ? 'is-today' : ''}`} onClick={() => setCountry(e.country)}>
                  <span className="wd-wk__when">{relDays(d)}</span>
                  <span className="wd-wk__c">{e.country}</span>
                  <span className="wd-wk__o">{e.office}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="wd-muted">No national votes in the next 7 days for these filters.</div>
        )}
      </section>

      <div className="wd-filters" role="group" aria-label="Filters">
        <div className="wd-chips">
          {REGIONS.map((r) => (
            <button type="button" key={r} className={`wd-chip ${region === r ? 'is-on' : ''}`} aria-pressed={region === r} onClick={() => setRegion(r)}>
              {r}
            </button>
          ))}
        </div>
        <div className="wd-chips">
          {TYPES.map((t) => (
            <button type="button" key={t} className={`wd-chip ${type === t ? 'is-on' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>
              {t === 'all' ? 'All types' : TYPE_LABEL[t]}
            </button>
          ))}
          <label className="wd-chk">
            <input type="checkbox" checked={indirect} onChange={(e) => setIndirect(e.target.checked)} /> Indirect (parliament-elected)
          </label>
        </div>
      </div>

      <section className="wd-mapwrap">
        {err ? (
          <div className="wd-muted">World map could not load (cdn.jsdelivr.net). The timeline below has every election.</div>
        ) : !features ? (
          <div className="wd-muted wd-mapph">Loading map…</div>
        ) : (
          <svg viewBox="0 0 960 500" className="wd-map" role="img" aria-label="World map coloured by days until next national election">
            {paths.map((p) => {
              const hit = byCountry.get(p.name);
              const prof = COUNTRY_CODES[p.name];
              const open = () => (prof ? nav(`/country/${prof}`) : hit && setCountry(hit.e.country));
              return (
                <path
                  key={p.name}
                  d={p.d}
                  className={`wd-cty ${prof ? 'is-prof' : ''} ${hit ? `is-${binOf(hit.d)} is-hit` : ''} ${hit && country && atlasName(country) === p.name ? 'is-sel' : ''}`}
                  onMouseEnter={() => setHover(p.name)}
                  onMouseLeave={() => setHover((h) => (h === p.name ? null : h))}
                  onClick={open}
                  tabIndex={hit || prof ? 0 : -1}
                  onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && open()}
                  aria-label={hit ? `${hit.e.country}: ${hit.e.office}, ${fmtDate(hit.e)}` : undefined}
                >
                  <title>{hit ? `${hit.e.country} — ${hit.e.office} · ${fmtDate(hit.e)} (${relDays(hit.d)})` : p.name}</title>
                </path>
              );
            })}
          </svg>
        )}
        <div className="wd-legend">
          {BINS.map((b) => (
            <span key={b.cls}><i className={`wd-sw is-${b.cls}`} />{b.label}</span>
          ))}
          <span><i className="wd-sw is-tba" />Date TBA</span>
          <span><i className="wd-sw is-past" />Held (last 3 mo.)</span>
          {hov && <span className="wd-hov">{hov.e.country}: {hov.e.office} · {relDays(hov.d)}</span>}
        </div>
      </section>

      <section aria-label="Timeline">
        <h2 className="wd-h2">Timeline</h2>
        {!data && <div className="wd-muted">Loading elections…</div>}
        {data && !filtered.length && <div className="wd-muted">No elections match these filters.</div>}
        <ol className="wd-tl">
          {groups.map(([month, list]) => (
            <li key={month} className="wd-tl__m">
              <h3 className="wd-tl__mh">{month}</h3>
              <ul>
                {list.map((e) => {
                  const d = daysUntil(e.date, today);
                  return (
                    <li key={e.id}>
                      <button type="button" className={`wd-row ${d != null && d < 0 ? 'is-past' : ''}`} onClick={() => setCountry(e.country)}>
                        <span className="wd-row__date">{e.date && !e.approx ? e.dateLabel : e.approx && e.date ? 'TBA' : '—'}</span>
                        <span className="wd-row__c">
                          {e.country}
                          {e.dependent && <em className="wd-tag">territory</em>}
                        </span>
                        <span className="wd-row__o">{e.office}</span>
                        <span className={`wd-type t-${e.type}`}>{e.indirect ? 'Indirect' : TYPE_LABEL[e.type]}</span>
                        <span className="wd-row__rel">{d != null && d < 0 ? 'Held' : relDays(e.approx ? null : d)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <Sheet open={!!country} onClose={() => setCountry(null)} title={country || ''}>
        {country && data && <CountryDrawer country={country} all={data.elections} news={news} />}
      </Sheet>
    </div>
  );
}

function CountryDrawer({ country, all, news }: { country: string; all: WorldElection[]; news: ReturnType<typeof useLive>['news'] }) {
  const today = todayUTC();
  const list = all.filter((e) => e.country === country).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
  const pick = list.find((e) => (daysUntil(e.date, today) ?? 1) >= -92) || list[0];
  const [sel, setSel] = useState(pick?.id);
  const cur = list.find((e) => e.id === sel) || pick;
  const sum = useSummary(cur?.article);
  const terms = newsTerms(country).map((t) => t.toLowerCase());
  const heads = news.filter((n) => terms.some((t) => `${n.title} ${n.summary || ''}`.toLowerCase().includes(t))).slice(0, 8);

  return (
    <div className="wd-dr">
      <div className="wd-dr__list">
        {list.map((e) => {
          const d = daysUntil(e.date, today);
          return (
            <button type="button" key={e.id} className={`wd-dr__el ${e.id === cur?.id ? 'is-on' : ''}`} onClick={() => setSel(e.id)}>
              <b>{e.office}</b>
              <span>{fmtDate(e)} · {d != null && d < 0 ? 'held' : relDays(e.approx ? null : d)}{e.indirect ? ' · indirect' : ''}</span>
            </button>
          );
        })}
      </div>
      {cur && (
        <div className="wd-dr__sum">
          <h3 className="wd-h3">{cur.article || cur.office}</h3>
          {sum === undefined ? (
            <div className="wd-muted">Loading summary from Wikipedia…</div>
          ) : sum?.extract ? (
            <>
              <p>{sum.extract}</p>
              <div className="wd-muted">
                Wikipedia summary{sum.updated ? `, revised ${new Date(sum.updated).toLocaleDateString()}` : ''} ·{' '}
                <a href={sum.url} target="_blank" rel="noreferrer">Full article, candidates &amp; results ↗</a>
              </div>
            </>
          ) : (
            <div className="wd-muted">
              No summary available.{' '}
              {cur.articleUrl && <a href={cur.articleUrl} target="_blank" rel="noreferrer">Open on Wikipedia ↗</a>}
            </div>
          )}
        </div>
      )}
      {COUNTRY_CODES[country] && (
        <p>
          <a href={`/country/${COUNTRY_CODES[country]}`}>Open the {country} country page — leaders, parliament, news &amp; markets →</a>
        </p>
      )}
      <h3 className="wd-h3">Headlines mentioning {country}</h3>
      {heads.length ? (
        <ul className="wd-news">
          {heads.map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
              <span className="wd-muted"> — {n.source}, {new Date(n.publishedAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="wd-muted">No matching headlines in PolTok's live news feed right now (feed is US/AU-focused).</div>
      )}
    </div>
  );
}
