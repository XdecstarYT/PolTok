import { useEffect, useState } from 'react';
import { Button } from '../../components';
import { renderCard, type CardData, type CardStyle } from '../../lib/cards';
import { copyImage, download, shareImage } from './cards';
import { openInEditor } from './editorBus';

/** Renders any CardData + style; Download / Copy / Share / Open in editor. */
export function CardPreview({ designId, data, style, name, text, alt, onBlob, subject, actions = true }: { designId: string; data: CardData; style?: CardStyle; name: string; text?: string; alt?: string; onBlob?: (b: Blob | null) => void; subject?: { kind: string; id: string }; actions?: boolean }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [msg, setMsg] = useState('');
  const key = JSON.stringify([designId, data, style]);
  useEffect(() => {
    let alive = true;
    setState('loading');
    const t = setTimeout(() => {
      renderCard(designId, data, style).then((b) => { if (alive) { setBlob(b); onBlob?.(b); setState('ok'); } }).catch(() => alive && setState('error'));
    }, 120);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
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
        {state === 'ok' && url ? <img src={url} alt={alt || `Card preview: ${data.title.replace(/\*/g, '')}`} /> : <span className="ow-muted">{state === 'loading' ? 'Rendering…' : 'Render failed'}</span>}
      </div>
      {actions && <div className="ow-actions">
        <Button size="sm" variant="ghost" disabled={!blob} onClick={() => blob && download(blob, file)}>Download PNG</Button>
        <Button size="sm" variant="ghost" disabled={!blob} onClick={async () => blob && setMsg((await copyImage(blob)) ? 'Image copied' : 'Copy unsupported — download instead')}>Copy image</Button>
        <Button size="sm" variant="ghost" disabled={!blob} onClick={async () => { if (blob && (await shareImage(blob, file, text)) === 'unsupported') setMsg('Share unsupported here'); }}>Share…</Button>
        <Button size="sm" variant="ghost" onClick={() => openInEditor({ designId, data, style: style ?? {}, subject })}>Open in editor</Button>
      </div>}
      {msg && <p className="ow-muted" role="status">{msg}</p>}
    </div>
  );
}
