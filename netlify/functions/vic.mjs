// GET /api/vic/live — live Victorian election dashboard data (polls, uniform-swing projection, VEC early votes).
import { fetchVicLive } from '../../shared/au/vic-live.js';
import { cached, json } from '../lib/util.mjs';

const live = cached(10 * 60 * 1000, fetchVicLive);

export default async () => {
  try {
    return json(await live(), 200, 600);
  } catch (e) {
    return json({ error: 'Victorian live data unavailable', detail: String(e?.message ?? e) }, 502);
  }
};

export const config = { path: ['/api/vic/live'] };
