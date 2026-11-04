// Netlify Function (v2) — /api/parliament/* bill tracker. Same JSON as server/parliament.js (shared core).
// Env (optional): CONGRESS_API_KEY (api.data.gov), TVFY_API_KEY (theyvoteforyou.org.au).
import { parliamentApi } from '../../server/parliament.js';

export default async (req) => {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/api\/parliament/, '').replace(/^\/\.netlify\/functions\/parliament/, '');
  const env = { CONGRESS_API_KEY: process.env.CONGRESS_API_KEY, TVFY_API_KEY: process.env.TVFY_API_KEY };
  const r = await parliamentApi(sub || '/status', url.searchParams, env);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' };
  if (r.maxAge && r.status === 200) {
    headers['cache-control'] = 'public, max-age=120';
    headers['netlify-cdn-cache-control'] = `public, s-maxage=${r.maxAge}, stale-while-revalidate=${r.maxAge * 4}`;
  } else headers['cache-control'] = 'no-store';
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
};

export const config = { path: ['/api/parliament', '/api/parliament/*'] };
