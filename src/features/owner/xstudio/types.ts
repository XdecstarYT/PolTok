import type { CardData, CardKind } from '../../../lib/cards';
import type { BadgeOpts } from './badgeOpts';

export type DraftStatus = 'draft' | 'scheduled' | 'posted';
export type DraftSource =
  | { type: 'update'; ids: string[] }
  | { type: 'live'; template: string }
  | { type: 'manual' };

/** One X post or thread, ready to post manually. Images are re-rendered from `card` (deterministic). */
export interface XDraft {
  id: string;
  title: string;
  /** thread posts (1 = single tweet); each includes its own hashtags / link */
  posts: string[];
  /** canonical link (with utm_source=x) */
  url: string;
  hashtags: string[];
  alt: string;
  designId: string;
  cardKind: CardKind;
  card: CardData;
  brand?: boolean;
  badge?: BadgeOpts;
  source: DraftSource;
  status: DraftStatus;
  scheduledAt?: number;
  postedAt?: number;
  /** pasted link of the posted tweet (optional) */
  postedUrl?: string;
  auto?: boolean;
  created: number;
  updated: number;
}

export interface HistoryEntry { id: string; title: string; postedAt: number; url?: string; postedUrl?: string; posts: number }
export interface QueueMeta { lastPostedUpdateAt?: number; knownUpdateIds?: string[] }
export interface QueueState { drafts: XDraft[]; history: HistoryEntry[]; meta: QueueMeta }
