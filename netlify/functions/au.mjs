// GET /api/au/news | /api/au/markets | /api/au/results?contest= — ports of server/au.js, stateless.
import { createAuNewsService, createAuResults } from '../../server/au.js';
import { createAuMarketsFeed } from '../../shared/au/markets.js';
import { cached, json, quiet, sleep } from '../lib/util.mjs';

const news = createAuNewsService({ log: quiet });
let newsAt = 0;
const results = createAuResults({ log: quiet });
const marketsFeed = createAuMarketsFeed({ log: quiet, pollMs: 60000 });
const markets = cached(60000, async () => {
  // start() kicks off one fetch and returns its promise; stop the interval immediately (stateless).
  const p = marketsFeed.start();
  marketsFeed.stop();
  await Promise.race([p, sleep(9000)]);
  return { markets: marketsFeed.snapshot(), updatedAt: marketsFeed.updatedAt() };
});

export default async (req) => {
  const url = new URL(req.url);
  switch (url.pathname) {
    case '/api/au/news': {
      if (!newsAt || Date.now() - newsAt > 120000) {
        await Promise.race([news.refresh().catch(() => {}), sleep(9000)]);
        newsAt = Date.now();
      }
      const q = url.searchParams;
      return json(news.query({ limit: Number(q.get('limit')) || 100, tag: q.get('tag') || undefined, q: q.get('q') || undefined }), 200, 120);
    }
    case '/api/au/markets':
      return json(await markets(), 200, 60);
    case '/api/au/results': {
      const contest = url.searchParams.get('contest') || 'vic2026';
      const r = await results.get(contest);
      return r ? json(r, 200, 30) : json({ error: `unknown contest; available: ${results.contests().join(', ')}` }, 404);
    }
    default:
      return json({ error: 'not found' }, 404);
  }
};

export const config = { path: ['/api/au/news', '/api/au/markets', '/api/au/results'] };
