// GET /api/stream — not available on Netlify (no long-lived SSE). Fast 404 so the client
// falls back to its in-browser provider immediately.
import { json } from '../lib/util.mjs';

export default async () => json({ error: 'streaming not available on this deployment', stream: false }, 404);

export const config = { path: '/api/stream' };
