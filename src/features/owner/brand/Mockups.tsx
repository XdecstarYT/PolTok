/** Generic in-app profile PREVIEW MOCKUPS (neutral chrome, no platform trademarks) with safe-zone checks. */
import { useState } from 'react';
import type { Rect } from '../../../../shared/social.js';
import { safeWarnings } from './render';

export interface Asset { url: string; keys: Rect[]; w: number; h: number }
type Layout = 'header' | 'centered' | 'threads' | 'grid' | 'discord' | 'channel';
interface View { aspect?: number; crop?: Rect; av: number; ax: number | 'center'; overlap: number; avShape?: 'circle' | 'rounded' }
interface Def { name: string; layout: Layout; banner?: string; post?: string; d: View; m: View }

const full = (label: string): Rect => ({ x: 0, y: 0, w: 1, h: 1, label });
export const MOCKS: Record<string, Def> = {
  x: { name: 'X', layout: 'header', banner: 'header', post: 'post-square', d: { aspect: 3, av: 0.2, ax: 0.04, overlap: 0.5 }, m: { aspect: 3, av: 0.22, ax: 0.04, overlap: 0.45 } },
  instagram: { name: 'Instagram', layout: 'grid', post: 'post-portrait', d: { av: 0.26, ax: 0.08, overlap: 0 }, m: { av: 0.24, ax: 0.04, overlap: 0 } },
  tiktok: { name: 'TikTok', layout: 'centered', post: 'story', d: { av: 0.2, ax: 'center', overlap: 0 }, m: { av: 0.28, ax: 'center', overlap: 0 } },
  youtube: { name: 'YouTube', layout: 'channel', banner: 'banner', post: 'thumbnail',
    d: { crop: { x: 0, y: (1440 - 423) / 2 / 1440, w: 1, h: 423 / 1440, label: 'Desktop crop' }, av: 0.16, ax: 0.04, overlap: 0 },
    m: { crop: { x: (2560 - 1546) / 2 / 2560, y: (1440 - 423) / 2 / 1440, w: 1546 / 2560, h: 423 / 1440, label: 'Mobile crop' }, av: 0.2, ax: 0.04, overlap: 0 } },
  linkedin: { name: 'LinkedIn', layout: 'header', banner: 'banner', post: 'post', d: { aspect: 4, av: 0.24, ax: 0.04, overlap: 0.55 }, m: { aspect: 3, av: 0.26, ax: 0.04, overlap: 0.5 } },
  facebook: { name: 'Facebook', layout: 'header', banner: 'cover', post: 'post-square', d: { aspect: 1640 / 624, av: 0.2, ax: 0.03, overlap: 0.4 }, m: { aspect: 16 / 9, av: 0.3, ax: 0.04, overlap: 0.4 } },
  threads: { name: 'Threads', layout: 'threads', post: 'post-portrait', d: { av: 0.14, ax: 0.82, overlap: 0 }, m: { av: 0.2, ax: 0.76, overlap: 0 } },
  bluesky: { name: 'Bluesky', layout: 'header', banner: 'banner', d: { aspect: 3, av: 0.18, ax: 0.03, overlap: 0.5 }, m: { aspect: 3, av: 0.22, ax: 0.04, overlap: 0.5 } },
  discord: { name: 'Discord', layout: 'discord', banner: 'banner', d: { aspect: 16 / 9, av: 0.1, ax: 0, overlap: 0 }, m: { aspect: 16 / 9, av: 0.14, ax: 0, overlap: 0 } },
};

/** Visible part of the banner (source fractions) for a display aspect. */
function cropFor(v: View, srcAspect: number): Rect {
  if (v.crop) return v.crop;
  const D = v.aspect ?? srcAspect;
  return D > srcAspect ? { x: 0, y: (1 - srcAspect / D) / 2, w: 1, h: srcAspect / D, label: 'Visible area' } : { x: (1 - D / srcAspect) / 2, y: 0, w: D / srcAspect, h: 1, label: 'Visible area' };
}

export function mockWarnings(p: string, mode: 'd' | 'm', get: (id: string) => Asset | undefined): string[] {
  const def = MOCKS[p];
  if (!def?.banner) return [];
  const b = get(def.banner);
  if (!b) return [];
  const v = def[mode];
  const crop = cropFor(v, b.w / b.h);
  const covers: Rect[] = [];
  if (v.overlap > 0) {
    // avatar rect in display px (banner width = 1) → source fractions
    const dispH = (crop.h * b.h) / (crop.w * b.w);
    const ax = typeof v.ax === 'number' ? v.ax : 0.5 - v.av / 2;
    const top = dispH - v.av * v.overlap;
    const r = { x: crop.x + ax * crop.w, y: crop.y + (top / dispH) * crop.h, w: v.av * crop.w, h: Math.min(1, ((v.av * v.overlap) / dispH)) * crop.h, label: 'avatar' };
    covers.push(r);
  }
  return safeWarnings(b.keys, covers, [crop]);
}

const Dots = ({ n = 3 }: { n?: number }) => <span className="mk-dots">{Array.from({ length: n }, (_, i) => <i key={i} />)}</span>;

function Profile({ p, mode, get, bio, name, handle }: { p: string; mode: 'd' | 'm'; get: (id: string) => Asset | undefined; bio: string; name: string; handle: string }) {
  const def = MOCKS[p];
  const v = def[mode];
  const W = mode === 'd' ? 560 : 300;
  const av = get('avatar');
  const ban = def.banner ? get(def.banner) : undefined;
  const post = def.post ? get(def.post) : undefined;
  const crop = ban ? cropFor(v, ban.w / ban.h) : null;
  const bh = crop && ban ? (W * crop.h * ban.h) / (crop.w * ban.w) : 0;
  const avPx = v.av * W;
  const avShape = p === 'discord' ? 'rounded' : 'circle';
  const bannerEl = ban && crop && (
    <div className="mk-banner" style={{ height: bh }}>
      <img src={ban.url} alt="" style={{ width: `${100 / crop.w}%`, height: `${100 / crop.h}%`, left: `${(-crop.x / crop.w) * 100}%`, top: `${(-crop.y / crop.h) * 100}%` }} />
    </div>
  );
  const avatarEl = (style: React.CSSProperties = {}) => av && <img className={`mk-av mk-av--${avShape}`} src={av.url} alt="" style={{ width: avPx, height: avPx, ...style }} />;
  const nameEl = <div className="mk-name"><b>{name}</b> <span>{handle}</span></div>;
  const stats = <div className="mk-stats"><span><b>1,204</b> following</span><span><b>48.1K</b> followers</span></div>;
  const pinned = post && <div className="mk-pin"><div className="mk-pin__lbl">📌 Pinned</div><img src={post.url} alt="" style={{ aspectRatio: `${post.w}/${post.h}` }} /></div>;
  const btn = <span className="mk-btn">Follow</span>;
  let body: React.ReactNode;
  if (def.layout === 'header') {
    body = <>
      {bannerEl}
      <div className="mk-pad" style={{ position: 'relative' }}>
        {avatarEl({ position: 'absolute', left: (v.ax as number) * W, top: -avPx * v.overlap, border: '3px solid var(--mk-bg)' })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', minHeight: avPx * (1 - v.overlap) }}>{btn}</div>
        {nameEl}<p className="mk-bio">{bio}</p>{stats}<Dots />
      </div>
      {pinned && <div className="mk-pad">{pinned}</div>}
    </>;
  } else if (def.layout === 'channel') {
    body = <>{bannerEl}<div className="mk-pad mk-row">{avatarEl()}<div>{nameEl}<p className="mk-bio">{bio}</p>{btn}</div></div>{pinned && <div className="mk-pad"><div className="mk-tabs"><b>Home</b><span>Videos</span><span>Shorts</span></div>{pinned}</div>}</>;
  } else if (def.layout === 'grid' || def.layout === 'centered') {
    const hls = ['live', 'map', 'au', 'news', 'polls', 'results', 'ask', 'menu'].map((i) => get(`highlight-${i}`)).filter(Boolean) as Asset[];
    body = <div className="mk-pad">
      <div className={def.layout === 'centered' ? 'mk-center' : 'mk-row'}>{avatarEl()}<div>{nameEl}{stats}</div></div>
      <p className="mk-bio" style={def.layout === 'centered' ? { textAlign: 'center' } : undefined}>{bio}</p>
      <div style={{ textAlign: def.layout === 'centered' ? 'center' : 'left' }}>{btn}</div>
      {def.layout === 'grid' && hls.length > 0 && <div className="mk-hls">{hls.slice(0, mode === 'd' ? 8 : 5).map((h, i) => <span key={i} className="mk-hl" style={{ backgroundImage: `url(${h.url})` }} />)}</div>}
      <div className="mk-grid">{post && <div className="mk-cell mk-cell--pin" style={{ backgroundImage: `url(${post.url})` }}><span>📌</span></div>}{Array.from({ length: 5 }, (_, i) => <div key={i} className="mk-cell" />)}</div>
    </div>;
  } else if (def.layout === 'threads') {
    body = <div className="mk-pad"><div className="mk-row" style={{ justifyContent: 'space-between' }}><div>{nameEl}</div>{avatarEl()}</div><p className="mk-bio">{bio}</p>{stats}{pinned}</div>;
  } else {
    body = <div className="mk-discord">
      <div className="mk-rail">{av && <img className="mk-av mk-av--rounded" src={av.url} alt="" style={{ width: 40, height: 40 }} />}<i /><i /><i /></div>
      <div className="mk-side" style={{ width: mode === 'd' ? 220 : 200 }}>{bannerEl}<b className="mk-pad">{name}</b>{['# welcome', '# live-calls', '# au-politics', '# ask'].map((c) => <div key={c} className="mk-chan">{c}</div>)}</div>
      {mode === 'd' && <div className="mk-chat"><Dots n={5} /><p className="mk-bio">{bio}</p></div>}
    </div>;
  }
  return <div className={`mk mk--${mode}`} style={{ width: W }}><div className="mk-chrome"><Dots /> <span>{def.name} · {mode === 'd' ? 'desktop' : 'mobile'}</span></div>{body}</div>;
}

export function Mockups({ platforms, get, bios, name, handle }: { platforms: string[]; get: (p: string, id: string) => Asset | undefined; bios: Record<string, string | undefined>; name: string; handle: string }) {
  const [mode, setMode] = useState<'d' | 'm'>('d');
  return (
    <div>
      <p className="ow-muted">Generic <strong>preview mockups</strong> drawn with neutral UI chrome — not the platforms’ actual interfaces. Layout, crops and avatar overlap approximate each app so you can check safe zones.</p>
      <div className="ow-filter">{(['d', 'm'] as const).map((m) => <button key={m} type="button" className={`ow-pill ${mode === m ? 'is-on' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>{m === 'd' ? 'Desktop' : 'Mobile'}</button>)}</div>
      <div className="mk-wrap">
        {platforms.filter((p) => MOCKS[p]).map((p) => {
          const g = (id: string) => get(p, id);
          const warn = mockWarnings(p, mode, g);
          return (
            <figure key={p} className="mk-fig">
              <div className="mk-badge">PREVIEW MOCKUP</div>
              <Profile p={p} mode={mode} get={g} bio={bios[p] || 'Live US midterm + Australian election results, calls and maps. Free, fast, no spin.'} name={name} handle={handle} />
              <figcaption>{warn.length ? warn.map((w) => <div key={w} className="mk-warn" role="alert">⚠ {w}</div>) : <div className="mk-ok">✓ Key content clear of avatar & crops</div>}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

export const MOCK_CSS = `
.mk-wrap{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start}
.mk-fig{margin:0;position:relative;max-width:100%}
.mk-badge{position:absolute;z-index:3;top:6px;right:6px;background:#ffcc00;color:#000;font:800 9px/1 system-ui;letter-spacing:.08em;padding:3px 6px;border-radius:3px}
.mk{--mk-bg:#16181d;background:var(--mk-bg);color:#e8eaf0;border:1px solid #2c3038;border-radius:12px;overflow:hidden;font:13px/1.35 system-ui,sans-serif;max-width:100%}
.mk--m{border-radius:22px;border-width:6px;border-color:#2c3038}
.mk-chrome{display:flex;gap:8px;align-items:center;padding:6px 10px;background:#0f1114;color:#8a90a0;font-size:11px}
.mk-dots{display:inline-flex;gap:4px}.mk-dots i{width:7px;height:7px;border-radius:50%;background:#3a3f4a}
.mk-banner{position:relative;overflow:hidden;background:#222}.mk-banner img{position:absolute;max-width:none}
.mk-pad{padding:10px 14px;display:block}.mk-row{display:flex;gap:12px;align-items:center}.mk-center{display:flex;flex-direction:column;align-items:center;gap:6px}
.mk-av{display:block;object-fit:cover;background:#333}.mk-av--circle{border-radius:50%}.mk-av--rounded{border-radius:30%}
.mk-name b{font-size:15px}.mk-name span{color:#8a90a0}.mk-bio{margin:6px 0;color:#d0d4de}
.mk-stats{display:flex;gap:12px;color:#8a90a0;font-size:12px}.mk-stats b{color:#e8eaf0}
.mk-btn{display:inline-block;background:#e8eaf0;color:#111;border-radius:999px;padding:4px 14px;font-weight:700;font-size:12px;margin:4px 0}
.mk-pin{border:1px solid #2c3038;border-radius:10px;padding:8px}.mk-pin__lbl{font-size:11px;color:#8a90a0;margin-bottom:4px}.mk-pin img{width:100%;max-height:260px;object-fit:contain;border-radius:6px;display:block}
.mk-hls{display:flex;gap:8px;margin:8px 0;overflow:hidden}.mk-hl{width:44px;height:44px;flex:none;border-radius:50%;background-size:180% auto;background-position:center;border:2px solid #3a3f4a}
.mk-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;margin-top:8px}.mk-cell{aspect-ratio:3/4;background:#23262d;background-size:cover;background-position:center;position:relative}.mk-cell span{position:absolute;top:4px;right:4px;font-size:11px}
.mk-tabs{display:flex;gap:14px;margin-bottom:8px;color:#8a90a0}.mk-tabs b{color:#e8eaf0;border-bottom:2px solid #e8eaf0}
.mk-discord{display:flex;min-height:300px}.mk-rail{width:56px;background:#0f1114;display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px 0}.mk-rail i{width:40px;height:40px;border-radius:50%;background:#2a2e36}
.mk-side{background:#1c1f25}.mk-chan{padding:3px 14px;color:#8a90a0}.mk-chat{flex:1;padding:12px}
.mk-warn{color:#ff6b6b;font-size:12px}.mk-ok{color:#3ddc84;font-size:12px}
`;
