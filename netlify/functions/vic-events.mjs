// GET /api/vic/events — election-night feed of first results, lead changes and calls (newest first).
import { getStore } from '@netlify/blobs';
import { json } from '../lib/util.mjs';

export default async () => {
  const events = (await getStore('poltok').get('vic2026-events', { type: 'json' }).catch(() => null)) ?? [];
  return json({ events }, 200, 30);
};

export const config = { path: ['/api/vic/events'] };
