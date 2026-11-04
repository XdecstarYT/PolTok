// POST /api/ai — "Ask PolTok" grounded Groq chat (shared logic in server/ai.js). GET = capability probe.
// Env (Netlify UI, server-side only): GROQ or GROQ_API_KEY, optional GROQ_MODEL, AI_MAX_TOKENS, AI_RATE_PER_MIN.
import { handleAi } from '../../server/ai.js';

export default async (req, context) => handleAi(req, { ip: context?.ip || req.headers.get('x-nf-client-connection-ip') || 'anon' });

export const config = { path: '/api/ai' };
