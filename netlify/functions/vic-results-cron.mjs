// Scheduled every 2 minutes: from polls close (6pm AEDT Sat 28 Nov 2026) for two weeks, read the VEC district results
// pages and store a snapshot in Netlify Blobs ('poltok' / 'vic2026-results'), which /api/au/results serves.
import { getStore } from '@netlify/blobs';
import { fetchVecDistricts } from '../../shared/au/vec-results.js';
import IDS from '../../shared/au/vic-2022-primaries.json' with { type: 'json' };

const FROM = Date.parse('2026-11-28T07:00:00Z'), UNTIL = Date.parse('2026-12-12T00:00:00Z');

export default async () => {
  const now = Date.now();
  if (now < FROM || now > UNTIL) return new Response('inactive');
  const snap = await fetchVecDistricts(Object.keys(IDS));
  if (Object.keys(snap.seats).length) await getStore('poltok').setJSON('vic2026-results', snap);
  return new Response(JSON.stringify(snap.stats));
};

export const config = { schedule: '*/2 * * * *' };
