import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../../components';
import { useLive } from '../../lib/live';
import { renderShareCard, SHARE_SIZES, shareFileName, type ShareFormat, type ShareKind } from '../../lib/share';
import './embed.css';

/**
 * <ShareCardButton kind="race" id="PA-SEN" /> — opens a preview of a PNG share card with
 * Download / Copy image / Share (native share sheet with the file, when supported).
 */
export function ShareCardButton({ kind, id, label = 'Share card', className }: { kind: ShareKind; id: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? 'btn btn--sm'} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 10V2M5 5l3-3 3 3M3 9v4a1 1 0 001 1h8a1 1 0 001-1V9" />
        </svg>
        <span>{label}</span>
      </button>
      {open && <SharePreview kind={kind} id={id} onClose={() => setOpen(false)} />}
    </>
  );
}

function SharePreview({ kind, id, onClose }: { kind: ShareKind; id: string; onClose: () => void }) {
  const live = useLive();
  const [format, setFormat] = useState<ShareFormat>('landscape');
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<'rendering' | 'ready' | 'missing'>('rendering');
  const [msg, setMsg] = useState('');

  // Snapshot data when opened / format changes (not on every live tick, so the preview doesn't flicker).
  useEffect(() => {
    let cancelled = false;
    setState('rendering');
    renderShareCard(kind, id, format, live).then((b) => {
      if (cancelled) return;
      if (!b) { setState('missing'); return; }
      setBlob(b);
      setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
      setState('ready');
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id, format]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const name = shareFileName(kind, id, format);
  const download = useCallback(() => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setMsg('Downloaded.');
  }, [url, name]);
  const copy = useCallback(async () => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setMsg('Image copied to clipboard.');
    } catch {
      setMsg('Copying images isn’t supported in this browser — use Download.');
    }
  }, [blob]);
  const file = blob ? new File([blob], name, { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ files: [file] }));
  const share = useCallback(async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'PolTok', url: location.href });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setMsg('Sharing failed — try Download.');
    }
  }, [file]);

  return (
    <Modal open onClose={onClose} title="Share card" width={720}>
      <div className="sc">
        <div className="sc__formats" role="radiogroup" aria-label="Card format">
          {(Object.keys(SHARE_SIZES) as ShareFormat[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={format === k} className={`chip ${format === k ? 'is-active' : ''}`} onClick={() => setFormat(k)}>
              {SHARE_SIZES[k].label}
            </button>
          ))}
        </div>
        <div className={`sc__preview sc__preview--${format}`} aria-busy={state === 'rendering'}>
          {state === 'missing' ? (
            <p className="sc__empty">No data for this card yet — try again once results are in.</p>
          ) : url ? (
            <img src={url} alt={`Share card preview (${SHARE_SIZES[format].label})`} style={{ opacity: state === 'rendering' ? 0.5 : 1 }} />
          ) : (
            <p className="sc__empty">Rendering…</p>
          )}
        </div>
        <div className="sc__actions">
          <button type="button" className="btn btn--accent" onClick={download} disabled={state !== 'ready'} data-autofocus>Download PNG</button>
          <button type="button" className="btn" onClick={copy} disabled={state !== 'ready' || typeof ClipboardItem === 'undefined'}>Copy image</button>
          {canShare && <button type="button" className="btn" onClick={share} disabled={state !== 'ready'}>Share…</button>}
        </div>
        <p className="sc__msg" role="status" aria-live="polite">{msg}</p>
      </div>
    </Modal>
  );
}
