// GET /api/news/story/:clusterId · /api/news/topic/:slug · /api/news/source/:name (server/news.js newsExtra), cached 60s.
import { createNewsService, newsExtra, auNewsItems } from '../../server/news.js';
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
  const [status, body] = await newsExtra(new URL(req.url).pathname, async () => ({ us: svc.recent(1200), au: await auNewsItems().catch(() => []) }));
  return json(body, status, status === 200 ? 60 : 0);
};

export const config = { path: ['/api/news/story/*', '/api/news/topic/*', '/api/news/source/*'] };
