// Build-time: fill portrait gaps with official headshots published by parties, parliaments, governments and campaigns.
// Run: node --experimental-strip-types scripts/gen-official-photos.mts   (re-runnable; images already on disk are reused)
//
// Freely licensed portraits (gen-photos.mts / gen-au-photos.mts) always win: this script only looks at people who have no
// free photo yet. Identity rules (strict — anything ambiguous is skipped):
//  - the image must come from a page dedicated to that one person (their profile / candidate page), never a group page;
//  - the page's name must match the person (same first+last name key, or same surname and a given name the person has),
//    the page must name the person's electorate / region / state, and the source must be their party's own site;
//  - the picked image must be tied to the person on that page (file name contains the surname, or alt text names them);
//  - a page matching two people, or two pages matching one person, is dropped.
// Each image is downloaded, cropped to 256×256 and saved as webp under public/portraits/<group>/<slug>.webp (never
// hotlinked), and recorded in src/data/photos/official.ts with its source page and a credit line.
// Sites that block automated requests (403 / Cloudflare challenge) are skipped and listed — never worked around.
// robots.txt is honoured for every host (Disallow rules for "*", and Crawl-delay when it is longer than DELAY_MS).
//
// Rendered mode: some team pages only show their people after JavaScript runs (render: true below). Those pages are
// opened in headless Chromium via Playwright (require('playwright'), chromium.launch()) with the same User-Agent,
// pacing and robots rules, images/fonts/media blocked (only the DOM is read), then parsed exactly like static HTML.
// Playwright is resolved from the project or, failing that, the global npm root. Without it, rendered sources are
// skipped and listed.
//
// ONLY=<id,id,…>  run just those sources / direct entries (ids below) and keep every other existing record as is.
import { writeFileSync, mkdirSync, existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FEDERAL, VICTORIA, SENATORS, VIC_CANDIDATES, AU_PARTY_PROFILES } from '../src/data/au.ts';
import { VIC_NOMINATIONS } from '../src/data/au-vic.ts';
import { AU_STATES } from '../src/data/au-states.ts';
import { AU_PHOTOS } from '../src/data/au-photos.ts';
import { PHOTOS, PHOTO_STATS } from '../src/data/photos/generated.ts';
import { NZ_ELECTORATES } from '../src/features/nz/generated.ts';
import { personKey } from '../src/data/photos/key.ts';
import { US_2028 } from './us-2028.mts';

const UA = 'Mozilla/5.0 (compatible; PortraitIndexer/1.0)';
const DELAY = Number(process.env.DELAY_MS ?? 1500);
const ROOT = new URL('../', import.meta.url).pathname;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const letters = (s: string) => fold(s).replace(/[^a-z]/g, '');
const slugify = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&#x2B;/g, '+').replace(/&nbsp;/g, ' ');
const text = (html: string) => decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');

/* ---------------- polite fetch, robots.txt, host block tracking ---------------- */
const blocked = new Map<string, string>();
let last = 0;
const hostLast = new Map<string, number>();
interface Robots { rules: { allow: boolean; path: string }[]; delay: number }
const robots = new Map<string, Robots>();
/** robots.txt group for "*" (RFC 9309: longest matching rule wins, Allow wins ties, paths are case-sensitive). */
async function robotsFor(origin: string): Promise<Robots> {
  const hit = robots.get(origin);
  if (hit) return hit;
  const r: Robots = { rules: [], delay: 0 };
  robots.set(origin, r);
  const wait = last + DELAY - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (res.ok && /text\/plain/i.test(res.headers.get('content-type') ?? 'text/plain')) {
      let mine = false, inAgents = false;
      for (const raw of (await res.text()).split(/\r?\n/)) {
        const line = raw.replace(/#.*/, '').trim();
        const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
        if (!m) continue;
        const [, k, v] = [m[0], m[1].toLowerCase(), m[2].trim()];
        if (k === 'user-agent') { if (!inAgents) mine = false; inAgents = true; if (v === '*') mine = true; continue; }
        inAgents = false;
        if (!mine) continue;
        if ((k === 'disallow' || k === 'allow') && v) r.rules.push({ allow: k === 'allow', path: v });
        if (k === 'crawl-delay' && Number(v) > 0) r.delay = Math.min(Number(v), 30) * 1000;
      }
    }
  } catch { /* no robots.txt reachable: nothing disallowed */ }
  return r;
}
const ruleRe = (p: string) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'), 'i'); // case-insensitive: honour the intent of a rule even if a path's capitalisation differs
async function robotsAllow(url: string): Promise<boolean> {
  const u = new URL(url);
  const r = await robotsFor(u.origin);
  const path = u.pathname + u.search;
  let best: { allow: boolean; path: string } | null = null;
  for (const rule of r.rules) if (ruleRe(rule.path).test(path) && (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))) best = rule;
  return !best || best.allow;
}
const disallowed = new Set<string>();
/** Wait for the global gap (DELAY_MS) and the host's Crawl-delay; false when robots.txt disallows the URL. */
async function pace(url: string): Promise<boolean> {
  const u = new URL(url);
  if (!(await robotsAllow(url))) { disallowed.add(`${u.host}${u.pathname}`); return false; }
  const gap = Math.max(DELAY, robots.get(u.origin)?.delay ?? 0);
  const wait = Math.max(last + DELAY, (hostLast.get(u.host) ?? 0) + gap) - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now(); hostLast.set(u.host, last);
  return true;
}
async function fetchRaw(url: string): Promise<Response | null> {
  const host = new URL(url).host;
  if (blocked.has(host)) return null;
  if (!(await pace(url))) return null;
  for (let i = 0; i < 3; i++) {
    let r: Response;
    try { r = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' }); } catch (e) {
      if (i < 2) { await sleep(3000); continue; }
      console.warn(`network error ${url}: ${(e as Error).message}`); unreachable.set(host, (e as Error).message); return null;
    }
    if (r.ok) return r;
    if (r.status === 403 || r.status === 401 || r.headers.get('cf-mitigated')) { blocked.set(host, `HTTP ${r.status}${r.headers.get('cf-mitigated') ? ' (Cloudflare challenge)' : ''}`); return null; }
    if (r.status === 429 || r.status >= 500) { await sleep(5000 * (i + 1)); continue; }
    return null; // 404 etc.
  }
  return null;
}
const fetchText = async (url: string) => (await fetchRaw(url))?.text() ?? null;
const unreachable = new Map<string, string>();

/* ---------------- rendered fetch (Playwright, for pages built by JavaScript) ---------------- */
interface Page { html: string; h1?: string; body?: string }
let browser: any = null;
let browserCtx: any = null;
let noBrowser = '';
function loadPlaywright(): any {
  const tries = [() => createRequire(import.meta.url)('playwright'),
    () => createRequire(join(execFileSync('npm', ['root', '-g']).toString().trim(), 'x.js'))('playwright')];
  for (const t of tries) { try { return t(); } catch { /* next */ } }
  return null;
}
async function renderPage(url: string): Promise<Page | null> {
  const host = new URL(url).host;
  if (blocked.has(host) || noBrowser) return null;
  if (!browserCtx) {
    const pw = loadPlaywright();
    if (!pw) { noBrowser = 'playwright not installed (npm i -D playwright && npx playwright install chromium)'; return null; }
    try { browser = await pw.chromium.launch(); } catch (e) { noBrowser = `chromium.launch failed: ${(e as Error).message.split('\n')[0]}`; return null; }
    browserCtx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
    // Only the DOM is needed: never download images, media or fonts while rendering.
    await browserCtx.route('**/*', (r: any) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  }
  if (!(await pace(url))) return null;
  const page = await browserCtx.newPage();
  try {
    let res: any;
    try { res = await page.goto(url, { waitUntil: 'load', timeout: 45_000 }); } catch (e) {
      console.warn(`render failed ${url}: ${(e as Error).message.split('\n')[0]}`); unreachable.set(host, (e as Error).message.split('\n')[0]); return null;
    }
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    const status: number = res?.status() ?? 0;
    const headers = res?.headers() ?? {};
    const title: string = await page.title().catch(() => '');
    if (status === 403 || status === 401 || headers['cf-mitigated'] || /^(just a moment|attention required|access denied)/i.test(title)) {
      blocked.set(host, `HTTP ${status}${headers['cf-mitigated'] || /just a moment|attention/i.test(title) ? ' (Cloudflare challenge)' : ''} [rendered]`);
      return null;
    }
    if (status >= 400) return null;
    // Trigger lazy content, then read the DOM.
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight && y < 20_000; y += 900) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } }).catch(() => {});
    const html: string = await page.content();
    const h1: string = await page.locator('h1:visible').first().innerText({ timeout: 2_000 }).catch(() => '');
    // Page text without site chrome (header / nav / footer), so a state named in a footer can't count as the person's.
    const body: string = await page.evaluate(() => {
      const c = document.body.cloneNode(true) as HTMLElement;
      c.querySelectorAll('header, nav, footer, script, style, noscript, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach((n) => n.remove());
      return c.innerText || c.textContent || '';
    }).catch(() => '');
    return { html, h1: h1.replace(/\s+/g, ' ').trim(), body: body.replace(/\s+/g, ' ') };
  } finally { await page.close().catch(() => {}); }
}
const getPage = async (url: string, render?: boolean): Promise<Page | null> => {
  if (render) return renderPage(url);
  const html = await fetchText(url);
  return html ? { html } : null;
};

/* ---------------- people still missing a free photo ---------------- */
type Group = 'au' | 'nz' | 'us' | 'world';
interface Ctx { party?: string; where?: string }
interface Person { key: string; group: Group; name: string; ctx: Ctx[] }
const people = new Map<string, Person>();
const STATE: Record<string, string> = { NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', WA: 'Western Australia', SA: 'South Australia', TAS: 'Tasmania', ACT: 'Australian Capital Territory', NT: 'Northern Territory' };
const titleCase = (s: string) => s.replace(/\b([A-Z])([A-Z']+)\b/g, (_m, a: string, b: string) => a + b.toLowerCase());
function add(group: Group, raw: string | undefined | null, party?: string, where?: string) {
  if (!raw) return;
  for (const part of raw.split(/\s*\/\s*/)) {
    const name = titleCase(part.trim());
    if (!name || /vacant|—/i.test(name)) continue;
    const key = `${group}:${personKey(name)}`;
    const p = people.get(key) ?? { key, group, name, ctx: [] };
    p.ctx.push({ party, where });
    people.set(key, p);
  }
}
const district = (id: string) => id.replace(/^vic-/, '').split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
for (const s of FEDERAL.seats) add('au', s.member, s.party, s.name);
add('au', FEDERAL.pm.name); add('au', FEDERAL.opposition.name);
for (const s of SENATORS) add('au', s.name, s.party, STATE[s.state] ?? s.state);
for (const s of VICTORIA.seats) add('au', s.member, s.party, s.name);
for (const [d, l] of Object.entries(VIC_CANDIDATES.byDistrict)) for (const [n, p] of l) add('au', n, p, district(d));
for (const [d, l] of Object.entries(VIC_NOMINATIONS.districts)) for (const [n, p] of l) add('au', n, p, district(d));
for (const [r, l] of Object.entries(VIC_NOMINATIONS.regions)) for (const [n, p] of l) add('au', n, p, r);
for (const st of AU_STATES) { add('au', st.head.name); add('au', st.opposition.name); }
for (const p of Object.values(AU_PARTY_PROFILES)) for (const l of [p.federalLeader, p.vicLeader, p.nswLeader]) add('au', l?.name);
for (const e of NZ_ELECTORATES) for (const c of e.candidates) add('nz', c.name, c.party, e.name);
for (const m of readFileSync(new URL('../src/features/nz/data.ts', import.meta.url), 'utf8').matchAll(/leader: '([^']+)'/g)) add('nz', m[1]);
for (const n of US_2028) add('us', n);

const hasFree = (p: Person) => (p.group === 'au' ? !!AU_PHOTOS[p.key.slice(3)] : !!PHOTOS[p.key]);
const missing = [...people.values()].filter((p) => !hasFree(p));
const before: Record<string, { have: number; total: number }> = {};
for (const p of people.values()) { const b = (before[p.group] ??= { have: 0, total: 0 }); b.total++; if (hasFree(p)) b.have++; }

/* ---------------- sources ---------------- */
interface Source {
  id: string; group: 'au' | 'nz'; credit: string; list: string[]; link: RegExp; parties: string[];
  /** open with Playwright (content built by JavaScript) */ render?: boolean;
  /** list pages are paginated: keep fetching list[0] with {n} = 2, 3, … while new profile links appear (max 15) */ paged?: boolean;
}
const SOURCES: Source[] = [
  { id: 'greens-vic', group: 'au', credit: 'Photo: Australian Greens Victoria', list: ['https://greens.org.au/vic/candidates'], link: /^https:\/\/greens\.org\.au\/vic\/person\/[a-z0-9-]+$/, parties: ['GRN'] },
  { id: 'vic-socialists', group: 'au', credit: 'Photo: Victorian Socialists', list: ['https://www.victoriansocialists.org.au/candidates'], link: /^https:\/\/(www\.)?victoriansocialists\.org\.au\/candidates\/[a-z0-9-]+$/, parties: ['VS'] },
  { id: 'nationals', group: 'au', credit: 'Photo: The Nationals', list: ['https://www.nationals.org.au/team/'], link: /^https:\/\/www\.nationals\.org\.au\/team\/[a-z0-9-]+$/, parties: ['NAT', 'LNP'] },
  { id: 'nz-national', group: 'nz', credit: 'Photo: New Zealand National Party', list: ['https://www.national.org.nz/team'], link: /^https:\/\/www\.national\.org\.nz\/team\/[a-z0-9-]+$/, parties: ['NAT'] },
  // Rendered (JavaScript-built) team pages.
  // The team grid pages in with JavaScript, so its sitemap lists the rest of the profiles.
  { id: 'liberal', group: 'au', credit: 'Photo: Liberal Party of Australia', render: true,
    list: ['https://www.liberal.org.au/our-team', 'https://www.liberal.org.au/team-sitemap.xml'],
    link: /^https:\/\/www\.liberal\.org\.au\/team\/[a-z0-9-]+$/, parties: ['LIB'] },
  { id: 'vic-liberal', group: 'au', credit: 'Photo: Liberal Party of Australia (Victorian Division)', render: true,
    list: ['https://vicliberal.org.au/our-team/state', 'https://vicliberal.org.au/our-team/federal'], link: /^https:\/\/vicliberal\.org\.au\/team\/[a-z0-9-]+$/, parties: ['LIB'] },
  { id: 'alp', group: 'au', credit: 'Photo: Australian Labor Party', render: true,
    list: ['https://www.alp.org.au/our-people/our-people/'], link: /^https:\/\/www\.alp\.org\.au\/our-people\/our-people\/[a-z0-9-]+$/, parties: ['ALP'] },
  { id: 'vic-labor', group: 'au', credit: 'Photo: Victorian Labor', render: true,
    list: ['https://www.viclabor.com.au/'], link: /^https:\/\/www\.viclabor\.com\.au\/(people|team|our-team|candidates)\/[a-z0-9-]+$/, parties: ['ALP'] },
  { id: 'nz-labour', group: 'nz', credit: 'Photo: New Zealand Labour Party', render: true,
    list: ['https://www.labour.org.nz/ourcandidates'], link: /^https:\/\/www\.labour\.org\.nz\/2026-campaign\/our-candidates\/[a-z0-9-]+$/, parties: ['LAB'] },
];
// Sites probed for this run and found blocking automated requests (kept here so the report lists them even when not fetched).
const PROBE = ['https://www.aph.gov.au/', 'https://www.parliament.vic.gov.au/', 'https://www.parliament.nsw.gov.au/', 'https://www.parliament.qld.gov.au/',
  'https://www.parliament.wa.gov.au/', 'https://www.parliament.tas.gov.au/', 'https://www.parliament.act.gov.au/', 'https://parliament.nt.gov.au/',
  'https://www.onenation.org.au/', 'https://www.greens.org.nz/', 'https://www.nzfirst.nz/', 'https://www.maoriparty.org.nz/', 'https://www.opportunity.org.nz/',
  'https://bioguide.congress.gov/'];

/** People / leaders resolved one by one: a dedicated official page (or public-domain bioguide portrait) per person. */
interface Direct { key: string; name: string; page: string; credit: string; img?: string; id?: string; render?: boolean; /** other spellings of the name (e.g. Hungarian family-name-first order) */ aliases?: string[] }
const BIOGUIDE: [string, string][] = [['Kamala Harris', 'H001075'], ['Chris Murphy', 'M001169'], ['Jasmine Crockett', 'C001130'], ['Byron Donalds', 'D000032'], ['Tom Cotton', 'C001095'], ['Hillary Clinton', 'C001041']];
const DIRECT: Direct[] = [
  ...BIOGUIDE.map(([n, b]) => ({ key: `us:${personKey(n)}`, name: n, page: `https://bioguide.congress.gov/search/bio/${b}`, credit: 'Photo: Official congressional portrait (public domain)', img: `https://unitedstates.github.io/images/congress/450x550/${b}.jpg` })),
  { key: `us:${personKey('Donald Trump')}`, name: 'Donald Trump', page: 'https://www.whitehouse.gov/administration/donald-j-trump/', credit: 'Photo: The White House (official portrait)' },
  { key: 'qid:Q592101', name: 'Luc Frieden', page: 'https://gouvernement.lu/en/gouvernement/luc-frieden.html', credit: 'Photo: Government of Luxembourg' },
  { key: 'qid:Q28860866', name: 'Rob Jetten', page: 'https://www.rijksoverheid.nl/regering/bewindspersonen/rob-jetten', credit: 'Photo: Rijksoverheid (Government of the Netherlands)' },
  // Prime Minister's page on the Hungarian government site (one person; rendered). Hungarian order: family name first.
  { id: 'kormany', key: 'qid:Q124488292', name: 'Péter Magyar', aliases: ['Magyar Péter'], render: true, page: 'https://kormany.hu/kormanyzat/miniszterelnok', credit: 'Photo: Government of Hungary (kormany.hu)' },
];

/* ---------------- page parsing ---------------- */
const meta = (html: string, prop: string) => decode(html.match(new RegExp(`<meta[^>]*(?:property|name)="${prop}"[^>]*content="([^"]*)"`, 'i'))?.[1] ?? html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:property|name)="${prop}"`, 'i'))?.[1] ?? '');
const HONORIFIC = /^(the\s+)?(rt\s+)?(hon\.?\s+)?(senator\s+|dr\.?\s+|mr\.?\s+|ms\.?\s+|mrs\.?\s+)?/i;
function pageName(html: string, visibleH1?: string): string {
  const h1 = visibleH1 ?? text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').trim();
  const og = meta(html, 'og:title') || text(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const raw = h1 && h1.split(/\s+/).length >= 2 ? h1 : og.split(/\s[|–—-]\s|,/)[0];
  return raw.replace(HONORIFIC, '').replace(/\s+(MP|MLA|MLC|OAM|AM)$/i, '').trim();
}
const abs = (u: string, base: string) => { try { return new URL(decode(u), base).href; } catch { return ''; } };
/** Unwrap Next.js image-optimiser URLs to the original file. */
const unwrap = (u: string) => { try { const x = new URL(u); return x.pathname.startsWith('/_next/image') && x.searchParams.get('url') ? new URL(x.searchParams.get('url')!, x.origin).href : u; } catch { return u; } };
interface Img { url: string; alt: string }
function images(html: string, base: string): Img[] {
  const out: Img[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0];
    const alt = decode(t.match(/\balt="([^"]*)"/i)?.[1] ?? '');
    const srcs = [t.match(/\bdata-src="([^"]+)"/i)?.[1], t.match(/\bsrc="([^"]+)"/i)?.[1], ...(t.match(/\bsrc[sS]et="([^"]+)"/)?.[1].split(',').map((s) => s.trim().split(/\s+/)[0]) ?? [])];
    for (const s of srcs) if (s && !s.startsWith('data:')) out.push({ url: unwrap(abs(s, base)), alt });
  }
  // og:image last: on-page portraits first, the share card only as a fallback.
  const og = meta(html, 'og:image'); if (og) out.push({ url: unwrap(abs(og, base)), alt: meta(html, 'og:image:alt') });
  return out.filter((i) => i.url && /^https?:/.test(i.url) && !/\.svg(\?|$)|logo|icon|flag|favicon|social-share|share-card|placeholder|opengraph|[-_]fb\.(jpe?g|png|webp)/i.test(i.url));
}
/** The image on a person's page that is tied to them: alt text names them, or the file name contains their surname. */
function pickImage(html: string, base: string, name: string, aliases: string[] = []): string | null {
  const parts = name.split(/\s+/);
  const sur = letters(parts[parts.length - 1]);
  const full = fold(name);
  const names = [full, ...aliases.map(fold)];
  const imgs = images(html, base);
  const byAlt = imgs.find((i) => fold(i.alt).includes(full) && /portrait|photo|image|headshot/i.test(i.alt) || names.includes(fold(i.alt).trim()));
  if (byAlt) return byAlt.url;
  // Greens profile pages describe the one portrait by first name ("This is an image of Sophie, …").
  const firstName = fold(parts[0]);
  const byFirst = imgs.filter((i) => new RegExp(`^this is an image of ${firstName}\\b`).test(fold(i.alt)));
  if (byFirst.length && new Set(byFirst.map((i) => i.url.split('?')[0])).size === 1) return byFirst[0].url;
  if (sur.length < 3) return null;
  const byFile = imgs.find((i) => letters(decodeURIComponent(new URL(i.url).pathname.split('/').pop() ?? '')).includes(sur));
  return byFile?.url ?? null;
}

/* ---------------- matching ---------------- */
/** Whole-word match ("Victoria" must not match "Victorian"). */
const wordIn = (hay: string, needle: string) => new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(hay);
function matchPerson(src: Source, name: string, pageText: string): Person[] {
  const k = `${src.group}:${personKey(name)}`;
  const toks = fold(name).replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean);
  const sur = toks[toks.length - 1], first = toks[0];
  const ft = fold(pageText);
  return missing.filter((p) => {
    if (p.group !== src.group) return false;
    const pt = fold(p.name).replace(/[^a-z\s-]/g, '').split(/\s+/).filter(Boolean);
    const sameName = p.key === k || (pt[pt.length - 1] === sur && pt.slice(0, -1).includes(first));
    if (!sameName) return false;
    // party and electorate/region/state must both agree with one of the person's records
    return p.ctx.some((c) => c.party && src.parties.includes(c.party) && c.where && wordIn(ft, fold(c.where)));
  });
}

/* ---------------- download + resize ---------------- */
interface OutRec { p: string; s: string; c: string; i: string; n: string }
const OUT = new URL('../src/data/photos/official.ts', import.meta.url);
const prev: Record<string, OutRec> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8').match(/OFFICIAL[^=]*= (\{[\s\S]*\});/)?.[1] ?? '{}') : {};
async function saveImage(group: Group, name: string, url: string): Promise<string | null> {
  const rel = `portraits/${group}/${slugify(name)}.webp`;
  const file = join(ROOT, 'public', rel);
  const old = Object.values(prev).find((r) => r.p === `/${rel}`);
  if (old && old.i === url && existsSync(file)) return `/${rel}`;
  const r = await fetchRaw(url);
  if (!r || !/^image\//.test(r.headers.get('content-type') ?? 'image/')) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 2000) return null;
  const tmp = join(tmpdir(), `poltok-${process.pid}-${slugify(name)}`);
  writeFileSync(tmp, buf);
  try {
    const [w, h] = execFileSync('identify', ['-format', '%w %h', `${tmp}[0]`]).toString().split(' ').map(Number);
    if (Math.min(w, h) < 120) return null; // too small to be a portrait
    mkdirSync(join(ROOT, 'public/portraits', group), { recursive: true });
    // Tall portraits: keep the top (face); landscape/square: centre.
    execFileSync('convert', [`${tmp}[0]`, '-auto-orient', '-background', 'white', '-alpha', 'remove', '-resize', '256x256^', '-gravity', h > w * 1.1 ? 'North' : 'Center', '-extent', '256x256', '-strip', '-quality', '70', file]);
  } catch (e) { console.warn(`convert failed ${url}: ${(e as Error).message}`); return null; }
  return `/${rel}`;
}

/* ---------------- run ---------------- */
const ONLY = new Set((process.env.ONLY ?? '').split(',').map((x) => x.trim()).filter(Boolean));
const runs = (id: string | undefined) => !ONLY.size || (!!id && ONLY.has(id));
const out: Record<string, OutRec> = {};
const log: string[] = [];
if (!ONLY.size) for (const u of PROBE) await fetchRaw(u);
const missingKeys = new Set(missing.map((p) => p.key));
const surnameOf = (n: string) => letters(n.split(/\s+/).pop() ?? '');

for (const src of SOURCES) {
  if (!runs(src.id)) continue;
  const links = new Set<string>();
  const listUrls = src.paged ? Array.from({ length: 15 }, (_, i) => src.list[0].replace('{n}', String(i + 1))) : src.list;
  for (const l of listUrls) {
    const pg = await getPage(l, src.render && !/\.xml$/.test(l)); // sitemaps are plain XML
    if (!pg) { log.push(`${src.id}: list unavailable ${l}`); if (src.paged) break; continue; }
    const n0 = links.size;
    for (const m of pg.html.matchAll(/href="([^"#?]+)"|<loc>\s*([^<\s]+)\s*<\/loc>/g)) { const u = abs(m[1] ?? m[2], l).replace(/\/$/, ''); if (src.link.test(u)) links.add(u); }
    if (src.paged && links.size === n0) break; // past the last page
  }
  // Only open profiles whose URL carries the surname of someone still missing a photo in that party (fewer requests);
  // identity is still decided on the profile page itself.
  const wanted = missing.filter((p) => p.group === src.group && p.ctx.some((c) => c.party && src.parties.includes(c.party))).map((p) => surnameOf(p.name)).filter((x) => x.length >= 3);
  const todo = [...links].filter((u) => { const slug = letters(u.split('/').pop() ?? ''); return wanted.some((w) => slug.includes(w)); });
  console.log(`${src.id}: ${links.size} profile pages, ${todo.length} for people still missing a photo`);
  const hits = new Map<string, { page: string; img: string; name: string }[]>();
  for (const page of todo) {
    const pg = await getPage(page, src.render);
    if (!pg) continue;
    const name = pageName(pg.html, pg.h1 && pg.h1.split(/\s+/).length >= 2 ? pg.h1 : undefined);
    if (name.split(/\s+/).length < 2) continue;
    const ms = matchPerson(src, name, pg.body ?? text(pg.html));
    if (ms.length !== 1) { if (ms.length > 1) log.push(`${src.id}: ${page} matches ${ms.length} people — skipped`); continue; }
    const img = pickImage(pg.html, page, name);
    if (!img) { log.push(`${src.id}: ${name} — no portrait tied to the person on ${page}`); continue; }
    const arr = hits.get(ms[0].key) ?? []; arr.push({ page, img, name }); hits.set(ms[0].key, arr);
  }
  for (const [key, arr] of hits) {
    if (arr.length > 1) { log.push(`${src.id}: ${key} has ${arr.length} pages — skipped`); continue; }
    if (out[key] || (ONLY.size && prev[key] && prev[key].c !== src.credit)) { log.push(`${src.id}: ${key} already filled by another source — skipped`); continue; }
    const p = people.get(key)!;
    const path = await saveImage(src.group, p.name, arr[0].img);
    if (path) out[key] = { p: path, s: arr[0].page, c: src.credit, i: arr[0].img, n: p.name };
    else log.push(`${src.id}: ${p.name} — image not usable (${arr[0].img})`);
  }
  console.log(`${src.id}: filled ${Object.values(out).filter((r) => r.c === src.credit).length}`);
}

for (const d of DIRECT) {
  if (!runs(d.id)) continue;
  if (d.key.startsWith('us:') && !missingKeys.has(d.key)) continue; // already has a free photo
  let img = d.img ?? null;
  if (!img) {
    const pg = await getPage(d.page, d.render);
    if (!pg) { log.push(`direct: ${d.name} page unavailable`); continue; }
    const t = fold(pg.body ?? text(pg.html));
    if (![d.name, ...(d.aliases ?? [])].some((n) => t.includes(fold(n)))) { log.push(`direct: ${d.name} not named on ${d.page}`); continue; }
    img = pickImage(pg.html, d.page, d.name, d.aliases);
  }
  if (!img) { log.push(`direct: ${d.name} — no portrait tied to the person`); continue; }
  const group: Group = d.key.startsWith('qid:') ? 'world' : 'us';
  const path = await saveImage(group, d.name, img);
  if (path) out[d.key] = { p: path, s: d.page, c: d.credit, i: img, n: d.name };
}
if (browser) await browser.close().catch(() => {});

// ONLY=…: keep the records of sources that were not run this time.
const added = Object.keys(out).filter((k) => !prev[k]);
if (ONLY.size) for (const [k, r] of Object.entries(prev)) if (!out[k] && existsSync(join(ROOT, 'public', r.p))) out[k] = r;

/* ---------------- write ---------------- */
let bytes = 0, addedBytes = 0;
for (const r of Object.values(out)) bytes += statSync(join(ROOT, 'public', r.p)).size;
for (const k of added) addedBytes += statSync(join(ROOT, 'public', out[k].p)).size;
const groupOf = (k: string) => (k.startsWith('qid:') ? 'world' : k.split(':')[0]);
const cover = (official: Record<string, OutRec>) => {
  const c: Record<string, { have: number; total: number }> = JSON.parse(JSON.stringify(before));
  for (const k of Object.keys(official)) { const g = groupOf(k); if (g === 'world') continue; if (people.get(k) && !hasFree(people.get(k)!)) c[g].have++; }
  // World leaders: totals from gen-photos.mts (PHOTO_STATS); official records fill QIDs with no free photo.
  const w = PHOTO_STATS.world;
  if (w) c.world = { have: w.free + Object.keys(official).filter((k) => k.startsWith('qid:') && !PHOTOS[k]).length, total: w.total };
  return c;
};
const was = cover(prev), now = cover(out);
const generated = new Date().toISOString().slice(0, 10);
writeFileSync(OUT, `// GENERATED by scripts/gen-official-photos.mts on ${generated} — do not hand-edit. Loaded lazily (see ./store.ts).
// Official headshots from party / parliament / government / campaign pages dedicated to each person, used only where no
// freely licensed portrait exists. p = local webp (public/), s = source page, c = credit line, i = original image URL, n = name.
// Keys match the other photo maps: au:<name key>, nz:<name key>, us:<name key> (2028), qid:<Wikidata QID> (world leaders).
// To remove a photo, add its slug (e.g. "au/jane-citizen") to ./blocklist.ts.
export interface OfficialRec { p: string; s: string; c: string; i: string; n: string }
export const OFFICIAL_GENERATED = ${JSON.stringify(generated)};
export const OFFICIAL: Record<string, OfficialRec> = ${JSON.stringify(out, null, 0)};
`);
console.log('\nblocked sites:'); for (const [h, why] of blocked) console.log(`  ${h}: ${why}`);
console.log('\nnotes:'); for (const l of log) console.log(`  ${l}`);
console.log('\nunreachable sites:'); for (const [h, why] of unreachable) console.log(`  ${h}: ${why}`);
if (noBrowser) console.log(`\nrendered sources skipped: ${noBrowser}`);
if (disallowed.size) { console.log('\nskipped (robots.txt disallow):'); for (const u of disallowed) console.log(`  ${u}`); }
console.log(`\n${Object.keys(out).length} official photos (${(bytes / 1024).toFixed(0)} KB); ${added.length} new this run (+${(addedBytes / 1024).toFixed(0)} KB)`);
console.log('coverage (free + official) before -> after:');
for (const g of Object.keys(now)) console.log(`  ${g}: ${was[g]?.have ?? 0}/${was[g]?.total ?? 0} -> ${now[g].have}/${now[g].total}   (free only: ${before[g]?.have ?? '-'})`);
