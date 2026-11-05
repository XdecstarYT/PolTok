import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../components';
import { useLive } from '../../lib/live';
import { cardDataFor, cardFileName, designsFor, renderCard, type CardData, type CardKind } from '../../lib/cards';
import './embed.css';

/**
 * <ShareCardButton kind="race" id="PA-SEN" /> — opens a share-card picker: browse every card design
 * compatible with the kind (thumbnail strip), then Download / Copy image / Share.
 */
export function ShareCardButton({ kind, id, label = 'Share card', className }: { kind: CardKind; id: string; label?: string; className?: string }) {
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

function SharePreview({ kind, id, onClose }: { kind: CardKind; id: string; onClose: () => void }) {
  const live = useLive();
  const designs = useMemo(() => designsFor(kind), [kind]);
  // Snapshot data when opened (not on every live tick, so previews don't flicker).
  const data = useMemo<CardData>(() => cardDataFor(kind, id, live), [kind, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [sel, setSel] = useState(designs[0]?.id ?? '');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const blobs = useRef<Record<string, Blob>>({});
  const [msg, setMsg] = useState('');

  // Render the selected design first, then the rest in order (sequentially to keep the UI responsive).
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      const order = [sel, ...designs.map((d) => d.id).filter((x) => x !== sel)];
      for (const did of order) {
        if (cancelled) return;
        try {
          const b = await renderCard(did, data);
          if (cancelled) return;
          blobs.current[did] = b;
          const u = URL.createObjectURL(b);
          urls.push(u);
          setThumbs((t) => ({ ...t, [did]: u }));
        } catch { /* skip broken design */ }
        await new Promise((r) => setTimeout(r, 0));
      }
    })();
    return () => { cancelled = true; urls.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, designs]);

  const design = designs.find((d) => d.id === sel);
  const url = thumbs[sel];
  const blob = url ? blobs.current[sel] : undefined;
  const name = cardFileName(sel, data);
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
  const tall = design ? design.size.h > design.size.w : false;

  return (
    <Modal open onClose={onClose} title="Share card" width={760}>
      <div className="sc">
        <div className={`sc__preview ${tall ? 'sc__preview--story' : ''}`} aria-busy={!url}>
          {url ? <img src={url} alt={`${design?.name ?? 'Share'} card preview`} /> : <p className="sc__empty">Rendering…</p>}
        </div>
        <div className="sc__meta">
          <strong>{design?.name}</strong> <span>{design?.preview}</span> <span>· {designs.length} designs</span>
        </div>
        <div className="sc__strip" role="radiogroup" aria-label="Card design">
          {designs.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={sel === d.id} title={`${d.name} (${d.size.w}×${d.size.h})`}
              className={`sc__thumb ${sel === d.id ? 'is-active' : ''}`} onClick={() => { setSel(d.id); setMsg(''); }}>
              {thumbs[d.id] ? <img src={thumbs[d.id]} alt="" loading="lazy" /> : <span className="sc__thumb-ph" style={{ aspectRatio: `${d.size.w} / ${d.size.h}` }} />}
              <span className="sc__thumb-name">{d.name}</span>
            </button>
          ))}
        </div>
        <div className="sc__actions">
          <button type="button" className="btn btn--accent" onClick={download} disabled={!url} data-autofocus>Download PNG</button>
          <button type="button" className="btn" onClick={copy} disabled={!url || typeof ClipboardItem === 'undefined'}>Copy image</button>
          {canShare && <button type="button" className="btn" onClick={share} disabled={!url}>Share…</button>}
        </div>
        <p className="sc__msg" role="status" aria-live="polite">{msg}</p>
      </div>
    </Modal>
  );
}
