import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, m } from 'framer-motion';
import { useLive } from '../../lib/live';
import { raceById } from '../../data';
import { PARTY_HEX, PARTY_NAME } from '../../lib/format';
import type { RaceCallEvent } from '../../types';
import { fmtET, useReducedMotion, useToast } from '../../components';
import { useSettings, playCallChime } from '../../lib/settings';
import { CallTakeover } from './CallTakeover';

const GRACE_MS = 5000; // calls arriving this soon after mount are the initial backlog
const MAX_AGE_MS = 90_000; // calls older than this (server replay) are backlog too
const SHOW_MS = 6500;

/**
 * Watches useLive().calls. New key-race calls or flips → full-screen "RACE CALL" takeover;
 * every other new call → toast. Backlog on load / reconnect is ignored.
 */
export function RaceCallWatcher() {
  const { calls } = useLive();
  const { settings } = useSettings();
  const toast = useToast();
  const reduce = useReducedMotion();
  const seen = useRef<Set<string> | null>(null);
  const mountedAt = useRef(Date.now());
  const [active, setActive] = useState<RaceCallEvent | null>(null);
  const queue = useRef<RaceCallEvent[]>([]);

  useEffect(() => {
    if (!seen.current) seen.current = new Set();
    const fresh = calls.filter((c) => !seen.current!.has(c.raceId));
    fresh.forEach((c) => seen.current!.add(c.raceId));
    if (!fresh.length) return;
    const now = Date.now();
    if (now - mountedAt.current < GRACE_MS || fresh.length > 6) return; // backlog burst
    for (const c of fresh.reverse()) {
      if (now - c.at > MAX_AGE_MS) continue;
      const race = raceById.get(c.raceId);
      const cand = race?.candidates.find((x) => x.id === c.candidateId);
      if (settings.alerts === 'off') continue;
      if (settings.sound) playCallChime(c.party);
      if (race?.key || c.flip) queue.current.push(c);
      else if (settings.alerts === 'all')
        toast.push({
          kicker: c.flip ? `FLIP · ${c.party} GAIN` : 'RACE CALL · AP',
          title: `${cand?.name ?? PARTY_NAME[c.party]} wins ${race?.title ?? c.raceId}`,
          body: `Projected ${fmtET(c.at)}`,
          tone: c.party === 'D' ? 'dem' : c.party === 'R' ? 'rep' : 'ind',
          to: `/race/${c.raceId}`,
        });
    }
    setActive((a) => a ?? queue.current.shift() ?? null);
  }, [calls, toast, settings.alerts, settings.sound]);

  // Preview hook: /?callDemo=GA-SEN plays the takeover for that race (no data is changed).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('callDemo');
    const race = id ? raceById.get(id) : undefined;
    const c = race?.candidates[0];
    if (race && c) setActive({ type: 'call', raceId: race.id, candidateId: c.id, party: c.party, flip: false, at: Date.now(), preview: true });
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setActive(queue.current.shift() ?? null), SHOW_MS);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActive(null);
    window.addEventListener('keydown', onKey);
    try { if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive) navigator.vibrate?.(40); } catch { /* noop */ }
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);

  const race = active ? raceById.get(active.raceId) : undefined;
  const cand = active && race?.candidates.find((x) => x.id === active.candidateId);
  const color = active ? PARTY_HEX[active.party] ?? '#888' : '#888';

  return (
    <AnimatePresence>
      {active && <CallTakeover key={active.raceId + active.at} call={active} reduce={reduce} onClose={() => setActive(null)} durationMs={SHOW_MS} />}
    </AnimatePresence>
  );
}
