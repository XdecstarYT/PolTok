// Scheduled every 2 minutes: from polls close (6pm AEDT Sat 28 Nov 2026) for two weeks, read the VEC district results
// pages, store a snapshot in Netlify Blobs ('poltok' / 'vic2026-results', served by /api/au/results) and append any
// changes (first results, lead changes, calls) to the live feed ('vic2026-events', served by /api/vic/events).
import { getStore } from '@netlify/blobs';
import { diffResults, fetchVecDistricts } from '../../shared/au/vec-results.js';
import IDS from '../../shared/au/vic-2022-primaries.json' with { type: 'json' };

const FROM = Date.parse('2026-11-28T07:00:00Z'), UNTIL = Date.parse('2026-12-12T00:00:00Z');

export default async () => {
  const now = Date.now();
  if (now < FROM || now > UNTIL) return new Response('inactive');
  const store = getStore('poltok');
  const snap = await fetchVecDistricts(Object.keys(IDS));
  if (!Object.keys(snap.seats).length) return new Response(JSON.stringify(snap.stats));
  const prev = await store.get('vic2026-results', { type: 'json' }).catch(() => null);
  const ev = diffResults(prev, snap, now);
  await store.setJSON('vic2026-results', snap);
  if (ev.length) {
    const old = (await store.get('vic2026-events', { type: 'json' }).catch(() => null)) ?? [];
    await store.setJSON('vic2026-events', [...ev, ...old].slice(0, 400));
  }
  return new Response(JSON.stringify({ ...snap.stats, events: ev.length }));
};

export const config = { schedule: '*/2 * * * *' };
