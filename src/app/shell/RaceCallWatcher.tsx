import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLive } from '../../lib/live';
import { raceById } from '../../data';
import { PARTY_HEX, PARTY_NAME } from '../../lib/format';
import type { RaceCallEvent } from '../../types';
import { Avatar, SimBadge, fmtET, useReducedMotion, useToast } from '../../components';

const GRACE_MS = 5000; // calls arriving this soon after mount are the initial backlog
const MAX_AGE_MS = 90_000; // calls older than this (server replay) are backlog too
const SHOW_MS = 3600;

/**
 * Watches useLive().calls. New key-race calls or flips → full-screen "RACE CALL" takeover;
 * every other new call → toast. Backlog on load / reconnect is ignored.
 */
export function RaceCallWatcher() {
  const { calls } = useLive();
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
      if (race?.key || c.flip) queue.current.push(c);
      else
        toast.push({
          kicker: c.flip ? `FLIP · ${c.party} GAIN` : 'RACE CALL · SIMULATED',
          title: `${cand?.name ?? PARTY_NAME[c.party]} wins ${race?.title ?? c.raceId}`,
          body: `Projected ${fmtET(c.at)}`,
          tone: c.party === 'D' ? 'dem' : c.party === 'R' ? 'rep' : 'ind',
          to: `/race/${c.raceId}`,
        });
    }
    setActive((a) => a ?? queue.current.shift() ?? null);
  }, [calls, toast]);

  // QA hook: /?callDemo=GA-SEN previews the takeover for that race (labelled simulated as always).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('callDemo');
    const race = id ? raceById.get(id) : undefined;
    const c = race?.candidates[0];
    if (race && c) setActive({ type: 'call', raceId: race.id, candidateId: c.id, party: c.party, flip: false, at: Date.now() });
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
      {active && (
        <motion.div
          key={active.raceId}
          className="rc"
          role="alertdialog"
          aria-live="assertive"
          aria-label={`Race call: ${race?.title ?? active.raceId}`}
          style={{ '--rc': color } as CSSProperties}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.35 } }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onClick={() => setActive(null)}
        >
          <motion.div
            className="rc__slab"
            initial={reduce ? false : { x: '-105%', skewX: -8 }}
            animate={{ x: 0, skewX: 0 }}
            transition={{ duration: 0.55, ease: [0.7, 0, 0.2, 1] }}
          />
          <div className="rc__inner" onClick={(e) => e.stopPropagation()}>
            <motion.div className="rc__kicker" initial={reduce ? false : { y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
              <span className="pulse" style={{ '--pulse-c': '#fff' } as CSSProperties} aria-hidden="true" />
              {active.flip ? `${active.party === 'D' ? 'DEMOCRATIC' : active.party === 'R' ? 'REPUBLICAN' : 'INDEPENDENT'} PICKUP` : 'KEY RACE ALERT'}
            </motion.div>
            <motion.div className="rc__title" initial={reduce ? false : { y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.38 }}>
              {race?.title ?? active.raceId}
            </motion.div>
            <motion.div className="rc__winner" initial={reduce ? false : { y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.46 }}>
              {cand && <Avatar name={cand.name} party={active.party} src={cand.photo} size={64} />}
              <div>
                <div className="rc__name">{cand?.name ?? PARTY_NAME[active.party]}</div>
                <div className="rc__party">{PARTY_NAME[active.party]} · projected winner · {fmtET(active.at)}</div>
              </div>
            </motion.div>
            <motion.div
              className="rc__stamp"
              initial={reduce ? false : { scale: 2.2, opacity: 0, rotate: -14 }}
              animate={{ scale: 1, opacity: 1, rotate: -8 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 380, damping: 16 }}
            >
              CALLED
            </motion.div>
            <div className="rc__actions">
              <Link to={`/race/${active.raceId}`} className="btn btn--sm" onClick={() => setActive(null)}>Open race</Link>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setActive(null)} autoFocus>Dismiss</button>
              <SimBadge />
            </div>
            {!reduce && <motion.div className="rc__timer" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: SHOW_MS / 1000, ease: 'linear' }} />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
