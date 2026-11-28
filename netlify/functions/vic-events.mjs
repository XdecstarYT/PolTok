// GET /api/vic/events — election-night feed of first results, lead changes and calls (newest first).
import { getStore } from '@netlify/blobs';
import { json } from '../lib/util.mjs';

export default async () => {
  const store = getStore('poltok');
  const [events, status] = await Promise.all([
    store.get('vic2026-events', { type: 'json' }).catch(() => null),
    store.get('vic2026-cron-status', { type: 'json' }).catch(() => null),
  ]);
  return json({ events: events ?? [], status }, 200, 30);
};

export const config = { path: ['/api/vic/events'] };
