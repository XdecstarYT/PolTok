// Netlify Function (v2) — /api/myarea/us address → districts. Shared core: server/myarea.js.
import { myareaApi } from '../../server/myarea.js';

export default async (req) => {
  const r = await myareaApi(new URL(req.url).searchParams);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'private, no-store' };
  return new Response(JSON.stringify(r.body), { status: r.status, headers });
};

export const config = { path: ['/api/myarea', '/api/myarea/*'] };
