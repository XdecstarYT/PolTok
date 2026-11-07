// Poll series + national averages. Split from ./index so pages that never chart polls don't pay for them.
import type { NewsItem, PollSeries } from '../types';
import type { ApprovalAverages, GenericBallotAverages, MarketsBaseline } from './index';
import {
  POLL_SERIES as P,
  GENERIC_BALLOT as GB,
  APPROVAL as AP,
  MARKETS_BASELINE as MB,
  FALLBACK_NEWS as FN,
} from '../../shared/data/polls.js';

export const POLL_SERIES = P as PollSeries[];
export const GENERIC_BALLOT = GB as GenericBallotAverages;
export const APPROVAL = AP as ApprovalAverages;
export const MARKETS_BASELINE = MB as MarketsBaseline;
export const FALLBACK_NEWS = FN as NewsItem[];
export const pollSeriesById = new Map(POLL_SERIES.map((p) => [p.id, p]));
