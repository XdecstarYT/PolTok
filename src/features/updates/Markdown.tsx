/** Markdown-lite → React (no innerHTML): paragraphs, "- " lists, "### " headings, **bold**, *em*, `code`, [text](link). */
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((t, i) => {
    const k = `${key}-${i}`;
    if (/^\*\*.+\*\*$/.test(t)) return <strong key={k}>{t.slice(2, -2)}</strong>;
    if (/^\*.+\*$/.test(t)) return <em key={k}>{t.slice(1, -1)}</em>;
    if (/^`.+`$/.test(t)) return <code key={k}>{t.slice(1, -1)}</code>;
    const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t);
    if (m) {
      const [, label, href] = m;
      if (href.startsWith('/api/') || /^https:\/\//.test(href)) return <a key={k} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">{label}</a>;
      if (/^\/(?!\/)/.test(href)) return <Link key={k} to={href}>{label}</Link>;
      return <Fragment key={k}>{label}</Fragment>;
    }
    return <Fragment key={k}>{t}</Fragment>;
  });
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className={className ?? 'up-md'}>
      {blocks.map((b, i) => {
        const lines = b.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        if (lines.every((l) => /^\s*[-*] /.test(l)))
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ''), `${i}-${j}`)}</li>)}</ul>;
        if (lines[0].startsWith('### ') && lines.length === 1) return <h4 key={i}>{inline(lines[0].slice(4), String(i))}</h4>;
        // paragraph possibly followed by a list
        const li = lines.findIndex((l) => /^\s*[-*] /.test(l));
        if (li > 0 && lines.slice(li).every((l) => /^\s*[-*] /.test(l)))
          return (
            <Fragment key={i}>
              <p>{inline(lines.slice(0, li).join(' '), `${i}p`)}</p>
              <ul>{lines.slice(li).map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*] /, ''), `${i}-${j}`)}</li>)}</ul>
            </Fragment>
          );
        return <p key={i}>{inline(lines.join(' '), String(i))}</p>;
      })}
    </div>
  );
}
