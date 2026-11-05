// Netlify Function (v2) — /api/money campaign finance (OpenFEC). Same JSON as server/money.js.
// Env (optional): FEC_API_KEY (free api.data.gov key; falls back to the shared, tightly limited DEMO_KEY).
import { moneyApi } from '../../server/money.js';

export default async (req) => {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/api\/money/, '').replace(/^\/\.netlify\/functions\/money/, '');
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' };
  try {
    const r = await moneyApi(sub, { FEC_API_KEY: process.env.FEC_API_KEY });
    if (r.maxAge && r.status === 200) {
      headers['cache-control'] = 'public, max-age=300';
      headers['netlify-cdn-cache-control'] = `public, s-maxage=${r.maxAge}, stale-while-revalidate=${r.maxAge * 4}`;
    } else headers['cache-control'] = 'no-store';
    return new Response(JSON.stringify(r.body), { status: r.status, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502, headers: { ...headers, 'cache-control': 'no-store' } });
  }
};

export const config = { path: ['/api/money', '/api/money/*'] };
