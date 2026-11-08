// Shared build-time helpers for the portrait generators (gen-photos.mts, gen-au-photos.mts).
// Everything here is identity-strict and licence-strict: callers only ever pass Wikidata items they already matched
// unambiguously, and every Commons file is licence-checked (CC BY / BY-SA / CC0 / public domain / open-government).
export const UA = 'PolTokBot/1.0 (https://poltok.netlify.app; build-time photo licence check)';
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function get(url: string, init: RequestInit = {}, tries = 6): Promise<any> {
  for (let i = 0; ; i++) {
    let r: Response;
    try {
      r = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers || {}) } });
    } catch (e) {
      if (i < tries) { await sleep(2000 * 2 ** i); continue; }
      throw e;
    }
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && i < tries) { await sleep(Number(r.headers.get('retry-after')) * 1000 || 2000 * 2 ** i); continue; }
    throw new Error(`HTTP ${r.status} ${url.slice(0, 120)}`);
  }
}
export const sparql = (q: string) => get('https://query.wikidata.org/sparql', {
  method: 'POST', body: new URLSearchParams({ query: q, format: 'json' }),
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/sparql-results+json' },
});
export const fileOf = (u: string) => decodeURIComponent(u.split('Special:FilePath/')[1]).replace(/_/g, ' ');

export const FREE = /^(CC BY(-SA)?( \d(\.\d)?)?( [a-z]{2,3})?|CC0( 1\.0)?|Public domain|PD[- ].*|PDM[- ].*|Attribution|OGL 3|OGL v3\.0|KOGL Type 1|GODL-India)$/i;
export const NONFREE = /\bNC\b|\bND\b|non-?commercial|no ?deriv|fair use|non-free|copyrighted/i;
export const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
export interface PhotoRec { f: string; a: string; l: string; u: string; q: string }

/** Commons extmetadata for many files at once (keyed by the file name as passed in, without "File:"). */
export async function commonsInfo(files: string[]): Promise<Map<string, any>> {
  const info = new Map<string, any>();
  const uniq = [...new Set(files)];
  for (let i = 0; i < uniq.length; i += 50) {
    const u = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', iiprop: 'extmetadata|mime',
      iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|NonFree', titles: uniq.slice(i, i + 50).map((f) => 'File:' + f).join('|'), maxlag: '5',
    });
    const j = await get(u);
    const norm = new Map<string, string>((j.query.normalized ?? []).map((n: any) => [n.to, n.from]));
    for (const pg of j.query.pages) {
      const ii = pg.imageinfo?.[0];
      if (!ii) continue;
      info.set(pg.title.replace(/^File:/, ''), ii);
      if (norm.has(pg.title)) info.set(norm.get(pg.title)!.replace(/^File:/, ''), ii);
    }
    await sleep(300);
  }
  return info;
}

/** Licence-checked record, or null (with the reason) if the file is not clearly reusable. */
export function licensed(file: string, ii: any, qid: string): { rec: PhotoRec | null; lic: string } {
  const md = ii?.extmetadata ?? {};
  const lic = strip(md.LicenseShortName?.value);
  if (!ii || !lic || !FREE.test(lic) || NONFREE.test(lic) || md.NonFree?.value === 'true') return { rec: null, lic };
  return { rec: { f: file, a: (strip(md.Artist?.value) || strip(md.Credit?.value) || 'Unknown author').slice(0, 90), l: lic, u: md.LicenseUrl?.value ?? '', q: qid }, lic };
}

const GROUPY = /\b(and|with|office|offices|funeral|forum|speaking|speaks|speech|protest|march|parade|memorial|launch|opening|conference|electorate|building|street|stall|booth|shop|school|hospital|announcement|announces|visiting|tour|vs|v|at|in|on|during|ministry|swearing|sworn|oath|reception|dinner|lunch|breakfast|party|celebrat\w*|meets?|meeting|visit|visits|team|group|signing|rally|crowd|cabinet|delegation|family|wedding|award|ceremony|press conference|debate|logo|signature|sign|map|poster|banner|election|campaign|office building|house|car|grave|plaque|statue|mural|tweet|screenshot|video|interview)\b/i;
const IMG = /\.(jpe?g|png|webp)$/i;
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Portrait candidates for an already-identified Wikidata person who has no P18: files that are tagged on Commons
 * as depicting exactly that item (structured data P180), or that sit in the person's own Commons category (P373).
 * The file name must also contain the person's surname and must not look like a group / event / object shot.
 */
export async function fallbackFiles(qid: string, surname: string, category?: string): Promise<string[]> {
  const s = fold(surname);
  const ok = (t: string) => IMG.test(t) && fold(t).includes(s) && !GROUPY.test(t.replace(/\.[a-z]+$/i, '').replace(/[_-]/g, ' ')) && !/,| & /.test(t);
  const out: string[] = [];
  const depicts = await get('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', list: 'search', srnamespace: '6', srlimit: '20', srsearch: `haswbstatement:P180=${qid}`,
  })).catch(() => null);
  for (const h of depicts?.query?.search ?? []) { const t = String(h.title).replace(/^File:/, ''); if (ok(t)) out.push(t); }
  if (category) {
    const cat = await get('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', list: 'categorymembers', cmtype: 'file', cmlimit: '50', cmtitle: `Category:${category}`,
    })).catch(() => null);
    for (const m of cat?.query?.categorymembers ?? []) { const t = String(m.title).replace(/^File:/, ''); if (ok(t)) out.push(t); }
  }
  // Prefer names that say "portrait"/"official"/"headshot", then shorter names (usually a single-subject photo).
  const score = (t: string) => (/portrait|official|headshot|profile/i.test(t) ? 0 : 1) * 1000 + t.length;
  return [...new Set(out)].sort((a, b) => score(a) - score(b) || a.localeCompare(b));
}

/** First fallback file per person that passes the licence check. */
export async function resolveFallbacks(people: { key: string; qid: string; surname: string; category?: string }[]): Promise<Map<string, PhotoRec>> {
  const cands = new Map<string, { qid: string; files: string[] }>();
  let n = 0;
  for (const p of people) {
    const files = await fallbackFiles(p.qid, p.surname, p.category);
    if (files.length) cands.set(p.key, { qid: p.qid, files: files.slice(0, 4) });
    if (++n % 25 === 0) console.log(`fallback ${n}/${people.length}`);
    await sleep(150);
  }
  const info = await commonsInfo([...cands.values()].flatMap((c) => c.files));
  const out = new Map<string, PhotoRec>();
  for (const [k, c] of cands) {
    for (const f of c.files) {
      const { rec } = licensed(f, info.get(f), c.qid);
      if (rec) { out.set(k, rec); break; }
    }
  }
  return out;
}
