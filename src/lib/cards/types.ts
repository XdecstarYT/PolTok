export type CardKind = 'race' | 'balance' | 'au-seat' | 'promo' | 'stat' | 'flip' | 'quote';

export interface CardDesign {
  id: string;
  name: string;
  kinds: CardKind[];
  size: { w: number; h: number };
  preview?: string;
}

export interface CardData {
  kind: CardKind;
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string; color?: string }[];
  party?: string;
  color?: string;
  photo?: string;
  footer?: string;
  url?: string;
  bars?: { label: string; value: number; color: string }[];
  mapState?: string;
}
