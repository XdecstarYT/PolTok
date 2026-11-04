import { highlightParts } from './searchIndex';

/** Renders `text` with query-term matches wrapped in <mark>. */
export function Highlight({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlightParts(text, q).map((p, i) => (p.m ? <mark key={i} className="srch-hl">{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  );
}
