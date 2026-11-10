/** "Follow live" badge options (no canvas deps, safe for pure modules/tests). */
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
export const BADGE_LABELS = ['Follow live', 'Live results', 'Watch live'] as const;
export type BadgeLabel = (typeof BADGE_LABELS)[number];
export interface BadgeOpts { on: boolean; corner: Corner; label: BadgeLabel }
export const BADGE_OFF: BadgeOpts = { on: false, corner: 'br', label: 'Follow live' };
export const BADGE_LIVE: BadgeOpts = { on: true, corner: 'br', label: 'Follow live' };
