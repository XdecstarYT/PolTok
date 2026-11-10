// /api/xqueue/* — X Studio draft queue, schedule and posted history (owner token required; shared logic in server/xqueue.js).
// Persists in Netlify Blobs (store 'poltok', key 'xqueue'). Never posts to X — the owner posts manually.
import { getStore } from '@netlify/blobs';
import { handleXQueue } from '../../server/xqueue.js';

const blobStore = () => {
  const s = getStore('poltok');
  return {
    get: async () => (await s.get('xqueue', { type: 'json' })) || null,
    set: (v) => s.setJSON('xqueue', v),
  };
};

export default async (req) => handleXQueue(req, { store: blobStore() });

export const config = { path: ['/api/xqueue', '/api/xqueue/*'] };
