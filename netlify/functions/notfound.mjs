// Fallback for unknown /api/* paths (see netlify.toml).
import { json } from '../lib/util.mjs';

export default async () => json({ error: 'not found' }, 404);
