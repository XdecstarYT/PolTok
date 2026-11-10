// /api/xpost — owner-only "Publish to X" (shared logic in server/xpost.js). Posts for real via the X API
// (OAuth 1.0a user context). Env (server-side only, never exposed or logged):
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET — without them it answers { configured:false }.
// Successful posts are recorded in the X queue history (Netlify Blobs store 'poltok', key 'xqueue').
import { getStore } from '@netlify/blobs';
import { handleXPost } from '../../server/xpost.js';

const blobStore = () => {
  const s = getStore('poltok');
  return {
    get: async () => (await s.get('xqueue', { type: 'json' })) || null,
    set: (v) => s.setJSON('xqueue', v),
  };
};

export default async (req, context) =>
  handleXPost(req, { store: blobStore(), ip: context?.ip || req.headers.get('x-nf-client-connection-ip') || 'anon' });

export const config = { path: '/api/xpost' };
