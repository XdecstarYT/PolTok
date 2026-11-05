// Netlify Function (v2) — /api/candidates/* enriched candidate profiles. Same JSON as server/candidates.js.
import { candidatesApi } from '../../server/candidates.js';

export default async (req) => {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/api\/candidates/, '');
  const r = await candidatesApi(sub, url.searchParams);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' };
  if (r.maxAge && r.status === 200) {
    headers['cache-control'] = 'public, max-age=600';
    headers['netlify-cdn-cache-control'] = `public, s-maxage=${r.maxAge}, stale-while-revalidate=${r.maxAge * 6}`;
  } else headers['cache-control'] = 'no-store';
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
};

export const config = { path: ['/api/candidates', '/api/candidates/*'] };
