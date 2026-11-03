// STUB — Map agent implements. PUBLIC API (other agents import this; keep props compatible):
import type { CSSProperties, ReactNode } from 'react';
export interface USMapProps {
  /** fill color per state abbr; missing = neutral */
  fills?: Record<string, string>;
  /** 'geo' = albersUsa projection, 'hex' = equal-area hex cartogram */
  variant?: 'geo' | 'hex';
  onStateClick?: (abbr: string) => void;
  onStateHover?: (abbr: string | null) => void;
  /** tooltip content renderer for hovered state */
  renderTooltip?: (abbr: string) => ReactNode;
  /** states to pulse/glow (e.g. just called) */
  highlight?: string[];
  /** show state abbreviation labels */
  labels?: boolean;
  /** dim states not in this list */
  focus?: string[];
  className?: string;
  style?: CSSProperties;
}
export function USMap(_props: USMapProps) {
  return <div style={{ aspectRatio: '975/610', background: 'var(--bg-2)', borderRadius: 12 }} />;
}
