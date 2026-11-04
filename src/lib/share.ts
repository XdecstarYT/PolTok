/**
 * Share cards — client-side PNG rendering with <canvas> (agent 7 / SHARE).
 *
 *   renderShareCard({ kind: 'race', id: 'PA-SEN', format: 'landscape', live })  → Promise<Blob>
 *
 * kinds: 'race' (id = race id), 'balance' (id = 'senate' | 'house'), 'au-seat' (id = AU seat id).
 * formats: 'landscape' 1200×630 (link previews / X / Facebook), 'story' 1080×1920 (IG/TikTok stories).
 * Headshots are drawn only when the image host allows CORS (crossOrigin=anonymous); otherwise
 * an initials avatar in the party color is used so the canvas never taints.
 * Times are rendered in the user's Settings time zone (fmtTime/fmtDay/tzAbbr).
 *
 * UI: <ShareCardButton kind id /> (re-exported below) opens a preview modal with
 * Download / Copy image / Share.
 */
import type { BalanceOfPower, Candidate, Party, Race, RaceResult } from '../types';
import { raceById } from '../data';
import { PARTY_HEX, PARTY_NAME, initials } from './format';
import { fmtDay, fmtTime, tzAbbr } from '../components/time';
import type { LiveState } from './live';
import { pColor, party as auParty, seatById, stateName as auStateName } from '../features/au/model';

export type ShareKind = 'race' | 'balance' | 'au-seat';
export type ShareFormat = 'landscape' | 'story';
export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number; label: string }> = {
  landscape: { w: 1200, h: 630, label: 'Post · 1200×630' },
  story: { w: 1080, h: 1920, label: 'Story · 1080×1920' },
};
export const US_ATTRIBUTION = 'Results: AP via NYT';
const AU_ATTRIBUTION = 'Seat data: AEC / VEC via PolTok';

const C = {
  bg0: '#05070d', bg1: '#0b0e18', bg2: '#121726', bg3: '#1a2033',
  line: 'rgba(160,180,255,0.14)', text: '#f2f5ff', text2: '#a3adc8', text3: '#6a7391', accent: '#c6ff3d', live: '#ff3d55',
};
const FONT = `Inter, 'Segoe UI', system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif`;
const f = (px: number, w = 600) => `${w} ${Math.round(px)}px ${FONT}`;

/* ─────────────── data → card model ─────────────── */

interface CandRow { name: string; party: string; color: string; pct: number | null; votes: number | null; winner: boolean; photo?: string; incumbent?: boolean }
export interface CardModel {
  kicker: string;
  title: string;
  subtitle?: string;
  status: { text: string; color: string };
  rows?: CandRow[];
  balance?: BalanceOfPower;
  au?: { member: string; party: string; partyName: string; color: string; margin: number | null; vs?: string; contest?: string; note?: string };
  updated: number;
  attribution: string;
}

const side = (p: string) => (p === 'I' ? 'D' : p);
const hexA = (c: string, a: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c + a : a === '00' ? 'rgba(0,0,0,0)' : 'rgba(160,180,255,0.15)');
const pHex = (p: string) => PARTY_HEX[p as Party] ?? PARTY_HEX.O;

export function raceCandidates(race: Race, r?: RaceResult): Candidate[] {
  return r?.candidates?.length ? r.candidates : race.candidates;
}

export function buildCardModel(kind: ShareKind, id: string, live: Pick<LiveState, 'results' | 'balance' | 'lastUpdate'>): CardModel | null {
  const now = live.lastUpdate || Date.now();
  if (kind === 'race') {
    const race = raceById.get(id);
    if (!race) return null;
    const r = live.results[id];
    const cands = raceCandidates(race, r);
    const total = r ? Object.values(r.votes).reduce((a, b) => a + b, 0) : 0;
    const rows: CandRow[] = cands
      .map((c) => {
        const v = r?.votes[c.id] ?? null;
        return { name: c.name, party: c.party, color: pHex(c.party), votes: v, pct: total > 0 && v != null ? (v / total) * 100 : null, winner: r?.calledFor === c.id, photo: c.photo, incumbent: c.incumbent };
      })
      .sort((a, b) => (b.votes ?? -1) - (a.votes ?? -1))
      .slice(0, 4);
    const winner = cands.find((c) => c.id === r?.calledFor);
    let status: CardModel['status'];
    if (winner) {
      const flip = side(winner.party) !== side(race.incumbentParty);
      status = { text: flip ? `${winner.party} FLIP · CALLED` : 'PROJECTED WINNER', color: pHex(winner.party) };
    } else if (r?.status === 'too-close') status = { text: 'TOO CLOSE TO CALL', color: '#f5c518' };
    else if (r && r.expectedPct > 0) status = { text: `LIVE · ~${Math.round(r.expectedPct)}% IN`, color: C.live };
    else status = { text: r?.status === 'polls-closed' ? 'POLLS CLOSED' : 'AWAITING RESULTS', color: C.text3 };
    return {
      kicker: `${race.state} · ${race.chamber === 'house' ? 'U.S. House' : race.chamber === 'senate' ? 'U.S. Senate' : race.chamber === 'governor' ? 'Governor' : race.chamber}${race.special ? ' (special)' : ''}`,
      title: race.title,
      subtitle: r && r.expectedPct > 0 ? `~${Math.round(r.expectedPct)}% of expected vote counted` : 'No votes reported yet',
      status, rows, updated: r?.updatedAt || now, attribution: US_ATTRIBUTION,
    };
  }
  if (kind === 'balance') {
    const chamber = id === 'house' ? 'house' : 'senate';
    const b = live.balance[chamber];
    if (!b) return null;
    const d = b.dem + b.ind;
    const ctl = d >= b.majority ? 'D' : b.rep >= b.majority ? 'R' : null;
    return {
      kicker: 'Balance of power',
      title: chamber === 'senate' ? 'U.S. Senate' : 'U.S. House',
      subtitle: `${b.majority} seats for control${chamber === 'senate' ? ' · VP breaks ties' : ''}`,
      status: ctl ? { text: `${ctl === 'D' ? 'DEMOCRATS' : 'REPUBLICANS'} WIN CONTROL`, color: pHex(ctl) } : { text: `${b.undecided} SEATS UNDECIDED`, color: C.live },
      balance: b, updated: now, attribution: US_ATTRIBUTION,
    };
  }
  const seat = seatById.get(id);
  if (!seat) return null;
  const p = auParty(seat.party);
  return {
    kicker: `${seat.chamber === 'vic' ? 'Victorian Legislative Assembly' : 'Australian House of Representatives'} · ${seat.state}`,
    title: seat.name,
    subtitle: auStateName(seat.state),
    status: seat.vacant ? { text: 'VACANT', color: C.text3 } : { text: `${p.short} HELD`, color: pColor(seat.party) },
    au: { member: seat.vacant ? 'Vacant' : seat.member, party: p.short, partyName: p.name, color: pColor(seat.party), margin: seat.margin, vs: seat.vs, contest: seat.contest, note: seat.note },
    updated: Date.now(), attribution: AU_ATTRIBUTION,
  };
}

/* ─────────────── canvas helpers ─────────────── */

type Ctx = CanvasRenderingContext2D;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

function fitText(ctx: Ctx, text: string, maxW: number, px: number, weight = 700, min = 18): number {
  let size = px;
  ctx.font = f(size, weight);
  while (size > min && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = f(size, weight);
  }
  return size;
}

function ellipsize(ctx: Ctx, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
/** Loads an image with CORS; resolves null if the host doesn't allow it (keeps canvas untainted). */
export function loadCorsImage(src?: string, timeout = 2000): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  let p = imgCache.get(src);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.decoding = 'async';
      const t = setTimeout(() => resolve(null), timeout);
      img.onload = () => { clearTimeout(t); resolve(img); };
      img.onerror = () => { clearTimeout(t); resolve(null); };
      img.src = src;
    });
    imgCache.set(src, p);
  }
  return p;
}

function avatar(ctx: Ctx, x: number, y: number, size: number, name: string, color: string, img: HTMLImageElement | null) {
  const cx = x + size / 2, cy = y + size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  if (img) {
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - s) / 2;
    const sy = Math.max(0, (img.naturalHeight - s) * 0.2);
    ctx.drawImage(img, sx, sy, s, s, x, y, size, size);
  } else {
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = f(size * 0.38, 800);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(name), cx, cy + size * 0.02);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(3, size * 0.045);
  ctx.strokeStyle = color;
  ctx.stroke();
}

function wordmark(ctx: Ctx, x: number, y: number, s: number) {
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.accent;
  ctx.beginPath();
  ctx.arc(x + s * 0.32, y - s * 0.34, s * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = f(s, 800);
  ctx.fillStyle = C.text;
  ctx.fillText('Pol', x + s * 0.8, y);
  const w = ctx.measureText('Pol').width;
  ctx.fillStyle = C.accent;
  ctx.fillText('Tok', x + s * 0.8 + w, y);
}

function pill(ctx: Ctx, text: string, color: string, xRight: number, y: number, px: number) {
  ctx.font = f(px, 800);
  const w = ctx.measureText(text).width + px * 1.6 + px * 0.9;
  const h = px * 2;
  const x = xRight - w;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = hexA(color, '26');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x + px * 0.9, y + h / 2, px * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.text;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + px * 1.5, y + h / 2 + 1);
}

function background(ctx: Ctx, W: number, H: number, tint: string) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, C.bg1);
  g.addColorStop(1, C.bg0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rg = ctx.createRadialGradient(W, 0, 0, W, 0, Math.max(W, H) * 0.9);
  rg.addColorStop(0, hexA(tint, '40'));
  rg.addColorStop(1, hexA(tint, '00'));
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
  // faint grid
  ctx.strokeStyle = 'rgba(160,180,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
  // accent rule on the left
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, 10, H);
}

const fmtN = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const stamp = (ts: number) => `${fmtDay(ts, 'short')} · ${fmtTime(ts)} ${tzAbbr(ts)}`;

/* ─────────────── renderer ─────────────── */

export async function renderShareCanvas(model: CardModel, format: ShareFormat): Promise<HTMLCanvasElement> {
  const { w: W, h: H } = SHARE_SIZES[format];
  const story = format === 'story';
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  try { await (document as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* ignore */ }
  const imgs = await Promise.all((model.rows ?? []).map((r) => loadCorsImage(r.photo)));

  const pad = story ? 84 : 64;
  background(ctx, W, H, model.status.color);

  // header
  const headY = story ? 150 : 92;
  wordmark(ctx, pad, headY, story ? 56 : 40);
  pill(ctx, model.status.text, model.status.color, W - pad, headY - (story ? 48 : 34), story ? 26 : 18);

  // titles
  let y = headY + (story ? 150 : 56);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.text2;
  ctx.font = f(story ? 32 : 22, 700);
  ctx.fillText(model.kicker.toUpperCase(), pad, y);
  y += story ? 92 : 56;
  const ts = fitText(ctx, model.title, W - pad * 2, story ? 96 : 60, 800, 30);
  ctx.fillStyle = C.text;
  ctx.fillText(model.title, pad, y);
  if (model.subtitle) {
    y += story ? 60 : 34;
    ctx.font = f(story ? 32 : 22, 500);
    ctx.fillStyle = C.text3;
    ctx.fillText(model.subtitle, pad, y);
  }
  y += story ? 90 : 30;
  void ts;

  const footH = story ? 150 : 74;
  const bodyBottom = H - footH - (story ? 40 : 10);

  if (model.rows) drawRows(ctx, model.rows.slice(0, story ? 4 : 3), imgs, pad, y, W - pad * 2, bodyBottom - y, story);
  else if (model.balance) drawBalance(ctx, model.balance, pad, y, W - pad * 2, bodyBottom - y, story);
  else if (model.au) drawAu(ctx, model, pad, y, W - pad * 2, bodyBottom - y, story);

  // footer
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, H - footH, W, footH);
  ctx.fillStyle = C.line;
  ctx.fillRect(0, H - footH, W, 2);
  ctx.textBaseline = 'middle';
  const fy = H - footH / 2;
  ctx.font = f(story ? 28 : 19, 600);
  ctx.fillStyle = C.text2;
  ctx.textAlign = 'left';
  if (story) {
    ctx.fillText(model.attribution, pad, fy - 22);
    ctx.fillStyle = C.text3;
    ctx.fillText(`As of ${stamp(model.updated)}`, pad, fy + 22);
  } else {
    ctx.fillText(`${model.attribution}  ·  As of ${stamp(model.updated)}`, pad, fy);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = C.accent;
  ctx.font = f(story ? 28 : 19, 800);
  ctx.fillText(location.host || 'poltok', W - pad, story ? fy - 22 : fy);
  return cv;
}

function drawRows(ctx: Ctx, rows: CandRow[], imgs: (HTMLImageElement | null)[], x: number, y: number, w: number, h: number, story: boolean) {
  const n = Math.max(rows.length, 1);
  const gap = story ? 36 : 14;
  const rowH = Math.min(story ? 250 : 110, (h - gap * (n - 1)) / n);
  const av = rowH * (story ? 0.62 : 0.78);
  rows.forEach((r, i) => {
    const ry = y + i * (rowH + gap);
    rr(ctx, x, ry, w, rowH, 18);
    ctx.fillStyle = r.winner ? hexA(r.color, '22') : 'rgba(18,23,38,0.85)';
    ctx.fill();
    ctx.lineWidth = r.winner ? 3 : 1.5;
    ctx.strokeStyle = r.winner ? r.color : C.line;
    ctx.stroke();
    const ix = x + rowH * 0.14;
    avatar(ctx, ix, ry + (rowH - av) / 2, av, r.name, r.color, imgs[i]);
    const tx = ix + av + rowH * 0.18;
    const pctW = story ? 250 : 190;
    const nameW = x + w - tx - pctW - 20;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.text;
    ctx.font = f(story ? 46 : Math.min(34, rowH * 0.3), 800);
    const nameY = ry + rowH * (story ? 0.4 : 0.44);
    ctx.fillText(ellipsize(ctx, r.name + (r.winner ? '  ✓' : ''), nameW), tx, nameY);
    ctx.font = f(story ? 28 : Math.min(19, rowH * 0.18), 600);
    ctx.fillStyle = r.color;
    const meta = `${PARTY_NAME[r.party as Party] ?? r.party}${r.incumbent ? ' · Incumbent' : ''}${r.votes != null ? `  ·  ${fmtN(r.votes)} votes` : ''}`;
    ctx.fillText(ellipsize(ctx, meta, nameW), tx, nameY + (story ? 44 : rowH * 0.24));
    // bar
    const by = ry + rowH * 0.78, bw = x + w - tx - rowH * 0.2, bh = story ? 14 : 8;
    rr(ctx, tx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fill();
    if (r.pct != null && r.pct > 0) {
      rr(ctx, tx, by, Math.max(bh, (bw * r.pct) / 100), bh, bh / 2);
      ctx.fillStyle = r.color;
      ctx.fill();
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = C.text;
    ctx.font = f(story ? 84 : Math.min(56, rowH * 0.5), 800);
    ctx.fillText(r.pct != null ? `${r.pct.toFixed(1)}%` : '—', x + w - rowH * 0.2, nameY + (story ? 20 : 8));
  });
}

function drawBalance(ctx: Ctx, b: BalanceOfPower, x: number, y: number, w: number, h: number, story: boolean) {
  const D = PARTY_HEX.D, R = PARTY_HEX.R, I = PARTY_HEX.I;
  const big = story ? 200 : 120;
  ctx.textBaseline = 'alphabetic';
  const ny = y + big * 0.9;
  ctx.font = f(big, 900);
  ctx.textAlign = 'left';
  ctx.fillStyle = D;
  ctx.fillText(String(b.dem + b.ind), x, ny);
  ctx.textAlign = 'right';
  ctx.fillStyle = R;
  ctx.fillText(String(b.rep), x + w, ny);
  ctx.font = f(story ? 34 : 22, 700);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.text2;
  ctx.fillText(`DEMOCRATS${b.ind ? ` (incl. ${b.ind} ind.)` : ''}`, x, ny + (story ? 56 : 34));
  ctx.textAlign = 'right';
  ctx.fillText('REPUBLICANS', x + w, ny + (story ? 56 : 34));
  ctx.textAlign = 'center';
  ctx.fillStyle = C.text3;
  ctx.font = f(story ? 34 : 22, 700);
  ctx.fillText(`${b.undecided} undecided`, x + w / 2, ny - big * 0.35);

  const by = ny + (story ? 130 : 66), bh = story ? 96 : 54;
  const seg = (from: number, n: number, color: string) => {
    const sx = x + (w * from) / b.total, sw = (w * n) / b.total;
    ctx.fillStyle = color;
    ctx.fillRect(sx, by, sw, bh);
  };
  ctx.save();
  rr(ctx, x, by, w, bh, 12);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x, by, w, bh);
  seg(0, b.dem, D);
  seg(b.dem, b.ind, I);
  seg(b.total - b.rep, b.rep, R);
  ctx.restore();
  // majority tick
  const mx = x + (w * b.majority) / b.total;
  ctx.fillStyle = C.text;
  ctx.fillRect(mx - 2, by - 16, 4, bh + 32);
  ctx.font = f(story ? 28 : 18, 700);
  ctx.textAlign = 'center';
  ctx.fillText(`${b.majority} for majority`, mx, by + bh + (story ? 64 : 42));

  const lines: string[] = [];
  if (b.projected) lines.push(`Model projection: D ${b.projected.dem} – R ${b.projected.rep}`);
  if (b.controlProb) lines.push(`Control chance: D ${Math.round(b.controlProb.D * 100)}% · R ${Math.round(b.controlProb.R * 100)}%`);
  ctx.font = f(story ? 32 : 20, 500);
  ctx.fillStyle = C.text3;
  lines.forEach((l, i) => {
    const ly = by + bh + (story ? 160 : 80) + i * (story ? 52 : 28);
    if (ly < y + h) ctx.fillText(l, x + w / 2, ly);
  });
}

function drawAu(ctx: Ctx, m: CardModel, x: number, y: number, w: number, h: number, story: boolean) {
  const a = m.au!;
  const av = story ? 260 : 150;
  avatar(ctx, x, y, av, a.member, a.color, null);
  const tx = story ? x : x + av + 40;
  let ty = story ? y + av + 90 : y + 56;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.text;
  fitText(ctx, a.member, x + w - tx, story ? 76 : 50, 800, 24);
  ctx.fillText(a.member, tx, ty);
  ty += story ? 64 : 42;
  ctx.font = f(story ? 38 : 26, 700);
  ctx.fillStyle = a.color;
  ctx.fillText(`${a.partyName} (${a.party})`, tx, ty);
  ty += story ? 120 : 70;
  const stats: [string, string][] = [];
  if (a.margin != null) stats.push(['Margin', `${a.margin.toFixed(2)}%${a.vs ? ` vs ${a.vs}` : ''}`]);
  if (a.contest) stats.push(['2025 contest', a.contest]);
  stats.forEach(([k, v], i) => {
    const sx = (story ? x : tx) + i * (story ? w / 2 : 340);
    ctx.font = f(story ? 28 : 18, 700);
    ctx.fillStyle = C.text3;
    ctx.fillText(k.toUpperCase(), sx, ty);
    ctx.font = f(story ? 56 : 36, 800);
    ctx.fillStyle = C.text;
    ctx.fillText(v, sx, ty + (story ? 66 : 44));
  });
  if (a.note && story && ty + 200 < y + h) {
    ctx.font = f(28, 500);
    ctx.fillStyle = C.text3;
    ctx.fillText(ellipsize(ctx, a.note, w), x, ty + 200);
  }
}

export async function renderShareCard(kind: ShareKind, id: string, format: ShareFormat, live: Pick<LiveState, 'results' | 'balance' | 'lastUpdate'>): Promise<Blob | null> {
  const model = buildCardModel(kind, id, live);
  if (!model) return null;
  const cv = await renderShareCanvas(model, format);
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/png'));
}

export function shareFileName(kind: ShareKind, id: string, format: ShareFormat) {
  return `poltok-${kind}-${id.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${format}.png`;
}

export { ShareCardButton } from '../features/embed/ShareCardButton';
