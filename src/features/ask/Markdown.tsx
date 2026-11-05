/** Markdown-lite: paragraphs, "- "/"* "/"1. " lists, ### headings, **bold**, *italic*, `code`, [Source] chips. No HTML injection. */
import { Fragment, type ReactNode } from 'react';
import { EntityCard, TOKEN_RE, validToken } from './Cards';

const TOKEN_LINE = /^(\s*\[\[(race|balance|seat|market|bill|poll|state):[A-Za-z0-9:_.-]{1,48}\]\]\s*)+$/;

function inline(s: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[\[[a-z]+:[A-Za-z0-9:_.-]{1,48}\]\]|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]\n]{2,40}\](?!\())/g;
  let last = 0;
  let i = 0;
  for (const m of s.matchAll(re)) {
    if (m.index! > last) out.push(s.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith('[[')) {
      // Inline token inside prose → small label; full cards render on their own line.
      const [kind, ...rest] = t.slice(2, -2).split(':');
      const id = rest.join(':');
      out.push(<span key={k} className={validToken(kind, id) ? 'ask-ref' : undefined}>{id}</span>);
    } else if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) out.push(<span key={k} className="ask-cite">{t.slice(1, -1)}</span>);
    else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index! + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  // Hide a half-streamed token at the end ("[[race:GA-S").
  const lines = text.replace(/\r/g, '').replace(/\[\[[^\]\n]*\]?$/, '').split('\n');
  let cards = 0;
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(' '), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const k = `l${blocks.length}`;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `${k}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={k}>{items}</ol> : <ul key={k}>{items}</ul>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (TOKEN_LINE.test(line)) {
      flushPara();
      flushList();
      for (const m of line.matchAll(TOKEN_RE)) {
        if (cards++ >= 4) break;
        blocks.push(<EntityCard key={`c${blocks.length}`} kind={m[1]} id={m[2]} raw={m[0]} />);
      }
    } else if (!line) {
      flushPara();
      flushList();
    } else if (h) {
      flushPara();
      flushList();
      blocks.push(<h4 key={`h${blocks.length}`}>{inline(h[1], `h${blocks.length}`)}</h4>);
    } else if (ul || ol) {
      flushPara();
      const ordered = !!ol;
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push((ul ?? ol)![1]);
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="ask-md">{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
