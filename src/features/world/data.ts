/** /world data layer — fetches /api/world/elections (Wikipedia calendars, cached server-side). */
import { useEffect, useState } from 'react';

export type ElectionType = 'presidential' | 'legislative' | 'general' | 'referendum';
export interface WorldElection {
  id: string;
  country: string;
  region: string;
  office: string;
  type: ElectionType;
  date: string | null;
  dateLabel: string;
  approx: boolean;
  round?: number;
  indirect?: boolean;
  dependent?: boolean;
  article?: string;
  articleUrl?: string;
  year: number;
}
export interface WorldPayload {
  elections: WorldElection[];
  live: boolean;
  asOf: string;
  fetchedAt: number;
  source: { name: string; urls: string[]; license: string };
  notes: string[];
  stale?: boolean;
}
export interface Summary { title: string; extract: string; description: string; url: string; thumbnail?: string; updated?: string }

export const TYPE_LABEL: Record<ElectionType, string> = { presidential: 'Executive', legislative: 'Legislative', general: 'General', referendum: 'Referendum' };

const DAY = 86400e3;
export const todayUTC = () => {
  const d = new Date();
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
export const daysUntil = (iso: string | null, today = todayUTC()) => (iso ? Math.round((Date.parse(iso + 'T00:00:00Z') - today) / DAY) : null);
export const fmtDate = (e: WorldElection) =>
  !e.date ? e.dateLabel : e.approx ? new Date(e.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }) : new Date(e.date + 'T00:00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const relDays = (n: number | null) => (n == null ? 'date TBA' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? `in ${n} days` : `${-n} days ago`);

/** Wikipedia calendar country name → world-atlas 110m `properties.name`. */
const ATLAS: Record<string, string> = {
  'United States': 'United States of America',
  'Czech Republic': 'Czechia',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Republic of the Congo': 'Congo',
  'Central African Republic': 'Central African Rep.',
  'South Sudan': 'S. Sudan',
  'Ivory Coast': "Côte d'Ivoire",
  'Equatorial Guinea': 'Eq. Guinea',
  'Dominican Republic': 'Dominican Rep.',
  'Solomon Islands': 'Solomon Is.',
  Eswatini: 'eSwatini',
  'Northern Cyprus': 'N. Cyprus',
  'North Macedonia': 'Macedonia',
  'East Timor': 'Timor-Leste',
  'Western Sahara': 'W. Sahara',
  'The Gambia': 'Gambia',
};
export const atlasName = (c: string) => ATLAS[c] || c;

/** Extra search terms for headline matching. */
const NEWS_ALIASES: Record<string, string[]> = {
  'United States': ['U.S.', 'US ', 'America'],
  'United Kingdom': ['UK', 'Britain', 'British'],
  'New Zealand': ['NZ ', 'Luxon'],
  'Czech Republic': ['Czech'],
  Israel: ['Israeli', 'Knesset', 'Netanyahu'],
  France: ['French'],
  Spain: ['Spanish'],
  Brazil: ['Brazilian'],
  Germany: ['German'],
  Japan: ['Japanese'],
  Russia: ['Russian', 'Kremlin'],
};
export function newsTerms(country: string) {
  return [country, ...(NEWS_ALIASES[country] || [])];
}

let memo: Promise<WorldPayload> | null = null;
async function load(): Promise<WorldPayload> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch('/api/world/elections', { signal: ctl.signal, headers: { accept: 'application/json' } });
    clearTimeout(t);
    if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error(`HTTP ${r.status}`);
    const j = (await r.json()) as WorldPayload;
    if (!Array.isArray(j.elections) || !j.elections.length) throw new Error('empty');
    return j;
  } catch (e) {
    const fb = (await import('./fallback.json')).default as unknown as WorldPayload;
    return { ...fb, live: false, notes: [`World API unavailable (${(e as Error).message}); bundled snapshot as of ${fb.asOf}.`] };
  }
}
export function useWorldElections() {
  const [data, setData] = useState<WorldPayload | null>(null);
  useEffect(() => {
    let on = true;
    (memo ||= load()).then((d) => on && setData(d));
    return () => {
      on = false;
    };
  }, []);
  return data;
}

const sumCache = new Map<string, Promise<Summary | null>>();
export function useSummary(title?: string) {
  const [s, setS] = useState<Summary | null | undefined>(undefined);
  useEffect(() => {
    if (!title) return setS(null);
    let on = true;
    setS(undefined);
    if (!sumCache.has(title))
      sumCache.set(
        title,
        fetch(`/api/world/summary?title=${encodeURIComponent(title)}`)
          .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
          .catch(() => null),
      );
    sumCache.get(title)!.then((v) => on && setS(v));
    return () => {
      on = false;
    };
  }, [title]);
  return s;
}

/* ------------------------------ country pages (/country/:code) ------------------------------ */
/** The ~40 democracies with /country/:code profiles (mirrors server/countries.js). Name → ISO2. */
export const COUNTRY_CODES: Record<string, string> = {
  'United States': 'US', 'United States of America': 'US', 'United Kingdom': 'GB', Canada: 'CA', Australia: 'AU', 'New Zealand': 'NZ',
  Ireland: 'IE', France: 'FR', Germany: 'DE', Italy: 'IT', Spain: 'ES', Portugal: 'PT', Netherlands: 'NL', Belgium: 'BE',
  Austria: 'AT', Switzerland: 'CH', Sweden: 'SE', Norway: 'NO', Denmark: 'DK', Finland: 'FI', Poland: 'PL',
  'Czech Republic': 'CZ', Czechia: 'CZ', Slovakia: 'SK', Greece: 'GR', Hungary: 'HU', Romania: 'RO', Estonia: 'EE', Ukraine: 'UA',
  Israel: 'IL', Japan: 'JP', 'South Korea': 'KR', Korea: 'KR', Taiwan: 'TW', India: 'IN', Indonesia: 'ID', Philippines: 'PH',
  'South Africa': 'ZA', Brazil: 'BR', Argentina: 'AR', Mexico: 'MX', Chile: 'CL', Colombia: 'CO',
};
export const codeOf = (name: string) => COUNTRY_CODES[name];

export interface Person { qid: string; name: string }
export interface Party { name: string; seats: number; color?: string }
export interface CountryProfile {
  code: string;
  name: string;
  qid?: string;
  headOfGovernment: { office: string; people: Person[] } | null;
  headOfState: { office: string; people: Person[] } | null;
  legislature: { chamber: string; qid?: string; totalSeats: number | null; parties: Party[]; uncertain: boolean; url: string; revid?: number };
  markets: { title: string; url: string; volume: number; endDate: string | null; markets: { label: string; yes: number }[] }[];
  marketsOk: boolean;
  sources: { name: string; url: string }[];
  notes: string[];
  fetchedAt: number;
  stale?: boolean;
}
export interface WorldNewsItem { id: string; title: string; url: string; source: string; sourceLean: string; region: string; publishedAt: number; countries: string[]; summary?: string; clusterId?: string }
export interface WorldNews { items: WorldNewsItem[]; total: number; fetchedAt: number; sources: { name: string; lean: string; region: string; ok: boolean; count: number }[]; note: string }

function useJson<T>(url: string | null) {
  const [s, setS] = useState<{ data: T | null; err: string | null; loading: boolean }>({ data: null, err: null, loading: !!url });
  useEffect(() => {
    if (!url) return;
    let on = true;
    setS({ data: null, err: null, loading: true });
    fetch(url, { headers: { accept: 'application/json' } })
      .then(async (r) => {
        if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as T;
      })
      .then((d) => on && setS({ data: d, err: null, loading: false }))
      .catch((e: Error) => on && setS({ data: null, err: e.message, loading: false }));
    return () => {
      on = false;
    };
  }, [url]);
  return s;
}
export const useCountryProfile = (code: string) => useJson<CountryProfile>(`/api/world/country?code=${encodeURIComponent(code)}`);
export const useWorldNews = (code: string) => useJson<WorldNews>(`/api/world/news?country=${encodeURIComponent(code)}&limit=30`);
