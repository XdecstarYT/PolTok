/**
 * Live data layer. Connects to the API's SSE stream (/api/stream). If the API is
 * unreachable (e.g. static hosting), it falls back to running the shared simulation
 * engine in the browser, so the app is always "alive".
 *
 * Consumers: `const live = useLive();` — see LiveState below. Do not open your own
 * EventSource in feature code; extend this provider instead (coordinate first).
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { BalanceOfPower, LiveEvent, Market, NewsItem, RaceCallEvent, RaceResult } from '../types';
import { RACES, STATES } from '../data';
import { createSimulation } from '../../shared/sim.js';

export interface TickerItem {
  id: string;
  text: string;
  level: 'info' | 'alert' | 'breaking';
  at: number;
}

export interface LiveState {
  connected: boolean;
  mode: 'connecting' | 'live' | 'simulation' | 'browser-simulation';
  results: Record<string, RaceResult>;
  balance: Record<'senate' | 'house', BalanceOfPower | undefined>;
  calls: RaceCallEvent[]; // newest first
  news: NewsItem[]; // newest first
  markets: Market[];
  ticker: TickerItem[]; // newest first
  lastUpdate: number;
}

const initial: LiveState = {
  connected: false,
  mode: 'connecting',
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
      return { ...s, connected: true, mode: ev.mode, lastUpdate: now };
    case 'results': {
      const results = { ...s.results };
      for (const r of ev.results) results[r.raceId] = r;
      return { ...s, results, lastUpdate: now };
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

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>(initial);
  const queue = useRef<LiveEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let stopSim: (() => void) | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    // Batch incoming events into one render per animation frame.
    let raf = 0;
    const push = (ev: LiveEvent) => {
      queue.current.push(ev);
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          const evs = queue.current.splice(0);
          setState((s) => evs.reduce(reduce, s));
        });
    };

    const startBrowserSim = () => {
      if (stopSim || cancelled) return;
      es?.close();
      const sim = createSimulation({ races: RACES, states: STATES });
      const unsub = sim.subscribe(push);
      const snap = sim.snapshot();
      push({ type: 'hello', serverTime: Date.now(), mode: 'simulation' });
      setState((s) => ({ ...s, mode: 'browser-simulation' }));
      push({ type: 'results', results: snap.results });
      push({ type: 'balance', balance: snap.balance });
      push({ type: 'markets', markets: snap.markets });
      sim.start();
      stopSim = () => {
        unsub();
        sim.stop();
      };
      // Static fallback news, if the data agent provided any.
      import('../../shared/data/index.js')
        .then((m: { FALLBACK_NEWS?: unknown[] }) => {
          if (m.FALLBACK_NEWS?.length) push({ type: 'news', items: m.FALLBACK_NEWS as NewsItem[] });
        })
        .catch(() => {});
    };

    // Initial news fetch (stream will deliver updates after).
    fetch('/api/news?limit=200')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { items: NewsItem[] }) => d.items?.length && push({ type: 'news', items: d.items }))
      .catch(() => {});

    try {
      es = new EventSource('/api/stream');
      let opened = false;
      es.onmessage = (m) => {
        opened = true;
        try {
          push(JSON.parse(m.data) as LiveEvent);
        } catch {
          /* ignore malformed */
        }
      };
      es.onerror = () => {
        if (!opened) startBrowserSim();
        else setState((s) => ({ ...s, connected: false }));
      };
      fallbackTimer = setTimeout(() => !opened && startBrowserSim(), 3500);
    } catch {
      startBrowserSim();
    }

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      cancelAnimationFrame(raf);
      es?.close();
      stopSim?.();
    };
  }, []);

  return <LiveCtx.Provider value={state}>{children}</LiveCtx.Provider>;
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
