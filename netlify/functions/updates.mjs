// /api/updates (+ /:id) and /api/updates.rss — "What's new" posts (shared logic in server/updates.js).
// Owner posts persist in Netlify Blobs (store 'poltok', key 'updates'); writes require the owner token.
import { getStore } from '@netlify/blobs';
import { handleUpdates } from '../../server/updates.js';

const blobStore = () => {
  const s = getStore('poltok');
  return {
    get: async () => (await s.get('updates', { type: 'json' })) || [],
    set: (v) => s.setJSON('updates', v),
  };
};

export default async (req) => handleUpdates(req, { store: blobStore() });

export const config = { path: ['/api/updates', '/api/updates/*', '/api/updates.rss'] };
