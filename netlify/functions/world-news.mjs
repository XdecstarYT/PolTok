// Netlify Function (v2) — /api/world/news?country=GB international news. Same JSON as the Node route.
import { worldNewsApi } from '../../server/world-news.js';

export default async (req) => {
  const url = new URL(req.url);
  const r = await worldNewsApi(url.searchParams);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' };
  if (r.status === 200) {
    headers['cache-control'] = 'public, max-age=120';
    headers['netlify-cdn-cache-control'] = 'public, s-maxage=300, stale-while-revalidate=1800';
  } else headers['cache-control'] = 'no-store';
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
};

export const config = { path: '/api/world/news' };
