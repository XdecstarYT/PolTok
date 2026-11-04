/**
 * Live county-level results map for a statewide race (Senate / Governor).
 * Data: the NYT per-race results JSON (AP county counts, CORS-enabled), refreshed every 60s.
 * Geometry: us-atlas counties-10m (lazy-loaded). Color = leading party, intensity = margin,
 * hatched/dim = nothing counted yet.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Race, StateInfo } from '../../types';
import { PARTY_HEX, fmtInt, mixHex } from '../../lib/format';
import { fmtET } from '../../components';

const BASE = 'https://static01.nyt.com/elections-assets/pages/data/2026-11-03';
const W = 640;
const H = 420;

type County = { fips: string; name: string; eevp: number; total: number; votes: { name: string; party: string; v: number }[] };
type Shape = { fips: string; d: string };

let countiesTopo: Promise<Topology<{ counties: GeometryCollection }>> | null = null;
const loadCounties = () => (countiesTopo ??= import('us-atlas/counties-10m.json').then((m) => (m.default ?? m) as unknown as Topology<{ counties: GeometryCollection }>));

const PARTY = { DEM: 'D', GOP: 'R', IND: 'I' } as Record<string, string>;

/** "https://www.nytimes.com/interactive/2026/11/03/us/elections/results-iowa-us-senate.html" → JSON URL */
export function countyDataUrl(sourceUrl?: string, race?: Race, st?: StateInfo): string | null {
  const m = sourceUrl?.match(/\/(results-[a-z0-9-]+)\.html/);
  if (m) return `${BASE}/${m[1]}.json`;
  if (!race || !st || race.chamber === 'house') return null;
  const slug = st.name.toLowerCase().replace(/\s+/g, '-');
  return `${BASE}/results-${slug}-${race.chamber === 'senate' ? 'us-senate' : 'governor'}.json`;
}

function parse(doc: { races?: { race_type_id?: string; candidate_metadata?: Record<string, { last_name?: string; first_name?: string; party?: { nyt_id?: string } }>; reporting_units?: { level: string; fips_state?: string; fips_county?: string; name: string; eevp?: number; total_votes?: number; candidates?: { nyt_id: string; votes?: { total?: number } }[] }[] }[] }, special?: boolean) {
  const races = doc.races ?? [];
  const r = (special ? races.find((x) => x.race_type_id === 'W') : races.find((x) => x.race_type_id !== 'W')) ?? races[0];
  if (!r) return { counties: [] as County[], updated: 0 };
  const meta = r.candidate_metadata ?? {};
  const counties: County[] = [];
  for (const u of r.reporting_units ?? []) {
    if (u.level !== 'county' || !u.fips_state || !u.fips_county) continue;
    const votes = (u.candidates ?? [])
      .filter((c) => !/write/i.test(c.nyt_id))
      .map((c) => {
        const m = meta[c.nyt_id] ?? {};
        return { name: [m.first_name, m.last_name].filter(Boolean).join(' ') || c.nyt_id, party: PARTY[m.party?.nyt_id ?? ''] ?? 'O', v: c.votes?.total ?? 0 };
      })
      .sort((a, b) => b.v - a.v);
    counties.push({ fips: u.fips_state + u.fips_county, name: u.name, eevp: u.eevp ?? 0, total: u.total_votes ?? votes.reduce((a, b) => a + b.v, 0), votes });
  }
  return { counties, updated: Date.now() };
}

function colorFor(c: County | undefined): string {
  if (!c || !c.total) return '#1a1e2b';
  const [a, b] = c.votes;
  const margin = (a.v - (b?.v ?? 0)) / c.total; // 0..1
  const base = (PARTY_HEX as Record<string, string>)[a.party] ?? '#8b93a7';
  return mixHex('#232838', base, Math.min(1, 0.35 + margin * 2.2));
}

export function CountyMap({ race, st, sourceUrl }: { race: Race; st: StateInfo; sourceUrl?: string }) {
  const url = countyDataUrl(sourceUrl, race, st);
  const [shapes, setShapes] = useState<Shape[] | null>(null);
  const [data, setData] = useState<{ counties: County[]; updated: number } | null>(null);
  const [err, setErr] = useState(false);
  const [hover, setHover] = useState<{ fips: string; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Geometry for this state's counties.
  useEffect(() => {
    let alive = true;
    loadCounties().then((topo) => {
      const fc = feature(topo, topo.objects.counties) as FeatureCollection<Geometry>;
      const mine = fc.features.filter((f) => String(f.id).slice(0, 2) === st.fips);
      if (!mine.length) return alive && setShapes([]);
      const coll: FeatureCollection = { type: 'FeatureCollection', features: mine as Feature[] };
      const path = geoPath(geoAlbersUsa().fitExtent([[6, 6], [W - 6, H - 6]], coll));
      if (alive) setShapes(mine.map((f) => ({ fips: String(f.id), d: path(f as Feature) ?? '' })));
    });
    return () => {
      alive = false;
    };
  }, [st.fips]);

  // Live county results, refreshed every minute.
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const load = () =>
      fetch(url, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((doc) => alive && (setData(parse(doc, race.special)), setErr(false)))
        .catch(() => alive && setErr(true));
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, race.special]);

  const byFips = useMemo(() => new Map((data?.counties ?? []).map((c) => [c.fips, c])), [data]);
  const reporting = data?.counties.filter((c) => c.total > 0).length ?? 0;
  const hc = hover ? byFips.get(hover.fips) : undefined;

  if (!url) return null;

  return (
    <div className="cm" ref={box}>
      <div className="cm__meta">
        <span>
          <b className="num">{reporting}</b> of <b className="num">{data?.counties.length || '—'}</b> counties reporting
        </span>
        <span className="cm__legend" aria-hidden="true">
          <i style={{ background: PARTY_HEX.D }} /> Dem lead <i style={{ background: PARTY_HEX.R }} /> Rep lead <i style={{ background: '#1a1e2b' }} /> No votes yet
        </span>
      </div>
      {!shapes ? (
        <div className="cm__skel skeleton" style={{ aspectRatio: `${W}/${H}` }} />
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="cm__svg"
          role="img"
          aria-label={`${st.name} results by county: ${reporting} counties reporting`}
          onPointerLeave={() => setHover(null)}
        >
          {shapes.map((s) => {
            const c = byFips.get(s.fips);
            return (
              <path
                key={s.fips}
                d={s.d}
                className={`cm__c ${hover?.fips === s.fips ? 'is-hover' : ''}`}
                style={{ fill: colorFor(c), opacity: c && c.total ? 0.55 + 0.45 * Math.min(1, c.eevp / 100) : 1 }}
                onPointerMove={(e) => {
                  const r = box.current?.getBoundingClientRect();
                  if (r) setHover({ fips: s.fips, x: e.clientX - r.left, y: e.clientY - r.top });
                }}
              />
            );
          })}
        </svg>
      )}
      {hover && (
        <div className="cm__tip" style={{ left: Math.min(hover.x + 14, (box.current?.clientWidth ?? 300) - 220), top: hover.y + 14 }}>
          <b>{hc?.name ?? 'County'}</b>
          {hc && hc.total > 0 ? (
            <>
              {hc.votes.slice(0, 3).map((v) => (
                <div key={v.name} className="cm__row">
                  <i style={{ background: (PARTY_HEX as Record<string, string>)[v.party] ?? '#8b93a7' }} />
                  <span>{v.name}</span>
                  <span className="num">{((v.v / hc.total) * 100).toFixed(1)}%</span>
                </div>
              ))}
              <div className="cm__foot num">
                {fmtInt(hc.total)} votes · {Math.round(hc.eevp)}% in
              </div>
            </>
          ) : (
            <div className="cm__foot">No votes reported yet</div>
          )}
        </div>
      )}
      <div className="cm__src">
        {err ? 'County feed temporarily unavailable — retrying.' : data ? `AP county results via NYT · updated ${fmtET(data.updated)}` : 'Loading county results…'}
      </div>
    </div>
  );
}
