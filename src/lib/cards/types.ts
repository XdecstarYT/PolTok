export type CardKind = 'race' | 'balance' | 'au-seat' | 'promo' | 'stat' | 'flip' | 'quote' | 'candidate' | 'custom'
  | MessageKind | 'brand';
/** Personal / brand-voice posts not tied to live data. */
export type MessageKind = 'message' | 'announcement' | 'thanks' | 'milestone' | 'question' | 'statement';
export const MESSAGE_KINDS: MessageKind[] = ['message', 'announcement', 'thanks', 'milestone', 'question', 'statement'];

export interface CardDesign {
  id: string;
  name: string;
  kinds: CardKind[];
  size: { w: number; h: number };
  preview?: string;
  /** true for designs added in Update 3 */
  isNew?: boolean;
  /** premium studio template (Creative v2) */
  premium?: boolean;
}

export interface CardSeries { label: string; color: string; points: { t: number; v: number }[] }

export interface CardData {
  kind: CardKind;
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string; color?: string }[];
  party?: string;
  color?: string;
  photo?: string;
  /** second portrait (head-to-head) */
  photo2?: string;
  footer?: string;
  url?: string;
  bars?: { label: string; value: number; color: string }[];
  mapState?: string;
  /** call-to-action line, e.g. "Follow live at poltok.netlify.app" */
  cta?: string;
  /** time series (polls) for trend/sparkline designs */
  series?: CardSeries[];
  /** epoch ms the countdown design counts down to */
  countdownTo?: number;
  /** carousel position (1-based) */
  slide?: { i: number; n: number };
  /** ordered steps (bill progress) */
  steps?: { label: string; done: boolean }[];
  /** simple table */
  table?: { head: string[]; rows: string[][] };
  /** who said it (quote designs) */
  quoteBy?: string;
  /** poll companion options */
  options?: string[];
  /** reply/quote frame: the owner's own earlier post (or clearly labelled text) */
  quoted?: { text: string; by?: string; label?: string };
  /** display handle for X-style frames, e.g. @PolTok */
  handle?: string;
}
