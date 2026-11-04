// GET /api/health — Netlify capability probe. stream:false tells the client there is no SSE
// server here, so src/lib/live.tsx runs the live provider in the browser instead.
import { json } from '../lib/util.mjs';

export default async () =>
  json({ ok: true, platform: 'netlify', stream: false, mode: 'live', ai: !!(process.env.GROQ || process.env.GROQ_API_KEY) });

export const config = { path: '/api/health' };
