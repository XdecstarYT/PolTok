// GET /api/pres2028 — live 2028 presidential Polymarket markets.
import { getPres2028 } from '../../server/pres2028.js';
import { json } from '../lib/util.mjs';

export default async () => {
  try { return json(await getPres2028(), 200, 120); }
  catch (e) { return json({ error: String(e.message || e), markets: [] }, 502); }
};

export const config = { path: '/api/pres2028' };
