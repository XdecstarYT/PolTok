/**
 * "Ask PolTok" client: builds a compact, grounded CONTEXT from live data and streams the
 * answer from POST /api/ai (Netlify function or Node server; the Groq key never reaches the browser).
 */
import type { LiveState } from './live';
import type { Race, RaceResult } from '../types';
import { RACES, raceById, stateByAbbr } from '../data';
import { VICTORIA, AU_POLLS, FEDERAL } from '../data/au';

export type AiMode = 'chat' | 'race' | 'brief';
export interface AiMsg {
  role: 'user' | 'assistant';
  content: string;
}
export type AiErrorCode = 'not_configured' | 'unavailable' | 'rate_limited' | 'too_large' | 'upstream' | 'bad_request' | 'bad_output';
export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

const SIDE = (p: string) => (p === 'I' ? 'D' : p);

function raceLine(race: Race, r: RaceResult | undefined) {
  const cands = r?.candidates?.length ? r.candidates : race.candidates;
  const total = r ? Object.values(r.votes).reduce((a, b) => a + b, 0) : 0;
  const rows = cands
    .map((c) => ({ name: c.name, party: c.party, pct: total && r ? +((100 * (r.votes[c.id] || 0)) / total).toFixed(1) : null, id: c.id }))
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));
  const winner = r?.calledFor ? cands.find((c) => c.id === r.calledFor) : undefined;
  return {
    id: race.id,
    race: race.title,
    incumbentParty: race.incumbentParty,
    status: r?.status ?? 'no data',
    reportingPct: r ? Math.round(r.expectedPct) : null,
    winner: winner ? `${winner.name} (${winner.party})` : null,
    flip: winner ? SIDE(winner.party) !== SIDE(race.incumbentParty) : null,
    candidates: rows.slice(0, 4).map(({ id: _id, ...x }) => x),
  };
}

function margin(r: RaceResult | undefined) {
  if (!r) return 100;
  const v = Object.values(r.votes).sort((a, b) => b - a);
  const t = v.reduce((a, b) => a + b, 0);
  return t ? (100 * ((v[0] || 0) - (v[1] || 0))) / t : 100;
}

const AU_RE = /\b(australia|australian|victoria|victorian|vic|albanese|allan|labor|coalition|one nation|greens|nsw|aec|vec)\b/i;

/** Build the grounded context JSON for a question. `raceId` narrows to one race. */
export async function buildContext(live: LiveState, question: string, raceId?: string) {
  const base = {
    note: 'Live results: AP via The New York Times (source name "AP via NYT").',
    mode: live.mode,
    asOf: live.lastUpdate ? new Date(live.lastUpdate).toISOString() : null,
    balanceOfPower: live.balance,
  };
  if (raceId) {
    const race = raceById.get(raceId);
    if (!race) return { ...base, race: null };
    const q = race.title.toLowerCase();
    const st = stateByAbbr.get(race.state)?.name.toLowerCase() ?? '';
    return {
      ...base,
      race: raceLine(race, live.results[race.id]),
      markets: live.markets.filter((m) => m.raceId === race.id).map((m) => ({ question: m.question, outcomes: m.outcomes, source: m.source })),
      headlines: live.news
        .filter((n) => `${n.title} ${n.summary ?? ''}`.toLowerCase().match(new RegExp(`${st}|${q.split(' ')[0]}`)))
        .slice(0, 10)
        .map((n) => ({ title: n.title, source: n.source })),
    };
  }
  const ql = question.toLowerCase();
  const mentioned = (race: Race) => {
    const s = stateByAbbr.get(race.state)?.name.toLowerCase();
    return ql.includes(race.id.toLowerCase()) || (!!s && ql.includes(s));
  };
  const statewide = RACES.filter((r) => r.chamber !== 'house');
  const house = RACES.filter((r) => r.chamber === 'house');
  const houseCalledFlips = house.filter((r) => {
    const res = live.results[r.id];
    const w = res?.calledFor && (res.candidates ?? r.candidates).find((c) => c.id === res.calledFor);
    return w && SIDE(w.party) !== SIDE(r.incumbentParty);
  });
  const houseClose = house
    .filter((r) => !live.results[r.id]?.calledFor && (live.results[r.id]?.expectedPct ?? 0) > 0)
    .sort((a, b) => margin(live.results[a.id]) - margin(live.results[b.id]))
    .slice(0, 6);
  const houseMentioned = house.filter(mentioned).slice(0, 8);
  const houseSet = [...new Map([...houseCalledFlips, ...houseClose, ...houseMentioned].map((r) => [r.id, r])).values()];

  const ctx: Record<string, unknown> = {
    ...base,
    note2: 'Screen subset only; the server adds full AP results.',
    senateAndGovernorRaces: statewide
      .filter((r) => mentioned(r) || !live.results[r.id]?.calledFor)
      .sort((a, b) => Number(mentioned(b)) - Number(mentioned(a)))
      .slice(0, 12)
      .map((r) => raceLine(r, live.results[r.id])),
    houseRaces: { note: 'Subset: called flips, closest uncalled, and districts mentioned in the question.', races: houseSet.map((r) => raceLine(r, live.results[r.id])) },
    recentCalls: live.calls.slice(0, 10).map((c) => ({ raceId: c.raceId, party: c.party, flip: c.flip, at: new Date(c.at).toISOString() })),
    markets: live.markets.filter((m) => !m.raceId).slice(0, 3).map((m) => ({ question: m.question, outcomes: m.outcomes, source: m.source })),
    headlines: live.news.slice(0, 8).map((n) => ({ title: n.title, source: n.source, at: new Date(n.publishedAt).toISOString() })),
  };
  if (AU_RE.test(question)) ctx.australia = await auContext();
  return ctx;
}

async function auContext() {
  const get = (u: string) =>
    fetch(u, { signal: AbortSignal.timeout(6000) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  const [news, results] = await Promise.all([get('/api/au/news?limit=15'), get('/api/au/results?contest=vic2026')]);
  return {
    victoria: {
      electionDate: VICTORIA.date,
      seats: VICTORIA.totalSeats,
      majority: VICTORIA.majority,
      premier: VICTORIA.premier,
      opposition: VICTORIA.opposition,
      composition: VICTORIA.composition,
      compositionNote: VICTORIA.compositionNote,
      polls: AU_POLLS.victoria.slice(0, 5).map((p) => ({ source: p.pollster, date: p.date, tpp: p.tpp, primary: p.primary })),
      results: results ? { status: results.status, source: results.source, seatsReported: Object.keys(results.seats ?? {}).length } : 'unavailable',
    },
    federalPolls: AU_POLLS.federal.slice(0, 4).map((p) => ({ source: p.pollster, date: p.date, tpp: p.tpp, primary: p.primary })),
    federalPm: (FEDERAL as { pm?: unknown }).pm ?? undefined,
    headlines: ((news?.items ?? []) as { title: string; source: string }[]).slice(0, 15).map((n) => ({ title: n.title, source: n.source })),
  };
}

/** Probe whether AI is configured (GET /api/ai). Cached for the session. */
let statusP: Promise<'ok' | 'not_configured' | 'unavailable'> | null = null;
export function aiStatus() {
  statusP ??= fetch('/api/ai', { signal: AbortSignal.timeout(5000) })
    .then(async (r) => {
      if (!r.ok) return 'unavailable' as const;
      const d = (await r.json()) as { configured?: boolean };
      return d.configured ? ('ok' as const) : ('not_configured' as const);
    })
    .catch(() => 'unavailable' as const);
  return statusP;
}

/** Stream an answer. Calls onDelta with the accumulated text. Throws AiError. */
export async function askAi(
  opts: { question: string; context: unknown; history?: AiMsg[]; mode?: AiMode; signal?: AbortSignal },
  onDelta: (full: string) => void,
): Promise<string> {
  let r: Response;
  try {
    r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: opts.question, context: fitContext(opts.context), history: opts.history, mode: opts.mode ?? 'chat' }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AiError('unavailable', 'The AI service could not be reached.');
  }
  const ct = r.headers.get('content-type') || '';
  if (!r.ok || ct.includes('json') || ct.includes('html')) {
    let d: { error?: string; code?: AiErrorCode } = {};
    try {
      d = ct.includes('json') ? await r.json() : {};
    } catch {
      /* ignore */
    }
    const code: AiErrorCode = d.code ?? (r.status === 404 || ct.includes('html') ? 'unavailable' : 'upstream');
    if (code === 'not_configured') statusP = Promise.resolve('not_configured');
    throw new AiError(code, d.error ?? 'AI is unavailable right now.');
  }
  const reader = r.body!.getReader();
  const dec = new TextDecoder();
  let full = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += dec.decode(value, { stream: true });
    onDelta(full);
  }
  return full;
}

/** Source names cited as [Name] in an answer. */
export function citedSources(text: string) {
  return [...new Set([...text.replace(/\[\[[^\]\n]*\]\]/g, '').matchAll(/\[([^\]\n]{2,40})\]/g)].map((m) => m[1].trim()))];
}

/**
 * Keep the screen context small (the server adds its own retrieved live facts + guide, ~6k tokens total):
 * repeatedly halve the longest array (headlines, races, calls…) until it fits.
 */
export function fitContext(ctx: unknown, maxChars = 3500): unknown {
  if (ctx == null) return ctx;
  const c = JSON.parse(JSON.stringify(ctx));
  const arrays = (o: unknown, out: unknown[][] = []): unknown[][] => {
    if (Array.isArray(o)) {
      out.push(o);
      o.forEach((x) => arrays(x, out));
    } else if (o && typeof o === 'object') Object.values(o).forEach((x) => arrays(x, out));
    return out;
  };
  for (let i = 0; i < 40 && JSON.stringify(c).length > maxChars; i++) {
    const list = arrays(c).filter((a) => a.length > 1).sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length);
    if (!list.length) break;
    list[0].splice(Math.ceil(list[0].length / 2));
  }
  return c;
}

/* ---- Owner "Make with AI": non-streaming JSON compose ---- */
export interface ComposeDesign { id: string; name: string; kinds: string[]; w?: number; h?: number }
export type ComposeTask = 'post' | 'message' | 'restyle' | 'rewrite' | 'social';
export async function composeAi(opts: { prompt: string; designs?: ComposeDesign[]; temperature?: number; signal?: AbortSignal; task?: ComposeTask; card?: unknown; settings?: unknown; platforms?: string[] }): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: opts.prompt.slice(0, 600), mode: 'compose', task: opts.task ?? 'post', designs: opts.designs ?? [], card: opts.card, settings: opts.settings, platforms: opts.platforms, temperature: opts.temperature ?? 0.4 }),
      signal: opts.signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new AiError('unavailable', 'The AI service could not be reached.');
  }
  const ct = r.headers.get('content-type') || '';
  let d: { ok?: boolean; result?: unknown; error?: string; code?: AiErrorCode } = {};
  try {
    d = ct.includes('json') ? await r.json() : {};
  } catch {
    /* ignore */
  }
  if (!r.ok || !d.ok) {
    const code: AiErrorCode = d.code ?? (r.status === 413 ? 'too_large' : r.status === 429 ? 'rate_limited' : r.status === 404 || ct.includes('html') ? 'unavailable' : 'upstream');
    if (code === 'not_configured') statusP = Promise.resolve('not_configured');
    throw new AiError(code, d.error ?? 'AI is unavailable right now.');
  }
  return d.result;
}
