// /api/pv (anonymous pageview beacon) + /api/analytics (owner-only aggregates). Shared logic: server/analytics.js.
// Cookieless: no IPs, user agents or raw events are stored — only daily rollups in Netlify Blobs ('poltok-analytics').
// Country comes from Netlify geo (context.geo / x-country); unique visitors use a daily-rotating salted hash.
import { getStore } from '@netlify/blobs';
import { handleAnalytics } from '../../server/analytics.js';

const blobStore = () => {
  const s = getStore('poltok-analytics');
  return {
    get: (k) => s.get(k, { type: 'json' }),
    set: (k, v) => s.setJSON(k, v),
    del: (k) => s.delete(k),
    list: async (prefix) => (await s.list({ prefix })).blobs.map((b) => b.key),
  };
};

export default async (req, context) =>
  handleAnalytics(req, {
    store: blobStore(),
    ip: context?.ip || req.headers.get('x-nf-client-connection-ip') || '',
    country: context?.geo?.country?.code || req.headers.get('x-country') || '',
  });

export const config = { path: ['/api/pv', '/api/analytics'] };
