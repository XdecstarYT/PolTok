import { useEffect, useState } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';
import { askAi, buildContext } from '../../lib/ai';
import { cardData, download, type Subject } from './cards';
import { SITE, pathFor, tweetForCard } from './tweets';

export const URL_WEIGHT = 23;
export const xWeight = (body: string, hasLink = true) => [...body].length + (hasLink ? 1 + URL_WEIGHT : 0);
export const intentUrl = (text: string, path: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE + path)}`;
export async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s);
    return true;
  } catch {
    return false;
  }
}
/** Downloads the card PNG and its tweet as a .txt side by side. */
export function downloadPair(blob: Blob | null, text: string, name: string) {
  if (blob) download(blob, `${name}.png`);
  download(new Blob([text], { type: 'text/plain' }), `${name}.txt`);
}

/** Auto-written tweet for a rendered card (same subject + CardData; no AI needed). */
export function LinkedTweet({ subject, designName, blob, name }: { subject: Subject; designName: string; blob: Blob | null; name: string }) {
  const live = useLive();
  const [auto, setAuto] = useState('');
  const [text, setText] = useState('');
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const stamp = live.lastUpdate ? Math.floor(live.lastUpdate / 60000) : 0;
  useEffect(() => {
    let alive = true;
    cardData(subject, live).then((d) => {
      if (!alive) return;
      const t = d ? tweetForCard(subject, d, designName) : '';
      setAuto(t);
      setText(t);
      setAi(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.kind, subject.id, designName, stamp]);
  const path = pathFor(subject);
  const full = `${text}\n${SITE}${path}`;
  const w = xWeight(text);
  const rewrite = async () => {
    setBusy(true);
    setNote('');
    try {
      const q = `Rewrite this tweet as ONE punchier variant under 230 characters. Keep every number and name exactly as given, add no new facts, keep the hashtags, no link, output only the tweet text:\n\n${auto}`;
      const out = await askAi({ question: q, context: await buildContext(live, auto), mode: 'chat' }, () => {});
      const clean = out.trim().replace(/^["“]|["”]$/g, '');
      if (clean) {
        setText(clean);
        setAi(true);
      }
    } catch (e) {
      setNote((e as Error).message || 'AI unavailable');
    }
    setBusy(false);
  };
  return (
    <div className="ow-tweet ow-linked">
      <header className="ow-tweet__h">
        <strong>Matching tweet</strong>
        {ai && <span className="ow-ai">AI rewrite — check facts</span>}
        <span className={`ow-count ${w > 280 ? 'is-over' : ''}`}>{w}/280</span>
      </header>
      <textarea className="ow-tweet__t" value={text} onChange={(e) => setText(e.target.value)} rows={5} aria-label="Tweet for this card" />
      <span className="ow-link">{SITE + path}</span>
      <div className="ow-actions">
        <Button size="sm" onClick={async () => setNote((await copyText(full)) ? 'Copied' : 'Copy failed')}>Copy</Button>
        <Button size="sm" variant="ghost" href={intentUrl(text, path)}>Post on X</Button>
        <Button size="sm" variant="ghost" onClick={() => downloadPair(blob, full, name)}>Download pair</Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={rewrite}>{busy ? 'Rewriting…' : 'Rewrite with AI'}</Button>
        {ai && <Button size="sm" variant="ghost" onClick={() => { setAi(false); setText(auto); }}>Reset</Button>}
      </div>
      {note && <p className="ow-muted" role="status">{note}</p>}
    </div>
  );
}
