// Netlify Function (v2) — /api/calendar (JSON) and /api/calendar.ics (iCalendar feed). Shared core: server/calendar.js.
import { calendarApi } from '../../server/calendar.js';

export default async (req) => {
  const url = new URL(req.url);
  const r = calendarApi(url.pathname, url.searchParams);
  const headers = { 'content-type': r.contentType, 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=600', 'netlify-cdn-cache-control': `public, s-maxage=${r.maxAge}` };
  if (r.filename && url.searchParams.get('dl')) headers['content-disposition'] = `attachment; filename="${r.filename}"`;
  return new Response(r.body, { status: r.status, headers });
};

export const config = { path: ['/api/calendar', '/api/calendar.ics'] };
