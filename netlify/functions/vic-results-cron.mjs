// Scheduled every 2 minutes: from polls close (6pm AEDT Sat 28 Nov 2026) for two weeks, read the VEC district results
// pages, store a snapshot in Netlify Blobs ('poltok' / 'vic2026-results', served by /api/au/results) and append any
// changes (first results, lead changes, calls) to the live feed ('vic2026-events', served by /api/vic/events).
import { getStore } from '@netlify/blobs';
import { diffResults, discoverDistrictLinks, fetchVecDistricts, mergeSnapshot } from '../../shared/au/vec-results.js';
import IDS from '../../shared/au/vic-2022-primaries.json' with { type: 'json' };

const FROM = Date.parse('2026-11-28T07:00:00Z'), UNTIL = Date.parse('2026-12-12T00:00:00Z');

export default async () => {
  const now = Date.now();
  if (now < FROM || now > UNTIL) return new Response('inactive');
  const store = getStore('poltok');
  // find where the VEC actually published the 2026 district pages (cached once found)
  let links = Object.fromEntries(Object.entries((await store.get('vic2026-links', { type: 'json' }).catch(() => null)) ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (Object.keys(links).length < 80) { const d = await discoverDistrictLinks().catch(() => ({})); if (Object.keys(d).length > Object.keys(links).length) { links = d; await store.setJSON('vic2026-links', links); } }
  // Netlify ends scheduled functions at 30s: stop starting page reads after 20s and keep earlier figures for the rest
  const fresh = await fetchVecDistricts(Object.keys(IDS).sort(() => Math.random() - 0.5), { links: Object.keys(links).length ? links : null, budgetMs: 20000 });
  const prev = await store.get('vic2026-results', { type: 'json', consistency: 'strong' }).catch(() => null);
  const snap = mergeSnapshot(prev, fresh, Object.keys(IDS).length);
  await store.setJSON('vic2026-cron-status', { at: now, ...fresh.stats, seatsWithResults: Object.keys(snap.seats).length, sampleLink: Object.values(links)[0] ?? null });
  if (!Object.keys(snap.seats).length) return new Response(JSON.stringify(fresh.stats));
  const ev = diffResults(prev, snap, now);
  await store.setJSON('vic2026-results', snap);
  if (ev.length) {
    const old = (await store.get('vic2026-events', { type: 'json' }).catch(() => null)) ?? [];
    await store.setJSON('vic2026-events', [...ev, ...old].slice(0, 400));
  }
  return new Response(JSON.stringify({ ...fresh.stats, events: ev.length }));
};

export const config = { schedule: '*/2 * * * *' };
