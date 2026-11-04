/**
 * Client-side global search: a tiny typo-tolerant scorer (exact > prefix > substring > fuzzy)
 * over pages, US states/races/candidates (live-synced names), AU seats/parties and live news.
 * No dependencies. Index size is a few thousand entries, so a linear scan per keystroke is fine.
 */
import { useMemo } from 'react';
import { RACES, STATES } from '../../data';
import { FEDERAL, VICTORIA, AU_PARTIES } from '../../data/au';
import { useLive } from '../../lib/live';
import { useSettings, TIME_ZONES, type Settings } from '../../lib/settings';
import type { NewsItem, Rating } from '../../types';

export type Kind = 'Action' | 'Page' | 'State' | 'Race' | 'Candidate' | 'AU seat' | 'AU party' | 'News';
export const KINDS: Kind[] = ['Action', 'Page', 'State', 'Race', 'Candidate', 'AU seat', 'AU party', 'News'];
export const KIND_PLURAL: Record<Kind, string> = {
  Action: 'Quick actions', Page: 'Pages', State: 'States', Race: 'Races', Candidate: 'Candidates',
  'AU seat': 'Australian seats', 'AU party': 'Australian parties', News: 'News',
};

export interface Entry {
  id: string;
  kind: Kind;
  label: string;
  sub?: string;
  /** internal route */
  to?: string;
  /** external link (news) */
  href?: string;
  /** quick action */
  run?: () => void;
  rating?: Rating;
  /** extra searchable text (lower weight than label) */
  keys: string;
  boost?: number;
  /** precomputed */
  lt?: string[];
  kt?: string[];
}

export interface Hit {
  e: Entry;
  score: number;
}

export const PAGES: { to: string; label: string; sub: string; keys?: string }[] = [
  { to: '/', label: 'Home', sub: 'Front page · results & what happened', keys: 'front dashboard' },
  { to: '/live', label: 'Live results', sub: 'Election night command center', keys: 'results now' },
  { to: '/map', label: 'Map', sub: 'Electoral & results map' },
  { to: '/map/senate', label: 'Senate map', sub: 'Map · Senate races' },
  { to: '/map/house', label: 'House map', sub: 'Map · House races' },
  { to: '/map/governor', label: 'Governor map', sub: 'Map · Governor races' },
  { to: '/map/pres2024', label: '2024 presidential map', sub: 'Map · baseline', keys: 'trump harris' },
  { to: '/house', label: 'House', sub: 'All 435 districts live', keys: 'districts congress' },
  { to: '/governors', label: 'Governors', sub: 'Governor races & state government', keys: 'trifecta legislature' },
  { to: '/candidates', label: 'Candidates', sub: 'Every candidate on the ballot' },
  { to: '/feed', label: 'PolTok feed', sub: 'Vertical story feed' },
  { to: '/news', label: 'News', sub: 'Aggregated headlines with bias', keys: 'headlines' },
  { to: '/polls', label: 'Polls', sub: 'Generic ballot, approval & race polls', keys: 'polling approval' },
  { to: '/forecast', label: 'Forecast & markets', sub: 'Model & prediction markets', keys: 'odds kalshi polymarket' },
  { to: '/races', label: 'All races', sub: 'Senate, House, Governor' },
  { to: '/replay', label: 'Relive election night', sub: 'Replay race calls & the needle', keys: 'replay' },
  { to: '/analysis', label: 'What happened', sub: 'Swing, polling error, turnout, county shifts', keys: 'analysis' },
  { to: '/flips', label: 'Seats that flipped', sub: 'Seats that changed hands · net gains', keys: 'flips pickups' },
  { to: '/measures', label: 'Ballot measures', sub: 'Statewide ballot measures · live results', keys: 'propositions initiatives' },
  { to: '/compare', label: 'Compare', sub: 'Races side by side, polling miss' },
  { to: '/watch', label: 'Watchlist', sub: 'Your starred races', keys: 'starred favourites favorites' },
  { to: '/au', label: 'Australia', sub: 'Federal parliament, polls, markets, AU news', keys: 'aus federal' },
  { to: '/au/victoria', label: 'Victorian election 2026', sub: 'Australia · 28 Nov results night', keys: 'vic victoria state' },
  { to: '/search', label: 'Search', sub: 'Full search results page' },
];

/* ------------------------------- scoring ------------------------------- */

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokenize = (s: string) => norm(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Bounded Levenshtein (with adjacent transposition); returns max+1 when over the bound. */
function editDist(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

const maxTypos = (len: number) => (len >= 7 ? 2 : len >= 4 ? 1 : 0);

/** Score one query term against one token; 0 = no match. */
function termScore(t: string, tok: string, last: boolean): number {
  if (tok === t) return 10;
  if (tok.startsWith(t)) return 6 + 3 * (t.length / tok.length);
  const k = maxTypos(t.length);
  if (t.length >= 3 && tok.includes(t)) return 3.5;
  if (!k) return 0;
  // whole-token typo, or (for the term being typed) typo within the token's prefix
  const d = editDist(t, tok, k);
  if (d <= k) return 5 - d * 1.5;
  if (last && tok.length > t.length) {
    const dp = Math.min(editDist(t, tok.slice(0, t.length), k), editDist(t, tok.slice(0, t.length + 1), k));
    if (dp <= k) return 3.5 - dp;
  }
  return 0;
}

const best = (t: string, toks: string[], last: boolean) => {
  let b = 0;
  for (const tok of toks) {
    const s = termScore(t, tok, last);
    if (s > b) b = s;
    if (b === 10) break;
  }
  return b;
};

const KIND_BOOST: Record<Kind, number> = { Action: 1, Page: 2, State: 4.5, Race: 2, Candidate: 1.5, 'AU seat': 1, 'AU party': 1, News: -1 };

export function search(entries: Entry[], query: string, limit = 400): Hit[] {
  const nq = norm(query.trim());
  const terms = tokenize(query);
  if (!terms.length) return [];
  const out: Hit[] = [];
  for (const e of entries) {
    const lt = (e.lt ??= tokenize(e.label));
    const kt = (e.kt ??= tokenize(e.keys));
    let s = 0;
    let ok = true;
    for (let i = 0; i < terms.length; i++) {
      const last = i === terms.length - 1;
      const a = best(terms[i], lt, last) * 1.6;
      const b = a >= 16 ? 0 : best(terms[i], kt, last);
      const m = Math.max(a, b);
      if (!m) { ok = false; break; }
      s += m;
    }
    if (!ok) continue;
    const nl = norm(e.label);
    if (nl === nq) s += 25;
    else if (nl.startsWith(nq)) s += 10;
    s += KIND_BOOST[e.kind] + (e.boost ?? 0) - nl.length * 0.03;
    out.push({ e, score: s });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** Split `text` into [plain, match, plain, …] segments for highlighting query terms. */
export function highlightParts(text: string, query: string): { t: string; m: boolean }[] {
  const terms = tokenize(query);
  if (!terms.length) return [{ t: text, m: false }];
  // per-char normalized (keeps index alignment with the original)
  const n = Array.from(text, (ch) => norm(ch)[0] ?? ' ').join('');
  const mark = new Uint8Array(text.length);
  const re = /[a-z0-9]+/g;
  let mt: RegExpExecArray | null;
  while ((mt = re.exec(n))) {
    const tok = mt[0];
    for (const t of terms) {
      let len = 0;
      let off = 0;
      if (tok.startsWith(t)) len = t.length;
      else if (t.length >= 3 && tok.includes(t)) { off = tok.indexOf(t); len = t.length; }
      else if (termScore(t, tok, true) > 0) len = Math.min(tok.length, t.length);
      for (let i = 0; i < len; i++) mark[mt.index + off + i] = 1;
    }
  }
  const parts: { t: string; m: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const m = !!mark[i];
    const p = parts[parts.length - 1];
    if (p && p.m === m) p.t += text[i];
    else parts.push({ t: text[i], m });
  }
  return parts;
}

/* -------------------------------- index -------------------------------- */

const CH: Record<string, string> = { senate: 'Senate', house: 'House', governor: 'Governor' };

function buildStatic(): Entry[] {
  const out: Entry[] = [];
  for (const p of PAGES) out.push({ id: `p${p.to}`, kind: 'Page', label: p.label, sub: p.sub, to: p.to, keys: `${p.sub} ${p.keys ?? ''} ${p.to}` });
  for (const s of STATES ?? []) out.push({ id: `s${s.abbr}`, kind: 'State', label: s.name, sub: `${s.abbr} · ${s.ev} electoral votes · ${s.houseSeats} House seats`, to: `/state/${s.abbr}`, keys: `${s.abbr} state` });
  const seen = new Set<string>();
  for (const s of [...(FEDERAL?.seats ?? []), ...(VICTORIA?.seats ?? [])]) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    const party = AU_PARTIES[s.party]?.name ?? s.party;
    const fed = s.chamber === 'federal';
    out.push({
      id: `a${s.id}`, kind: 'AU seat', label: s.name,
      sub: `${fed ? `Federal division · ${s.state}` : 'Victorian district'} · ${s.vacant ? 'vacant' : `${s.member} (${party})`}${s.margin != null ? ` · ${s.margin.toFixed(1)}% margin` : ''}`,
      to: `/au/seat/${s.id}`, keys: `${s.member} ${party} ${s.party} ${s.state} ${fed ? 'federal division' : 'victoria vic district'}`,
    });
  }
  for (const [code, p] of Object.entries(AU_PARTIES)) {
    if (code === 'OTH') continue;
    const fedSeats = FEDERAL?.house?.[code];
    const vicSeats = VICTORIA?.composition?.[code];
    out.push({
      id: `ap${code}`, kind: 'AU party', label: p.name,
      sub: [code, fedSeats != null ? `${fedSeats} federal House seats` : '', vicSeats != null ? `${vicSeats} Vic Assembly seats` : ''].filter(Boolean).join(' · '),
      to: '/au', keys: `${code} party australia`,
    });
  }
  return out;
}

function buildRaces(): Entry[] {
  const out: Entry[] = [];
  for (const r of RACES ?? []) {
    const cands = r.candidates ?? [];
    out.push({
      id: `r${r.id}`, kind: 'Race', label: r.title, to: `/race/${r.id}`, rating: r.rating, boost: r.key ? 1.5 : 0,
      sub: `${r.id} · ${cands.map((c) => `${c.name} (${c.party})`).join(' vs ') || 'Candidates TBD'}`,
      keys: `${r.id} ${r.state} ${CH[r.chamber] ?? r.chamber} ${r.district != null ? `district ${r.district} ${r.state}-${r.district}` : ''} ${cands.map((c) => c.name).join(' ')}`,
    });
    for (const c of cands) {
      if (!c.name || /^(tbd|other|others)$/i.test(c.name)) continue;
      out.push({
        id: `c${r.id}:${c.id}`, kind: 'Candidate', label: c.name, to: `/candidate/${encodeURIComponent(c.id.toLowerCase())}`, boost: r.key ? 0.5 : 0,
        sub: `${c.party}${c.incumbent ? ' · incumbent' : ''} · ${r.title}`,
        keys: `${c.party} ${r.id} ${r.state} ${r.title}`,
      });
    }
  }
  return out;
}

const newsEntry = (n: NewsItem): Entry => ({
  id: `n${n.id}`, kind: 'News', label: n.title, href: n.url,
  sub: `${n.source} · ${new Date(n.publishedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
  keys: `${n.source} ${(n.tags ?? []).join(' ')} ${n.summary ?? ''}`.slice(0, 400),
});

function buildActions(settings: Settings, update: (p: Partial<Settings>) => void, openPanel: () => void): Entry[] {
  const out: Entry[] = [];
  const bc = settings.ui === 'broadcast';
  out.push({ id: 'x:ui', kind: 'Action', label: bc ? 'Switch to Command look' : 'Switch to Broadcast look', sub: `Toggle visual style · now ${bc ? 'Broadcast' : 'Command'}`, keys: 'toggle broadcast look theme style command ui tv cable', run: () => update({ ui: bc ? 'command' : 'broadcast' }) });
  for (const tz of TIME_ZONES) {
    if (tz.id === settings.timeZone) continue;
    out.push({ id: `x:tz:${tz.id}`, kind: 'Action', label: `Switch time zone to ${tz.label}`, sub: `${tz.group} · ${tz.id === 'local' ? 'device time' : tz.id}`, keys: `time zone timezone tz clock ${tz.id.replace(/[/_]/g, ' ')} ${tz.group}`, run: () => update({ timeZone: tz.id }) });
  }
  out.push({ id: 'x:sound', kind: 'Action', label: settings.sound ? 'Mute race-call sound' : 'Turn on race-call sound', sub: 'Chime when a race is called', keys: 'sound audio chime mute toggle', run: () => update({ sound: !settings.sound }) });
  for (const [lvl, lbl] of [['all', 'all races'], ['key', 'key races only'], ['off', 'off']] as const) {
    if (lvl !== settings.alerts) out.push({ id: `x:al:${lvl}`, kind: 'Action', label: `Race-call alerts: ${lbl}`, sub: 'Call takeover & notifications', keys: 'alerts notifications calls', run: () => update({ alerts: lvl }) });
  }
  out.push({ id: 'x:settings', kind: 'Action', label: 'Open settings', sub: 'Time zone, alerts, sound, look', keys: 'preferences options settings', run: openPanel });
  return out;
}

/** The live search index. Rebuilds when candidate names sync from the live feed or news arrives. */
export function useSearchIndex(): Entry[] {
  const { news } = useLive();
  const { settings, update, setPanelOpen } = useSettings();
  const stat = useMemo(buildStatic, []);
  // Live provider mutates RACES[].candidates in place when it syncs real names; a cheap signature tracks it.
  let sig = 0;
  for (const r of RACES ?? []) for (const c of r.candidates ?? []) sig = (sig * 31 + c.name.length + c.name.charCodeAt(0)) | 0;
  const races = useMemo(buildRaces, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const newsE = useMemo(() => (news ?? []).map(newsEntry), [news]);
  const actions = useMemo(() => buildActions(settings, update, () => setPanelOpen(true)), [settings, update, setPanelOpen]);
  return useMemo(() => [...actions, ...stat, ...races, ...newsE], [actions, stat, races, newsE]);
}

/* ---------------------------- recent searches --------------------------- */

const RKEY = 'poltok:search:recent';
export interface Recent { id: string; kind: Kind; label: string; to?: string; href?: string; q?: string }
export function loadRecent(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RKEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => x && typeof x.label === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
}
export function pushRecent(r: Recent) {
  try {
    const list = [r, ...loadRecent().filter((x) => x.id !== r.id)].slice(0, 8);
    localStorage.setItem(RKEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
}
export function clearRecent() {
  try {
    localStorage.removeItem(RKEY);
  } catch {
    /* ignore */
  }
}
