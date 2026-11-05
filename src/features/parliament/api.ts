/** Client for /api/parliament/* (server/parliament.js locally, netlify/functions/parliament.mjs in production).
 * Falls back to CORS-enabled public sources when the API is unreachable. */
import { useEffect, useState } from 'react';

export type Country = 'us' | 'au';
export interface Sponsor { name: string; party: string; state?: string; district?: string }
export interface Action { date: string; time?: string; text: string; chamber?: string; votes?: { chamber: string; roll: number; url: string; date: string }[] }
export interface TextVersion { label: string; date: string; url: string }
export interface PartyTally { party: string; name: string; yea: number; nay: number; present: number; notVoting: number }
export interface Vote {
  id: string; chamber: string; roll: number; date: string; ts?: number; measure?: string; question: string; description?: string;
  result: string; type?: string; totals: { yea: number; nay: number; present: number; notVoting: number }; parties: PartyTally[]; billId?: string; url: string;
}
export interface Bill {
  id: string; country: Country; label: string; title: string; shortTitle?: string; chamber: string; introduced?: string; updated?: string;
  latestAction: { date: string; text: string } | null;
  /** 0..4 index into `stages`; -1 = unknown (source does not report it) */
  stage: number; stageLabel: string; stages: string[];
  sponsor?: Sponsor; cosponsors?: number; policyArea?: string; subjects: string[]; committees?: string[]; laws?: string[];
  url: string; textUrl?: string; parlInfo?: string; actionCount?: number;
  /** where this row came from (AU): 'mirror' = open-data mirror of aph.gov.au, 'frl' = Federal Register of Legislation */
  source?: 'mirror' | 'frl';
}
export interface BillDetail extends Bill { actions: Action[]; texts: TextVersion[]; votes: Vote[]; summary?: string }
export interface Missing { key: string; what: string; where: string }
export interface BillsResp { bills: Bill[]; source: string; fetchedAt: number; missing: Missing[]; notes: string[]; fallback?: boolean }
export interface VotesResp { votes: Vote[]; missing: Missing[]; notes: string[]; source?: string; fetchedAt?: number }
export interface FloorItem { title: string; link: string; date: string; description: string }
export interface FloorResp { house: FloorItem[]; senate: FloorItem[]; ok: { house: boolean; senate: boolean }; source: string; links: { house: string; senate: string }; fetchedAt: number }

export const US_STAGES = ['Introduced', 'In committee', 'Passed one chamber', 'Passed both chambers', 'Signed into law'];
export const AU_STAGES = ['Introduced', 'In committee', 'Passed one house', 'Passed both houses', 'Royal Assent'];

async function getJson<T>(url: string, timeout = 25000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const ct = r.headers.get('content-type') || '';
    if (!ct.includes('json')) throw new Error('not JSON (API not deployed?)');
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
async function getText(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}
const rssItems = (s: string) => {
  const doc = new DOMParser().parseFromString(s, 'application/xml');
  return [...doc.querySelectorAll('item')].map((i) => ({
    title: i.querySelector('title')?.textContent?.trim() || '',
    link: i.querySelector('link')?.textContent?.trim() || '',
    date: i.querySelector('pubDate')?.textContent?.trim() || '',
    description: i.querySelector('description')?.textContent || '',
  }));
};

/* ---------- direct CORS fallbacks (used only when /api/parliament is unreachable) ---------- */
const CG_TYPES: Record<string, string> = { 'house-bill': 'hr', 'senate-bill': 's', 'house-joint-resolution': 'hjres', 'senate-joint-resolution': 'sjres', 'house-resolution': 'hres', 'senate-resolution': 'sres' };
async function usFallback(): Promise<BillsResp> {
  // congress.gov "Most-Viewed Bills" RSS (Access-Control-Allow-Origin: *) — titles + numbers only.
  const items = rssItems(await getText('https://www.congress.gov/rss/most-viewed-bills.xml'));
  const html = items[0]?.description || '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const bills: Bill[] = [];
  for (const li of doc.querySelectorAll('li')) {
    const a = li.querySelector('a');
    const m = /\/bill\/(\d+)th-congress\/([a-z-]+)\/(\d+)/.exec(a?.getAttribute('href') || '');
    if (!m || m[1] !== '119') continue;
    const title = (li.textContent || '').replace(/^.*?\]\s*-\s*/, '').trim();
    bills.push({
      id: `119-${CG_TYPES[m[2]] || 'hr'}-${m[3]}`, country: 'us', label: a?.textContent?.trim() || '', title, chamber: m[2].startsWith('senate') ? 'Senate' : 'House',
      latestAction: null, stage: -1, stageLabel: 'Status not in feed', stages: US_STAGES, subjects: [], url: a?.getAttribute('href') || '',
    });
  }
  return { bills, source: `congress.gov Most-Viewed Bills RSS (${items[0]?.title || 'weekly'})`, fetchedAt: Date.now(), missing: [], notes: ['Live API unreachable — showing congress.gov most-viewed bills directly. Stage data needs /api/parliament.'], fallback: true };
}
async function auFallback(): Promise<BillsResp> {
  const y = new Date().getUTCFullYear();
  const j = await getJson<{ value: { id: string; name: string; makingDate: string; originatingBillUri?: string; asMadeRegisteredAt?: string }[] }>(
    `https://api.prod.legislation.gov.au/v1/titles?%24filter=startswith(id,%27C${y}A%27)&%24orderby=makingDate%20desc&%24top=60&%24select=id,name,makingDate,originatingBillUri,asMadeRegisteredAt`,
  );
  const bills: Bill[] = j.value.map((t) => ({
    id: t.id, country: 'au', label: t.id, title: t.name, chamber: 'Parliament of Australia', updated: t.asMadeRegisteredAt,
    latestAction: { date: t.makingDate.slice(0, 10), text: 'Royal Assent — Act registered on the Federal Register of Legislation' },
    stage: 4, stageLabel: 'Royal Assent', stages: AU_STAGES, subjects: [], url: t.originatingBillUri || `https://www.legislation.gov.au/${t.id}/asmade`,
    textUrl: `https://www.legislation.gov.au/${t.id}/asmade/text`, parlInfo: t.originatingBillUri,
  }));
  return { bills, source: 'Federal Register of Legislation (direct)', fetchedAt: Date.now(), missing: [], notes: ['Live API unreachable — showing assented Acts directly from legislation.gov.au.'], fallback: true };
}
async function floorFallback(): Promise<FloorResp> {
  const [h, s] = await Promise.all(['house', 'senate'].map((w) => getText(`https://www.congress.gov/rss/${w}-floor-today.xml`).then(rssItems).catch(() => null)));
  return {
    house: h || [], senate: s || [], ok: { house: !!h, senate: !!s }, source: 'congress.gov RSS (direct)',
    links: { house: 'https://live.house.gov/', senate: 'https://www.senate.gov/legislative/floor_activity_pail.htm' }, fetchedAt: Date.now(),
  };
}

export const api = {
  bills: (c: Country, q = '') =>
    getJson<BillsResp>(`/api/parliament/${c}/bills?limit=40${q ? `&q=${encodeURIComponent(q)}` : ''}`).catch((e) => (q ? Promise.reject(e) : c === 'us' ? usFallback() : auFallback())),
  bill: (c: Country, id: string) => getJson<{ bill: BillDetail }>(`/api/parliament/${c}/bill/${encodeURIComponent(id)}`).then((r) => r.bill),
  votes: (c: Country) => getJson<VotesResp>(`/api/parliament/${c}/votes`),
  floor: () => getJson<FloorResp>('/api/parliament/us/floor').catch(floorFallback),
};

export interface Async<T> { data?: T; error?: string; loading: boolean }
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): Async<T> {
  const [s, set] = useState<Async<T>>({ loading: true });
  useEffect(() => {
    let live = true;
    set((p) => ({ data: p.data, loading: true }));
    fn().then(
      (data) => live && set({ data, loading: false }),
      (e: unknown) => live && set({ error: e instanceof Error ? e.message : String(e), loading: false }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return s;
}

/** Bill ids → country. US ids look like "119-hr-1". */
export const countryOf = (id: string): Country => (/^\d+-[a-z]+-\d+$/i.test(id) ? 'us' : 'au');

/** Date-only ISO "2026-11-03" → "Nov 3, 2026" (no zone shift). */
export function fmtDate(d?: string) {
  if (!d) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return d;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}
