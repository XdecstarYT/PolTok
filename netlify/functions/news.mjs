// GET /api/news?limit=&tag=&lean=&source=&q= — RSS aggregation (server/news.js), cached ~2 min per warm instance.
import { createNewsService } from '../../server/news.js';
import { json, quiet } from '../lib/util.mjs';

const svc = createNewsService({ log: quiet });
let at = 0;

export default async (req) => {
  if (!at || Date.now() - at > 120000) {
    try {
      await Promise.race([svc.refresh(), new Promise((r) => setTimeout(r, 9000))]);
      at = Date.now();
    } catch {
      /* serve whatever we have */
    }
  }
  const q = new URL(req.url).searchParams;
  return json(
    svc.query({
      limit: Number(q.get('limit')) || 100,
      tag: q.get('tag') || undefined,
      lean: q.get('lean') || undefined,
      source: q.get('source') || undefined,
      q: q.get('q') || undefined,
    }),
    200,
    120,
  );
};

export const config = { path: '/api/news' };
