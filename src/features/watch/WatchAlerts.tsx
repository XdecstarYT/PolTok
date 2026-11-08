/** Headless: toasts (+ optional browser notifications) when a watched race is called or its leader changes. */
import { useEffect, useRef } from 'react';
import { useLive } from '../../lib/live';
import { useSettings } from '../../lib/settings';
import { useWatchlist, isAuWatchId } from '../../lib/watchlist';
import { useToast } from '../../components';
import { raceById } from '../../data';
import { candidatesOf, leaderOf } from './shares';

export function notifyBrowser(title: string, body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const n = new Notification(title, { body, tag: `poltok-${title}`, icon: '/favicon.svg' });
    n.onclick = () => {
      window.focus();
      window.location.assign('/watch');
    };
  } catch {
    /* not supported */
  }
}

export function WatchAlerts() {
  const { results } = useLive();
  const { ids } = useWatchlist();
  const { settings } = useSettings();
  const toast = useToast();
  const seen = useRef(new Map<string, { leader?: string; called?: string }>());
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    const off = settings.alerts === 'off';
    for (const id of ids) {
      if (isAuWatchId(id)) continue;
      const race = raceById.get(id);
      if (!race) continue;
      const r = results[id];
      if (!r) continue; // wait for real data before priming
      const now = { leader: leaderOf(race, r), called: r.calledFor };
      const prev = seen.current.get(id);
      seen.current.set(id, now);
      if (!prev || off) continue; // first sighting just primes state
      const name = (cid?: string) => candidatesOf(race, r).find((c) => c.id === cid);
      if (now.called && now.called !== prev.called && !(r.calledAt && r.calledAt < mountedAt.current - 5 * 60e3)) {
        const w = name(now.called);
        const title = `${race.title}: ${w?.name ?? 'Winner'} wins`;
        const body = `Race called for ${w?.name ?? now.called}${w ? ` (${w.party})` : ''} · AP via NYT`;
        toast.push({ kicker: '★ WATCHLIST · RACE CALL', title, body, tone: w?.party === 'D' ? 'dem' : w?.party === 'R' ? 'rep' : 'ind', to: `/race/${id}`, duration: 9000 });
        notifyBrowser(title, body);
      } else if (!now.called && prev.leader && now.leader && now.leader !== prev.leader) {
        const l = name(now.leader);
        const title = `${race.title}: lead change`;
        const body = `${l?.name ?? 'New leader'}${l ? ` (${l.party})` : ''} takes the lead · ${Math.round(r.expectedPct ?? 0)}% in`;
        toast.push({ kicker: '★ WATCHLIST · LEAD CHANGE', title, body, tone: 'alert', to: `/race/${id}` });
        notifyBrowser(title, body);
      }
    }
  }, [results, ids, settings.alerts, toast]);

  return null;
}
