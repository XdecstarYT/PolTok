// /api/owner/login + /api/owner/me — owner panel auth (shared logic in server/owner.js).
// Env (server-side only): OWNER_SECRET (token HMAC key — set this), optional OWNER_USER/OWNER_PASS.
import { handleOwner } from '../../server/owner.js';

export default async (req, context) => handleOwner(req, { ip: context?.ip || req.headers.get('x-nf-client-connection-ip') || 'anon' });

export const config = { path: ['/api/owner', '/api/owner/*'] };
