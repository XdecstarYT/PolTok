/**
 * One-tap live-data post templates. Each fetches current data from the public API, then returns post text,
 * a CardData for the image and alt text. Numbers only ever come from the fetched data.
 */
import type { CardData, CardKind } from '../../../lib/cards';
import { raceById } from '../../../data';
import { assemblePost, SITE, trimToFit, utmUrl } from './xtext';

export interface LivePost {
  template: TemplateId;
  title: string;
  posts: string[];
  url: string;
  hashtags: string[];
  alt: string;
  card: CardData;
  cardKind: CardKind;
  design: string;
  asOf?: number;
  note?: string;
}
export type TemplateId = 'calls' | 'seats' | 'nz' | 'countdown' | 'news' | 'quorum';
export const TEMPLATES: { id: TemplateId; label: string; desc: string; icon: string }[] = [
  { id: 'calls', label: 'Race calls', desc: 'Latest AP race calls from /api/snapshot', icon: '🚨' },
  { id: 'seats', label: 'Seat count', desc: 'Senate + House balance of power', icon: '🏛️' },
  { id: 'nz', label: 'NZ result', desc: 'Party vote + seats from /api/nz/results', icon: '🇳🇿' },
  { id: 'countdown', label: 'Next election', desc: 'Countdown to the next election on the calendar', icon: '⏳' },
  { id: 'news', label: 'Top story', desc: 'Most-covered story with Left/Center/Right bars', icon: '📰' },
  { id: 'quorum', label: 'QUORUM promo', desc: 'Promote the QUORUM politics game', icon: '🎲' },
];

const D = '#3d7bff', R = '#ff3d55', I = '#b48cff', O = '#8a8f98';
const PC: Record<string, string> = { D, R, I, L: '#f5c400', G: '#2e9e44', O };
const NZC: Record<string, string> = { NAT: '#1f5fbf', LAB: '#d82a20', GRN: '#2e9e44', ACT: '#e8b400', NZF: '#6b6b6b', TPM: '#a2463c', OPP: '#1fb5a3' };
const NZN: Record<string, string> = { NAT: 'National', LAB: 'Labour', GRN: 'Greens', ACT: 'ACT', NZF: 'NZ First', TPM: 'Te Pāti Māori', OPP: 'Opportunity' };

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return (await r.json()) as T;
}
const link = (path: string, tpl: string) => utmUrl(SITE + path, `live-${tpl}`);
const pct = (n: number) => `${n.toFixed(1)}%`;

interface SnapRes { raceId: string; votes: Record<string, number>; expectedPct: number; calledFor?: string; calledAt?: number; updatedAt?: number; candidates?: { id: string; name: string; party: string; photo?: string }[] }
interface Bal { chamber: string; majority: number; dem: number; rep: number; ind: number; undecided: number; total: number }
interface Snap { results: SnapRes[] | Record<string, SnapRes>; balance: Bal[] | Record<string, Bal> }

async function snapshot() {
  const s = await getJson<Snap>('/api/snapshot');
  const results = Array.isArray(s.results) ? s.results : Object.values(s.results ?? {});
  const bal = Array.isArray(s.balance) ? s.balance : Object.entries(s.balance ?? {}).map(([chamber, b]) => ({ ...b, chamber }));
  return { results, bal };
}

function raceLine(r: SnapRes) {
  const race = raceById.get(r.raceId);
  const cands = r.candidates ?? race?.candidates ?? [];
  const total = Object.values(r.votes).reduce((a, b) => a + b, 0) || 1;
  const rows = cands.map((c) => ({ c, pct: (100 * (r.votes[c.id] || 0)) / total })).sort((a, b) => b.pct - a.pct);
  const w = rows.find((x) => x.c.id === r.calledFor) ?? rows[0];
  const flip = race && w ? (w.c.party === 'I' ? 'D' : w.c.party) !== (race.incumbentParty === 'I' ? 'D' : race.incumbentParty) : false;
  return { race, rows, w, flip, title: race?.title ?? r.raceId };
}

async function calls(): Promise<LivePost> {
  const { results, bal } = await snapshot();
  const called = results.filter((r) => r.calledFor).sort((a, b) => (b.calledAt ?? 0) - (a.calledAt ?? 0));
  if (!called.length) throw new Error('No races have been called yet.');
  const top = called.slice(0, 3).map(raceLine);
  const lead = top[0];
  const sen = bal.find((b) => b.chamber === 'senate');
  const url = link(lead.race ? `/race/${lead.race.id}` : '/live', 'calls');
  const lines = top.map((x) => `• ${x.w.c.name} (${x.w.c.party}) wins ${x.title}${x.flip ? ' 🔄 FLIP' : ''}`).join('\n');
  const tail = sen ? `\n\nSenate now: D ${sen.dem + sen.ind} – R ${sen.rep}, ${sen.undecided} undecided.` : '';
  const text = assemblePost(`🚨 Latest race calls [AP via NYT]:\n${lines}${tail}`, { tags: ['ElectionNight', 'Midterms2026'], url });
  const r0 = called[0];
  const card: CardData = {
    kind: 'race',
    title: `${lead.w.c.name} wins`,
    subtitle: `${lead.title}${lead.flip ? ' — a flip' : ''} · ${Math.round(r0.expectedPct)}% in`,
    party: lead.w.c.party,
    color: PC[lead.w.c.party] ?? O,
    photo: (lead.w.c as { photo?: string }).photo,
    photo2: (lead.rows[1]?.c as { photo?: string } | undefined)?.photo,
    stats: lead.rows.slice(0, 2).map((x) => ({ label: `${x.c.name} (${x.c.party})`, value: pct(x.pct), color: PC[x.c.party] ?? O })),
    bars: lead.rows.slice(0, 3).map((x) => ({ label: x.c.name, value: +x.pct.toFixed(1), color: PC[x.c.party] ?? O })),
    mapState: lead.race?.state,
    footer: 'Results: AP via The New York Times',
    url,
  };
  return {
    template: 'calls', title: `Call: ${lead.w.c.name} wins ${lead.title}`, posts: [text], url, hashtags: ['#ElectionNight', '#Midterms2026'], card, cardKind: 'race', design: 'h2h', asOf: r0.calledAt,
    alt: `Race call card: ${lead.w.c.name} (${lead.w.c.party}) wins the ${lead.title}. ${lead.rows.slice(0, 2).map((x) => `${x.c.name} ${pct(x.pct)}`).join(', ')}, ${Math.round(r0.expectedPct)}% of the expected vote counted. Source: AP via NYT.`,
  };
}

async function seats(): Promise<LivePost> {
  const { bal, results } = await snapshot();
  const s = bal.find((b) => b.chamber === 'senate'), h = bal.find((b) => b.chamber === 'house');
  if (!s || !h) throw new Error('Balance of power not available.');
  const line = (b: Bal, n: string) => `${n}: D ${b.dem + b.ind} – R ${b.rep}${b.undecided ? ` (${b.undecided} undecided)` : ''} · ${b.majority} for majority`;
  const url = link('/live', 'seats');
  const text = assemblePost(`🏛️ Balance of power right now [AP via NYT]:\n${line(s, 'Senate')}\n${line(h, 'House')}\n\nEvery seat, live 👇`, { tags: ['Midterms2026', 'BalanceOfPower'], url });
  const card: CardData = {
    kind: 'balance',
    title: 'Senate & House seat count',
    subtitle: `Senate D ${s.dem + s.ind}–${s.rep} R · House D ${h.dem + h.ind}–${h.rep} R`,
    stats: [
      { label: 'Senate Dem', value: String(s.dem + s.ind), color: D }, { label: 'Senate GOP', value: String(s.rep), color: R },
      { label: 'House Dem', value: String(h.dem + h.ind), color: D }, { label: 'House GOP', value: String(h.rep), color: R },
    ],
    bars: [
      { label: 'Senate D', value: s.dem + s.ind, color: D }, { label: 'Senate R', value: s.rep, color: R },
      { label: 'House D', value: h.dem + h.ind, color: D }, { label: 'House R', value: h.rep, color: R },
    ],
    footer: 'Results: AP via The New York Times',
    url,
  };
  const asOf = Math.max(0, ...results.map((r) => r.updatedAt ?? 0)) || undefined;
  return {
    template: 'seats', title: 'Balance of power', posts: [text], url, hashtags: ['#Midterms2026', '#BalanceOfPower'], card, cardKind: 'balance', design: 'hemicycle', asOf,
    alt: `Seat count card. Senate: Democrats ${s.dem + s.ind}, Republicans ${s.rep}, ${s.undecided} undecided. House: Democrats ${h.dem + h.ind}, Republicans ${h.rep}, ${h.undecided} undecided. Source: AP via NYT.`,
  };
}

interface NzRes { status?: string; heading?: string; updatedAt?: number; votesCountedPct?: number | null; party: { party: string; name: string; pct: number; totalSeats: number }[] }
async function nz(): Promise<LivePost> {
  const d = await getJson<NzRes>('/api/nz/results');
  const ps = (d.party ?? []).filter((p) => p.pct > 0).sort((a, b) => b.pct - a.pct);
  if (!ps.length) throw new Error('NZ results not available.');
  const unofficial = /unofficial|wikipedia/i.test(d.heading ?? '') || d.status !== 'final';
  const url = link('/nz', 'nz');
  const seatsLine = ps.filter((p) => p.totalSeats).map((p) => `${NZN[p.party] ?? p.party} ${p.totalSeats}`).join(' · ');
  const text = assemblePost(
    `🇳🇿 NZ election 2026${unofficial ? ' (preliminary, unofficial)' : ''}:\n${ps.slice(0, 5).map((p) => `${NZN[p.party] ?? p.name} ${pct(p.pct)}`).join(' · ')}${seatsLine ? `\n\nSeats: ${seatsLine}` : ''}`,
    { tags: ['nzpol', 'NZElection'], url },
  );
  const card: CardData = {
    kind: 'stat',
    title: 'New Zealand election 2026',
    subtitle: `${unofficial ? 'Preliminary · unofficial · ' : ''}party vote`,
    stats: ps.slice(0, 4).map((p) => ({ label: NZN[p.party] ?? p.party, value: pct(p.pct), color: NZC[p.party] ?? O })),
    bars: ps.slice(0, 7).map((p) => ({ label: NZN[p.party] ?? p.party, value: +p.pct.toFixed(1), color: NZC[p.party] ?? O })),
    footer: d.heading ? `Source: ${d.heading}` : 'Source: Electoral Commission',
    url,
  };
  return {
    template: 'nz', title: 'NZ election result', posts: [text], url, hashtags: ['#nzpol', '#NZElection'], card, cardKind: 'stat', design: 'waterfall', asOf: d.updatedAt,
    note: unofficial ? 'Result is labelled unofficial — keep the “preliminary, unofficial” wording.' : undefined,
    alt: `Bar chart of the New Zealand 2026 election party vote${unofficial ? ' (preliminary, unofficial)' : ''}: ${ps.slice(0, 7).map((p) => `${NZN[p.party] ?? p.party} ${pct(p.pct)}${p.totalSeats ? `, ${p.totalSeats} seats` : ''}`).join('; ')}.`,
  };
}

interface CalEv { id: string; date: string; start?: number; title: string; type: string; country: string; link?: string; jurisdiction: string }
async function countdown(now = Date.now()): Promise<LivePost> {
  const d = await getJson<{ events: CalEv[] }>('/api/calendar');
  const ts = (e: CalEv) => e.start ?? Date.parse(e.date + 'T12:00:00Z');
  const ev = d.events.filter((e) => e.type === 'election' && ts(e) > now).sort((a, b) => ts(a) - ts(b))[0];
  if (!ev) throw new Error('No upcoming election on the calendar.');
  const days = Math.ceil((ts(ev) - now) / 864e5);
  const when = new Date(Date.parse(ev.date + 'T12:00:00Z')).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const path = ev.link ?? '/calendar';
  const url = link(path, 'countdown');
  const tags = ev.country === 'AU' ? ['auspol', ev.jurisdiction === 'Victoria' ? 'VicVotes' : ev.jurisdiction === 'New South Wales' ? 'nswpol' : 'auspol'] : ['Elections', 'USpolitics'];
  const text = assemblePost(`⏳ ${days} day${days === 1 ? '' : 's'} to go: ${ev.title} — ${when}.\n\nSeats, candidates and live results on PolTok:`, { tags, url });
  const card: CardData = { kind: 'promo', title: ev.title, subtitle: `${days} day${days === 1 ? '' : 's'} to go · ${when}`, countdownTo: ts(ev), footer: `PolTok · ${ev.jurisdiction}`, cta: url.replace(/^https:\/\//, '').replace(/\?.*$/, ''), url };
  return {
    template: 'countdown', title: `Countdown: ${ev.title}`, posts: [text], url, hashtags: tags.map((t) => '#' + t), card, cardKind: 'promo', design: 'countdown',
    alt: `Countdown card: ${days} days until the ${ev.title} on ${when}.`,
  };
}

interface NewsIt { id: string; title: string; source: string; sourceLean: string; clusterId?: string; publishedAt: number }
const side = (l: string) => (/left/i.test(l) ? 'Left' : /right/i.test(l) ? 'Right' : /center/i.test(l) ? 'Center' : '');
export function topCluster(items: NewsIt[]) {
  const m = new Map<string, NewsIt[]>();
  for (const i of items) {
    const k = i.clusterId || i.id;
    (m.get(k) ?? m.set(k, []).get(k)!).push(i);
  }
  let best: { id: string; items: NewsIt[]; sources: number } | null = null;
  for (const [id, arr] of m) {
    const sources = new Set(arr.map((x) => x.source)).size;
    if (!best || sources > best.sources || (sources === best.sources && Math.max(...arr.map((x) => x.publishedAt)) > Math.max(...best.items.map((x) => x.publishedAt)))) best = { id, items: arr, sources };
  }
  if (!best) return null;
  const c = { Left: 0, Center: 0, Right: 0 };
  const seen = new Set<string>();
  for (const i of best.items) {
    const s = side(i.sourceLean);
    if (!s || seen.has(i.source)) continue;
    seen.add(i.source);
    c[s as keyof typeof c]++;
  }
  return { ...best, coverage: c, lead: [...best.items].sort((a, b) => a.publishedAt - b.publishedAt)[0] };
}
async function news(): Promise<LivePost> {
  const d = await getJson<{ items: NewsIt[] }>('/api/news?limit=300');
  const t = topCluster(d.items ?? []);
  if (!t) throw new Error('No news yet.');
  const tot = t.coverage.Left + t.coverage.Center + t.coverage.Right || 1;
  const p = (n: number) => Math.round((100 * n) / tot);
  const url = link(`/story/${encodeURIComponent(t.id)}`, 'news');
  const title = trimToFit(t.lead.title, 120);
  const text = assemblePost(`📰 Top story right now: “${title}”\n\nCovered by ${t.sources} outlets — Left ${p(t.coverage.Left)}% · Center ${p(t.coverage.Center)}% · Right ${p(t.coverage.Right)}%. See every angle:`, { tags: ['News', 'MediaBias'], url });
  const card: CardData = {
    kind: 'stat',
    title,
    subtitle: `${t.sources} outlets covering this story`,
    stats: [{ label: 'Left', value: `${p(t.coverage.Left)}%`, color: D }, { label: 'Center', value: `${p(t.coverage.Center)}%`, color: '#c9cfdf' }, { label: 'Right', value: `${p(t.coverage.Right)}%`, color: R }],
    bars: [{ label: 'Left', value: t.coverage.Left, color: D }, { label: 'Center', value: t.coverage.Center, color: '#c9cfdf' }, { label: 'Right', value: t.coverage.Right, color: R }],
    footer: `First reported by ${t.lead.source}`,
    url,
  };
  return {
    template: 'news', title: `Top story: ${title}`, posts: [text], url, hashtags: ['#News', '#MediaBias'], card, cardKind: 'stat', design: 'broadcast', asOf: Math.max(...t.items.map((x) => x.publishedAt)),
    alt: `News coverage card for “${title}”: ${t.sources} outlets. Coverage bars — Left ${p(t.coverage.Left)}%, Center ${p(t.coverage.Center)}%, Right ${p(t.coverage.Right)}%.`,
  };
}

function quorum(): LivePost {
  const url = link('/play', 'quorum');
  const text = assemblePost('🎲 Think you could run a government? QUORUM drops you into the Calderra parliament: build a coalition, pass a budget and survive the confidence vote. Free, in your browser.', { tags: ['QUORUM', 'PoliticsGame'], url });
  const card: CardData = { kind: 'promo', title: 'QUORUM', subtitle: 'Build a coalition. Pass the budget. Survive the vote.', footer: 'Free politics strategy game · PolTok', cta: 'poltok.netlify.app/play', url };
  return { template: 'quorum', title: 'QUORUM game promo', posts: [text], url, hashtags: ['#QUORUM', '#PoliticsGame'], card, cardKind: 'promo', design: 'synthwave', alt: 'Promo card for QUORUM, a free politics strategy game on PolTok: build a coalition, pass the budget, survive the vote.' };
}

export async function buildLivePost(id: TemplateId): Promise<LivePost> {
  switch (id) {
    case 'calls': return calls();
    case 'seats': return seats();
    case 'nz': return nz();
    case 'countdown': return countdown();
    case 'news': return news();
    case 'quorum': return quorum();
  }
}
