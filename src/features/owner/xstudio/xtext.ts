/**
 * X (Twitter) text rules, dependency-free — mirrors twitter-text v3 "weighted length":
 *  - every URL (http(s)://… or a bare domain like poltok.netlify.app/x) counts as 23 (t.co wrapping);
 *  - Latin / common punctuation code points count 1, everything else (CJK, most symbols) counts 2;
 *  - an emoji (incl. ZWJ sequences, flags, skin tones) counts 2 in total;
 *  - text is NFC-normalised first. Limit: 280.
 * Pure module (no DOM) so tests can bundle it with esbuild.
 */
export const X_MAX = 280;
export const URL_WEIGHT = 23;
export const SITE = 'https://poltok.netlify.app';

const LIGHT: [number, number][] = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const TLD = '(?:com|net|org|app|io|co|gov|edu|au|nz|uk|us|ai|dev|news|tv|me|info|ly|gg|xyz)';
/** URLs X would auto-link. Trailing punctuation is not part of the link. */
export const URL_RE = new RegExp(`(?:https?:\\/\\/[^\\s<>"]+|\\b(?:[a-z0-9-]+\\.)+${TLD}\\b(?:\\/[^\\s<>"]*)?)`, 'gi');
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

function cpWeight(cp: number) {
  for (const [a, b] of LIGHT) if (cp >= a && cp <= b) return 1;
  return 2;
}

/** Split into grapheme clusters (Intl.Segmenter when available; code points otherwise). */
function graphemes(s: string): string[] {
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment);
  return [...s];
}

function plainWeight(s: string) {
  let n = 0;
  for (const g of graphemes(s)) {
    if (EMOJI_RE.test(g)) n += 2;
    else for (const ch of g) n += cpWeight(ch.codePointAt(0)!);
  }
  return n;
}

const trimUrl = (u: string) => u.replace(/[.,!?;:)\]'"…]+$/, '');

/** URLs found in the text (as X would link them). */
export function findUrls(text: string): string[] {
  return [...String(text ?? '').normalize('NFC').matchAll(URL_RE)].map((m) => trimUrl(m[0]));
}

/** X weighted length of a post. */
export function xLength(text: string): number {
  const s = String(text ?? '').normalize('NFC');
  let n = 0;
  let last = 0;
  for (const m of s.matchAll(URL_RE)) {
    const url = trimUrl(m[0]);
    n += plainWeight(s.slice(last, m.index)) + URL_WEIGHT;
    last = m.index! + url.length;
  }
  return n + plainWeight(s.slice(last));
}

export const fitsX = (text: string, max = X_MAX) => xLength(text) <= max;
export const xRemaining = (text: string, max = X_MAX) => max - xLength(text);

/** Cut text (grapheme-safe) so it fits `max`, adding an ellipsis. URLs are never cut in half. */
export function trimToFit(text: string, max = X_MAX): string {
  if (fitsX(text, max)) return text;
  const words = text.split(/(\s+)/);
  let out = '';
  for (const w of words) {
    if (xLength(out + w + '…') > max) break;
    out += w;
  }
  out = out.trimEnd();
  if (!out) {
    // one giant word: cut graphemes
    for (const g of graphemes(text)) {
      if (xLength(out + g + '…') > max) break;
      out += g;
    }
  }
  return out + '…';
}

/** "#PolTok #auspol" from a list (dedupes, strips junk, adds #). */
export function hashtagLine(tags: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const c = String(t).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!c || seen.has(c.toLowerCase())) continue;
    seen.add(c.toLowerCase());
    out.push('#' + c.slice(0, 40));
  }
  return out.join(' ');
}

/** Hashtags already present in a text. */
export const hashtagsIn = (text: string) => [...String(text).matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)].map((m) => '#' + m[2]);

/**
 * Assemble one post: body, then hashtags, then link — trimming only the body so the post always fits.
 */
export function assemblePost(body: string, opts: { tags?: string[]; url?: string; max?: number } = {}): string {
  const max = opts.max ?? X_MAX;
  const have = new Set(hashtagsIn(body).map((t) => t.toLowerCase()));
  const tags = hashtagLine((opts.tags ?? []).filter((t) => !have.has(('#' + t.replace(/^#+/, '')).toLowerCase())));
  const tail = [tags, opts.url].filter(Boolean).join('\n');
  const room = max - (tail ? xLength('\n' + tail) : 0);
  const b = trimToFit(body.trim(), Math.max(20, room));
  return tail ? `${b}\n${tail}` : b;
}

/**
 * Split long text into a numbered thread. Splits on paragraphs, then sentences, then words; every post
 * (including its " 1/3" counter) fits `max`. Single post → no counter.
 */
export function splitThread(text: string, opts: { max?: number; number?: boolean } = {}): string[] {
  const max = opts.max ?? X_MAX;
  const clean = String(text ?? '').replace(/\r/g, '').trim();
  if (!clean) return [];
  if (fitsX(clean, max)) return [clean];
  const reserve = 8; // "\n\n12/12"
  const cap = max - (opts.number === false ? 0 : reserve);
  // units carry the separator that preceded them: paragraph break, line break or space
  const units: { t: string; sep: string }[] = [];
  clean.split(/\n{2,}/).forEach((para, pi) => {
    let sep = pi ? '\n\n' : '';
    if (fitsX(para, cap)) { units.push({ t: para, sep }); return; }
    for (const line of para.split('\n')) {
      const pieces = fitsX(line, cap) ? [line] : (line.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? [line]);
      pieces.forEach((s0, si) => {
        const s1 = s0.trim();
        if (!s1) return;
        const sp = si ? ' ' : sep;
        if (fitsX(s1, cap)) units.push({ t: s1, sep: sp });
        else {
          let cur = '';
          let first = true;
          for (const w of s1.split(/\s+/)) {
            if (cur && !fitsX(cur + ' ' + w, cap)) { units.push({ t: cur, sep: first ? sp : ' ' }); first = false; cur = w; } else cur = cur ? cur + ' ' + w : w;
          }
          if (cur) units.push({ t: trimToFit(cur, cap), sep: first ? sp : ' ' });
        }
      });
      sep = '\n';
    }
  });
  const posts: string[] = [];
  let cur = '';
  for (const u of units) {
    if (cur && !fitsX(cur + u.sep + u.t, cap)) { posts.push(cur.trim()); cur = u.t; } else cur = cur ? cur + u.sep + u.t : u.t;
  }
  if (cur.trim()) posts.push(cur.trim());
  if (opts.number === false || posts.length < 2) return posts;
  return posts.map((p, i) => `${p}\n\n${i + 1}/${posts.length}`);
}

/** Add attribution params to a PolTok link (utm_source=x). Keeps the hash. Non-PolTok URLs untouched. */
export function utmUrl(url: string, campaign = 'xstudio'): string {
  try {
    const u = new URL(url, SITE);
    if (!/poltok\.netlify\.app$/.test(u.hostname)) return url;
    u.searchParams.set('utm_source', 'x');
    u.searchParams.set('utm_medium', 'social');
    u.searchParams.set('utm_campaign', campaign.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 40) || 'xstudio');
    return u.toString();
  } catch {
    return url;
  }
}

/** https://x.com/intent/post with text (+ optional url, which X appends). */
export function xIntentUrl(text: string, url?: string): string {
  const q = new URLSearchParams({ text });
  if (url) q.set('url', url);
  return `https://x.com/intent/post?${q.toString()}`;
}

/** For an intent: X appends `url` itself, so strip a trailing copy of it from the text. */
export function intentParts(post: string, url?: string): { text: string; url?: string } {
  if (url && post.includes(url)) return { text: post.replace(url, '').replace(/\n+$/, '').trimEnd(), url };
  return { text: post };
}
