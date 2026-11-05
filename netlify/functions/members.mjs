// Netlify Function (v2) — /api/members/* Congress member directory. Same JSON as server/members.js.
import { membersApi } from '../../server/members.js';

export default async (req) => {
  const url = new URL(req.url);
  const sub = url.pathname.replace(/^.*?\/api\/members/, '');
  const r = await membersApi(sub || '/us');
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' };
  if (r.maxAge && r.status === 200) {
    headers['cache-control'] = 'public, max-age=300';
    headers['netlify-cdn-cache-control'] = `public, s-maxage=${r.maxAge}, stale-while-revalidate=${r.maxAge * 6}`;
  } else headers['cache-control'] = 'no-store';
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
};

export const config = { path: ['/api/members', '/api/members/*'] };
