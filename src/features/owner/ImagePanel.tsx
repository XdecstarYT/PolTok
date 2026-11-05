import { useEffect, useState } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';
import { copyImage, download, render, shareImage, type Subject } from './cards';

/** Renders a card (design × subject) and offers Download / Copy / Share. */
export function ImagePanel({ designId, subject, name, text }: { designId: string; subject: Subject; name: string; text?: string }) {
  const live = useLive();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'loading' | 'ok' | 'none' | 'error'>('loading');
  const [msg, setMsg] = useState('');
  const stamp = live.lastUpdate ? Math.floor(live.lastUpdate / 60000) : 0; // re-render at most once a minute
  useEffect(() => {
    let alive = true;
    setState('loading');
    render(designId, subject, live)
      .then((b) => {
        if (!alive) return;
        setBlob(b);
        setState(b ? 'ok' : 'none');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId, subject.kind, subject.id, stamp]);
  useEffect(() => {
    if (!blob) return setUrl('');
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  const file = `${name}.png`;
  return (
    <div className="ow-img">
      <div className="ow-img__frame">
        {state === 'ok' && url ? <img src={url} alt={`Card preview: ${name}`} /> : <span className="ow-muted">{state === 'loading' ? 'Rendering…' : state === 'none' ? 'No image for this subject/design' : 'Render failed'}</span>}
      </div>
      <div className="ow-actions">
        <Button size="sm" variant="ghost" disabled={!blob} onClick={() => blob && download(blob, file)}>Download PNG</Button>
        <Button size="sm" variant="ghost" disabled={!blob} onClick={async () => blob && setMsg((await copyImage(blob)) ? 'Image copied' : 'Copy unsupported — download instead')}>Copy image</Button>
        <Button size="sm" variant="ghost" disabled={!blob} onClick={async () => { if (!blob) return; const r = await shareImage(blob, file, text); if (r === 'unsupported') setMsg('Share unsupported here'); }}>Share…</Button>
      </div>
      {msg && <p className="ow-muted" role="status">{msg}</p>}
    </div>
  );
}
