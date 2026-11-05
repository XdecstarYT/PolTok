// Netlify Function (v2) — /api/world/* global elections hub. Same JSON as server/world.js (shared core).
// Keyless: Wikipedia national electoral calendars (raw wikitext) + REST page summaries.
import { worldApi } from '../../server/world.js';

export default async (req) => {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/api\/world/, '').replace(/^\/\.netlify\/functions\/world/, '');
  const r = await worldApi(sub || '/elections', url.searchParams);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' };
  if (r.maxAge && r.status === 200) {
    headers['cache-control'] = 'public, max-age=300';
    headers['netlify-cdn-cache-control'] = `public, s-maxage=${r.maxAge}, stale-while-revalidate=${r.maxAge * 6}`;
  } else headers['cache-control'] = 'no-store';
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
};

export const config = { path: ['/api/world', '/api/world/*'] };
