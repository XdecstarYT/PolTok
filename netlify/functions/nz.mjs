// Netlify Function (v2) — /api/nz/* NZ 2026 election: live Electoral Commission results (60s cache), electorate detail, NZ news.
import { nzApi } from '../../server/nz.js';

export default async (req) => {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/api\/nz/, '');
  const r = await nzApi(sub || '/results', url.searchParams);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' };
  if (r.maxAge && r.status === 200) {
    headers['cache-control'] = 'public, max-age=30';
    headers['netlify-cdn-cache-control'] = `public, s-maxage=${r.maxAge}, stale-while-revalidate=${r.maxAge}`;
  } else headers['cache-control'] = 'no-store';
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
};

export const config = { path: ['/api/nz', '/api/nz/*'] };
