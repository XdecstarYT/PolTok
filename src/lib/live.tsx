/**
 * Live data layer. Two result sources, chosen by the user (persisted):
 *   - 'live'       real AP results via the NYT results JSON (shared/nyt.js)
 *   - 'simulation' the seeded election-night simulation (shared/sim.js)
 * Connects to the API's SSE stream (/api/stream?source=…). If the API is unreachable
 * (static hosting), the same provider runs in the browser, and news is fetched from
 * CORS-friendly RSS routes (src/lib/browserNews.ts).
 *
 * Consumers: `const live = useLive();` — see LiveState below. Do not open your own
 * EventSource in feature code; extend this provider instead (coordinate first).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BalanceOfPower, LiveEvent, Market, NewsItem, RaceCallEvent, RaceResult } from '../types';
import { RACES, STATES, raceById } from '../data';
import { createSimulation } from '../../shared/sim.js';

export interface TickerItem {
  id: string;
  text: string;
  level: 'info' | 'alert' | 'breaking';
  at: number;
}

export type ResultsSource = 'live' | 'simulation';

export interface LiveState {
  connected: boolean;
  /** Where results come from right now. browser-* = no API server; computed in the browser. */
  mode: 'connecting' | 'live' | 'simulation' | 'browser-live' | 'browser-simulation';
  /** The user's chosen results source (persisted). */
  source: ResultsSource;
  setSource: (s: ResultsSource) => void;
  results: Record<string, RaceResult>;
  balance: Record<'senate' | 'house', BalanceOfPower | undefined>;
  calls: RaceCallEvent[]; // newest first
  news: NewsItem[]; // newest first
  markets: Market[];
  ticker: TickerItem[]; // newest first
  lastUpdate: number;
  /** Simulated Eastern-time election-night clock (simMinute = minutes after 18:00 ET). */
  clock?: SimClock;
}

export interface SimClock {
  simMinute: number;
  et: string;
  progress: number;
  final: boolean;
  /** true when this is the real wall clock (live mode) */
  live?: boolean;
}

const initial: LiveState = {
  connected: false,
  mode: 'connecting',
  source: 'live',
  setSource: () => {},
  results: {},
  balance: { senate: undefined, house: undefined },
  calls: [],
  news: [],
  markets: [],
  ticker: [],
  lastUpdate: 0,
};

const LiveCtx = createContext<LiveState>(initial);

let tickerSeq = 0;

function reduce(s: LiveState, ev: LiveEvent): LiveState {
  const now = Date.now();
  switch (ev.type) {
    case 'hello':
      return {
        ...s,
        connected: true,
        mode: s.mode === 'browser-live' || s.mode === 'browser-simulation' ? s.mode : ev.mode,
        lastUpdate: now,
      };
    case 'results': {
      const results = { ...s.results };
      for (const r of ev.results) results[r.raceId] = r;
      // Backfill calls for races already called in a snapshot (clients that join mid-night
      // never saw those 'call' events).
      const known = new Set(s.calls.map((c) => c.raceId));
      const backfill: RaceCallEvent[] = [];
      for (const r of ev.results) {
        if (!r.calledFor || known.has(r.raceId)) continue;
        const race = raceById.get(r.raceId);
        const cand = race?.candidates.find((c) => c.id === r.calledFor);
        if (!race || !cand) continue;
        const side = (p: string) => (p === 'I' ? 'D' : p);
        backfill.push({
          type: 'call',
          raceId: r.raceId,
          candidateId: cand.id,
          party: cand.party,
          flip: side(cand.party) !== side(race.incumbentParty),
          at: r.calledAt ?? r.updatedAt ?? now,
        });
      }
      const calls = backfill.length ? [...s.calls, ...backfill].sort((a, b) => b.at - a.at).slice(0, 200) : s.calls;
      return { ...s, results, calls, lastUpdate: now };
    }
    case 'balance': {
      const balance = { ...s.balance };
      for (const b of ev.balance) balance[b.chamber] = b;
      return { ...s, balance, lastUpdate: now };
    }
    case 'call':
      if (s.calls.some((c) => c.raceId === ev.raceId)) return s;
      return { ...s, calls: [ev, ...s.calls].slice(0, 200), lastUpdate: now };
    case 'news': {
      const seen = new Set(s.news.map((n) => n.id));
      const fresh = ev.items.filter((n) => !seen.has(n.id));
      if (!fresh.length) return s;
      const news = [...fresh, ...s.news].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 400);
      return { ...s, news, lastUpdate: now };
    }
    case 'markets':
      return { ...s, markets: ev.markets, lastUpdate: now };
    case 'ticker':
      return {
        ...s,
        ticker: [{ id: `t${++tickerSeq}`, text: ev.text, level: ev.level, at: now }, ...s.ticker].slice(0, 60),
        lastUpdate: now,
      };
    default:
      return s;
  }
}

// v2: everyone defaults back to live results; the demo replay is opt-in from Settings.
const SOURCE_KEY = 'poltok:source:v2';
function readSource(): ResultsSource {
  try {
    const v = localStorage.getItem(SOURCE_KEY);
    if (v === 'live' || v === 'simulation') return v;
  } catch {
    /* storage unavailable */
  }
  return 'live';
}

/** Apply the provider's authoritative candidate list (live mode) to the shared race objects. */
function syncCandidates(results: RaceResult[]) {
  for (const r of results) {
    if (!r.candidates?.length) continue;
    const race = raceById.get(r.raceId);
    if (!race) continue;
    const same =
      race.candidates.length === r.candidates.length &&
      race.candidates.every((c, i) => c.id === r.candidates![i].id && c.name === r.candidates![i].name && c.photo === r.candidates![i].photo);
    if (!same) race.candidates.splice(0, race.candidates.length, ...r.candidates.map((c) => ({ ...c })));
  }
}

type Provider = {
  start(): void;
  stop(): void;
  snapshot(): { results: RaceResult[]; balance: BalanceOfPower[]; markets: Market[] };
  subscribe(fn: (ev: LiveEvent) => void): () => void;
  clock?(): SimClock;
};

export function LiveProvider({ children }: { children: ReactNode }) {
  const [source, setSourceState] = useState<ResultsSource>(readSource);
  const [state, setState] = useState<LiveState>(() => ({ ...initial, source }));
  const queue = useRef<LiveEvent[]>([]);

  const setSource = useCallback((s: ResultsSource) => {
    try {
      localStorage.setItem(SOURCE_KEY, s);
    } catch {
      /* ignore */
    }
    setSourceState(s);
  }, []);

  /* ------------------------------- results ------------------------------- */
  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let browser: { stop(): void } | null = null;
    const timers: ReturnType<typeof setInterval>[] = [];
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    // Fresh slate for the new source (news is source-independent and kept).
    setState((s) => ({ ...initial, news: s.news, source, mode: 'connecting' }));
    queue.current = [];

    let raf = 0;
    const push = (ev: LiveEvent) => {
      if (cancelled) return;
      if (ev.type === 'results') syncCandidates(ev.results);
      queue.current.push(ev);
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          const evs = queue.current.splice(0);
          setState((s) => evs.reduce(reduce, s));
        });
    };

    const pollServerClock = () =>
      fetch(`/api/health?source=${source}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d: { clock?: SimClock }) => !cancelled && !browser && d.clock && setState((s) => ({ ...s, clock: d.clock })))
        .catch(() => {});

    const connectServer = () => {
      es?.close();
      let opened = false;
      es = new EventSource(`/api/stream?source=${source}`);
      es.onmessage = (m) => {
        opened = true;
        try {
          push(JSON.parse(m.data) as LiveEvent);
        } catch {
          /* ignore malformed */
        }
      };
      es.onerror = () => {
        if (!opened) startBrowser();
        else setState((s) => ({ ...s, connected: false }));
      };
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(() => !opened && startBrowser(), 3500);
      pollServerClock();
    };

    // No API server: run the same provider in the browser (NYT/AP live JSON is CORS-enabled).
    const startBrowser = async () => {
      if (browser || cancelled) return;
      browser = { stop() {} };
      es?.close();
      es = null;
      let p: Provider;
      if (source === 'live') {
        const { createNytProvider } = await import('../../shared/nyt.js');
        p = createNytProvider({ races: RACES, states: STATES, housePollMs: 180000 }) as Provider;
      } else {
        p = createSimulation({ races: RACES, states: STATES }) as Provider;
      }
      if (cancelled) return;
      const unsub = p.subscribe(push);
      const snap = p.snapshot();
      push({ type: 'hello', serverTime: Date.now(), mode: source === 'live' ? 'live' : 'simulation' });
      setState((s) => ({ ...s, mode: source === 'live' ? 'browser-live' : 'browser-simulation' }));
      push({ type: 'results', results: snap.results });
      push({ type: 'balance', balance: snap.balance });
      push({ type: 'markets', markets: snap.markets });
      p.start();
      const clockTimer = setInterval(() => {
        const c = p.clock?.();
        if (c) setState((s) => ({ ...s, clock: c }));
      }, 1000);
      // Keep checking whether the API server came up; if so, switch to it.
      const retry = setInterval(() => {
        fetch('/api/health')
          .then((r) => (r.ok ? r.json() : Promise.reject()))
          .then((d: { ok?: boolean }) => {
            if (!d?.ok || cancelled) return;
            browser?.stop();
            browser = null;
            setState((s) => ({ ...initial, news: s.news, source, mode: 'connecting' }));
            connectServer();
          })
          .catch(() => {});
      }, 20000);
      browser = {
        stop() {
          clearInterval(clockTimer);
          clearInterval(retry);
          unsub();
          p.stop();
        },
      };
    };

    timers.push(setInterval(pollServerClock, 5000));
    try {
      connectServer();
    } catch {
      startBrowser();
    }

    return () => {
      cancelled = true;
      timers.forEach(clearInterval);
      clearTimeout(fallbackTimer);
      cancelAnimationFrame(raf);
      es?.close();
      browser?.stop();
    };
  }, [source]);

  /* --------------------------------- news -------------------------------- */
  useEffect(() => {
    let cancelled = false;
    let serverFailures = 0;
    let lastBrowserFetch = 0;
    const add = (items: NewsItem[]) => !cancelled && items.length && setState((s) => reduce(s, { type: 'news', items }));
    const tick = async () => {
      try {
        const r = await fetch('/api/news?limit=200', { signal: AbortSignal.timeout(15000) });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as { items?: NewsItem[] };
        if (!Array.isArray(d.items)) throw new Error('bad payload');
        serverFailures = 0;
        add(d.items);
        return;
      } catch {
        serverFailures++;
      }
      // API unreachable: fetch real headlines straight from the browser (at most every 3 min).
      if (Date.now() - lastBrowserFetch > 3 * 60000) {
        lastBrowserFetch = Date.now();
        const { fetchBrowserNews } = await import('./browserNews');
        add(await fetchBrowserNews());
      }
    };
    tick();
    const t = setInterval(tick, 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const value = useMemo(() => ({ ...state, source, setSource }), [state, source, setSource]);
  return <LiveCtx.Provider value={value}>{children}</LiveCtx.Provider>;
}

export const useLive = () => useContext(LiveCtx);

/** Convenience: result for a single race (undefined until first snapshot). */
export function useRaceResult(raceId: string) {
  const { results } = useLive();
  return results[raceId];
}

/** Convenience: memoized sorted list of results for a chamber. */
export function useChamberResults(chamber: 'senate' | 'house' | 'governor') {
  const { results } = useLive();
  return useMemo(
    () => RACES.filter((r) => r.chamber === chamber).map((race) => ({ race, result: results[race.id] })),
    [results, chamber],
  );
}
