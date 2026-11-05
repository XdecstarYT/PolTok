// "Make with AI" (Owner panel) — parsing + validation of the model's compose JSON.
// Shared by the server (server/ai.js, mode 'compose') and the client (src/features/owner/MakeWithAi.tsx).
// The model only chooses a subject, a design and wording; every number on the card comes from live data.

export const COMPOSE_KINDS = ['race', 'balance', 'au-seat', 'promo', 'stat', 'flip', 'quote'];
export const TWEET_MAX = 250; // body chars, excluding the link
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_:.-]{0,47}$/;
const DEFAULT_IDS = { race: '', balance: 'senate', 'au-seat': '', promo: 'default', stat: 'calls', flip: '', quote: '' };

/** Extract the first JSON object from model output (handles fences / prose around it). */
export function parseComposeJson(text) {
  const s = String(text ?? '').trim();
  try {
    const o = JSON.parse(s);
    if (o && typeof o === 'object' && !Array.isArray(o)) return o;
  } catch {
    /* fall through */
  }
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const o = JSON.parse(s.slice(start, i + 1));
        return o && typeof o === 'object' && !Array.isArray(o) ? o : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** Trim a tweet body to TWEET_MAX chars (code points), dropping links (the app adds its own deep link). */
export function cleanTweet(t) {
  let s = typeof t === 'string' ? t : '';
  s = s.replace(/https?:\/\/\S+/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  const cps = [...s];
  if (cps.length > TWEET_MAX) s = cps.slice(0, TWEET_MAX - 1).join('').trimEnd() + '…';
  return s;
}

/**
 * Validate/normalise a compose object.
 * designs: [{ id, kinds: string[] }]; opts.validId?(kind, id) → boolean (client checks real ids).
 * Unknown kind/id/design → sensible defaults. Never throws.
 */
export function validateCompose(raw, designs = [], opts = {}) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const fixes = [];
  const subj = o.subject && typeof o.subject === 'object' ? o.subject : {};
  let kind = COMPOSE_KINDS.includes(subj.kind) ? subj.kind : '';
  const badKind = !kind;
  if (badKind) {
    fixes.push('subject.kind');
    kind = 'promo';
  }
  let id = badKind ? '' : typeof subj.id === 'string' || typeof subj.id === 'number' ? String(subj.id).trim() : '';
  const okId = id && ID_RE.test(id) && (!opts.validId || opts.validId(kind, id));
  if (!okId) {
    if (id) fixes.push('subject.id');
    id = DEFAULT_IDS[kind] ?? '';
    if (opts.validId && id && !opts.validId(kind, id)) id = '';
  }
  const list = Array.isArray(designs) ? designs.filter((d) => d && typeof d.id === 'string') : [];
  const fits = (d) => !Array.isArray(d.kinds) || !d.kinds.length || d.kinds.includes(kind);
  let designId = typeof o.designId === 'string' ? o.designId : '';
  const hit = list.find((d) => d.id === designId);
  if (!hit || !fits(hit)) {
    if (list.length) fixes.push('designId');
    designId = (list.find(fits) ?? list[0])?.id ?? designId;
  }
  const ov = o.cardOverrides && typeof o.cardOverrides === 'object' ? o.cardOverrides : {};
  const cardOverrides = {};
  const t = str(ov.title, 70), st = str(ov.subtitle, 110), f = str(ov.footer, 60);
  // Overrides change wording only — reject any that introduce digits (numbers come from live data).
  for (const [k, v] of [['title', t], ['subtitle', st], ['footer', f]]) {
    if (!v) continue;
    if (/\d/.test(v) && k !== 'footer') {
      fixes.push(`cardOverrides.${k}`);
      continue;
    }
    cardOverrides[k] = v;
  }
  const tweet = cleanTweet(o.tweet);
  if (!tweet) fixes.push('tweet');
  const altText = str(o.altText, 400) || `PolTok card: ${kind} ${id}`.trim();
  return { subject: { kind, id }, designId, tweet, cardOverrides, altText, fixes };
}

/** Compact design list for the prompt: "id|name|kinds|WxH" per line. */
export function designsForPrompt(designs, max = 3500) {
  let out = '';
  for (const d of Array.isArray(designs) ? designs.slice(0, 80) : []) {
    const line = `${str(d.id, 40)}|${str(d.name, 40)}|${(Array.isArray(d.kinds) ? d.kinds : []).slice(0, 7).join(',')}|${Number(d.w) || ''}x${Number(d.h) || ''}\n`;
    if (out.length + line.length > max) break;
    out += line;
  }
  return out.trim();
}
