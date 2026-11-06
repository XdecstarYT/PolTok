import { useEffect, useRef, useState } from 'react';
import { renderCardCanvas, type CardData, type CardDesign, type CardStyle } from '../../../lib/cards';

const cache = new Map<string, string>();
const TH = 180;

/** Live thumbnails of every template for the current subject + style (rendered one at a time, cached). */
export function Gallery({ designs, data, style, selected, onPick }: { designs: CardDesign[]; data: CardData; style: CardStyle; selected: string; onPick: (id: string) => void }) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const gen = useRef(0);
  const key = JSON.stringify([data.title, data.subtitle, data.stats, data.kind, { ...style, bgImage: style.bgImage ? 1 : 0, size: undefined }]);
  useEffect(() => {
    const my = ++gen.current;
    setThumbs({});
    const t = setTimeout(async () => {
      for (const d of designs) {
        if (gen.current !== my) return;
        const ck = `${d.id}|${key}`;
        let url = cache.get(ck);
        if (!url) {
          try {
            const cv = await renderCardCanvas(d.id, data, { ...style, size: undefined });
            const s = TH / Math.max(cv.width, cv.height);
            const sm = document.createElement('canvas');
            sm.width = Math.round(cv.width * s * 2); sm.height = Math.round(cv.height * s * 2);
            const x = sm.getContext('2d')!; x.imageSmoothingQuality = 'high'; x.drawImage(cv, 0, 0, sm.width, sm.height);
            url = sm.toDataURL('image/jpeg', 0.82);
            if (cache.size > 400) cache.clear();
            cache.set(ck, url);
          } catch { continue; }
        }
        if (gen.current !== my) return;
        setThumbs((m) => ({ ...m, [d.id]: url! }));
        await new Promise((r) => setTimeout(r, 0));
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, designs]);
  return (
    <div className="st-gallery" role="listbox" aria-label="Template gallery">
      {designs.map((d) => (
        <button key={d.id} type="button" role="option" aria-selected={d.id === selected} className={`st-thumb${d.id === selected ? ' is-sel' : ''}`} onClick={() => onPick(d.id)} title={`${d.name} · ${d.size.w}×${d.size.h}`}>
          <span className="st-thumb-img">{thumbs[d.id] ? <img src={thumbs[d.id]} alt="" /> : <span className="ow-muted">…</span>}</span>
          <span className="st-thumb-name">{d.premium ? '★ ' : ''}{d.name}</span>
        </button>
      ))}
    </div>
  );
}
