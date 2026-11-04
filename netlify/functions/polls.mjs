// GET /api/polls — static seed poll series.
import { POLL_SERIES } from '../../shared/data/index.js';
import { json } from '../lib/util.mjs';

export default async () => json(POLL_SERIES, 200, 3600);

export const config = { path: '/api/polls' };
