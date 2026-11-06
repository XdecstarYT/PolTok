// node --test tests/ — AI-customisable cards: style/text validation, message posts, restyle/rewrite,
// social packs (copy limits + asset dimensions). Groq is mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateStyle, validateTexts, validateCompose, validateSocial, contrastRatio, fixInk, STYLE_PROMPT, STYLE_FONTS, SOCIAL_LIMITS, SOCIAL_PLATFORMS } from '../shared/compose.js';
import { SOCIAL_PACK, packAssets, packReadme } from '../shared/social.js';
import { handleAi, buildComposeMessages, promptChars, COMPOSE_TASKS } from '../server/ai.js';

const DESIGNS = [
  { id: 'broadcast', name: 'Broadcast', kinds: ['race', 'flip', 'stat', 'promo'], w: 1200, h: 675 },
  { id: 'statement', name: 'Bold statement', kinds: ['message', 'announcement', 'thanks', 'milestone', 'question', 'statement', 'quote'], w: 1080, h: 1080 },
  { id: 'poll', name: 'X poll companion', kinds: ['question', 'message', 'promo'], w: 1080, h: 1080 },
];

test('validateStyle: whitelists, clamps, hex, fonts, stickers, sizes', () => {
  const { style, fixes } = validateStyle({
    palette: { bg: '#0B1A33', fg: '#fff', accent: 'gold', dem: '#3d7bff' }, fontDisplay: 'playfair display', fontBody: 'Comic Sans',
    cornerRadius: 500, texture: 'glitter', textureOpacity: 7, logo: 'tr', watermark: 'x'.repeat(50), border: { width: 99, color: '#ABC' },
    stickers: [{ type: 'live', position: 'tl' }, { type: 'boom', text: 'Hot', position: 'nowhere' }, { type: 'custom' }, 4, 5, 6], alignment: 'justify', size: '1500x500',
  });
  assert.deepEqual(style.palette, { bg: '#0b1a33', fg: '#ffffff', dem: '#3d7bff' });
  assert.equal(style.fontDisplay, 'Playfair Display');
  assert.equal(style.fontBody, undefined);
  assert.equal(style.cornerRadius, 80);
  assert.equal(style.texture, undefined);
  assert.equal(style.textureOpacity, 1);
  assert.equal(style.watermark.length, 24);
  assert.deepEqual(style.border, { width: 40, color: '#aabbcc' });
  assert.deepEqual(style.stickers, [{ preset: 'live', pos: 'tl' }, { preset: 'custom', pos: 'tr', text: 'Hot' }]);
  assert.equal(style.align, undefined);
  assert.deepEqual(style.size, { w: 1500, h: 500 });
  for (const f of ['style.palette.accent', 'style.fontBody', 'style.texture', 'style.align', 'style.stickers']) assert.ok(fixes.includes(f), f);
  assert.deepEqual(validateStyle({ size: 'story' }).style.size, { w: 1080, h: 1920 });
  assert.deepEqual(validateStyle({ size: { w: 99999, h: 10 } }).style.size, { w: 4096, h: 200 });
  assert.ok(validateStyle({ size: 'huge' }).fixes.includes('style.size'));
  assert.deepEqual(validateStyle('junk'), { style: {}, fixes: [] });
});

test('validateStyle: low-contrast fg is auto-fixed to ≥4.5:1 (kit inkOn logic)', () => {
  const { style, fixes } = validateStyle({ palette: { bg: '#f7f3e8', fg: '#eeeeee', accent: '#0057ff' } });
  assert.ok(contrastRatio(style.palette.fg, style.palette.bg) >= 4.5);
  assert.ok(fixes.includes('style.palette.fg.contrast'));
  assert.equal(validateStyle({ palette: { bg: '#101010' } }).style.palette.fg, '#ffffff');
  assert.equal(fixInk('#ffffff', '#222222'), '#222222');
  assert.ok(contrastRatio(fixInk('#7f7f7f', '#808080'), '#7f7f7f') >= 4.5);
});

test('validateTexts: data card stats must match live values; mismatches replaced + flagged', () => {
  const liveStats = [{ label: 'Talarico', value: '50.2%' }, { label: 'Paxton', value: '48.1%' }];
  const r = validateTexts({ title: 'Texas *shock*', subtitle: 'Talarico up 52%', stats: [{ label: 'Talarico', value: '50.2%' }, { label: 'Paxton', value: '47%' }, { label: 'Made up', value: '9%' }], cta: 'Follow live', footer: 'AP 2026' }, { kind: 'race', liveStats });
  assert.equal(r.texts.title, 'Texas *shock*');
  assert.equal(r.texts.subtitle, undefined);
  assert.deepEqual(r.texts.stats, [{ label: 'Talarico', value: '50.2%' }, { label: 'Paxton', value: '48.1%' }]);
  assert.deepEqual(r.flagged, ['subtitle', 'stats.1', 'stats.2']);
  const ok = validateTexts({ subtitle: 'Talarico 50.2% with 80% in' }, { kind: 'race', facts: 'TX | Talarico 50.2%, 80% in' });
  assert.equal(ok.texts.subtitle, 'Talarico 50.2% with 80% in');
  const msg = validateTexts({ title: 'We hit *10,000* followers', options: ['A', 'B', 'C', 'D', 'E'], quoted: { text: 'our post' } }, { kind: 'milestone' });
  assert.equal(msg.texts.title, 'We hit *10,000* followers');
  assert.equal(msg.texts.options.length, 4);
  assert.equal(msg.texts.quoted.label, 'Our earlier post');
});

test('validateCompose: data post carries style + live-checked texts; message post', () => {
  const r = validateCompose({ subject: { kind: 'race', id: 'TX-SEN' }, designId: 'broadcast', tweet: 't', card: { stats: [{ label: 'Talarico', value: '61%' }] }, style: { palette: { bg: '#000000', fg: '#111111' }, size: 'square' } }, DESIGNS, { liveStats: () => [{ label: 'Talarico', value: '50.2%' }] });
  assert.equal(r.post, 'data');
  assert.deepEqual(r.texts.stats, [{ label: 'Talarico', value: '50.2%' }]);
  assert.deepEqual(r.flagged, ['stats.0']);
  assert.ok(contrastRatio(r.style.palette.fg, '#000000') >= 4.5);
  assert.deepEqual(r.style.size, { w: 1080, h: 1080 });
  const m = validateCompose({ kind: 'question', designId: 'broadcast', tweet: 'Which race are you watching? https://x.y', card: { title: 'Which race are *you* watching?', options: ['Senate', 'House'] }, style: { fontDisplay: 'Anton' } }, DESIGNS, { post: 'message' });
  assert.equal(m.post, 'message');
  assert.equal(m.subject.kind, 'question');
  assert.ok(['statement', 'poll'].includes(m.designId));
  assert.ok(m.fixes.includes('designId'));
  assert.equal(m.texts.options.length, 2);
  assert.ok(!m.tweet.includes('http'));
  const empty = validateCompose({}, DESIGNS, { post: 'message' });
  assert.equal(empty.subject.kind, 'message');
  assert.ok(empty.texts.title);
});

test('prompt ≤ 10k chars for every compose task; allowed-values list is compact', () => {
  assert.ok(STYLE_PROMPT.length < 900);
  for (const f of STYLE_FONTS) assert.ok(STYLE_PROMPT.includes(f));
  const designs = Array.from({ length: 80 }, (_, i) => ({ id: `design-${i}`, name: 'N'.repeat(40), kinds: ['race', 'message'], w: 1080, h: 1080 }));
  for (const task of COMPOSE_TASKS) {
    const m = buildComposeMessages({ prompt: 'p'.repeat(5000), designs, live: 'fact | y\n'.repeat(5000), refs: Array(60).fill('race:XX-SEN'), task, card: { title: 't'.repeat(5000) }, settings: { custom: 'v'.repeat(300) }, platforms: SOCIAL_PLATFORMS });
    assert.ok(promptChars(m) <= 10000, `${task}: ${promptChars(m)}`);
  }
});

function groq(contents, seen = []) {
  return async (url, init) => {
    if (!String(url).includes('groq.com')) return new Response('nope', { status: 404 });
    seen.push(JSON.parse(init.body));
    const c = contents[Math.min(seen.length - 1, contents.length - 1)];
    return new Response(JSON.stringify({ choices: [{ message: { content: c } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
const post = (body) => new Request('http://x/api/ai', { method: 'POST', body: JSON.stringify({ question: 'q', mode: 'compose', ...body }) });
const env = { GROQ: 'k', AI_RETRIEVAL: '0', AI_RATE_PER_MIN: '1000' };

test('handler: message / restyle / rewrite / social tasks (Groq mocked)', async () => {
  const seen = [];
  let r = await (await handleAi(post({ task: 'message', designs: DESIGNS, settings: { voice: 'punchy' } }), { ip: 'm1', env, fetchImpl: groq([JSON.stringify({ kind: 'thanks', designId: 'statement', tweet: 'Thank you!', card: { title: 'Thank *you*' }, style: { palette: { bg: '#ffffff', fg: '#fefefe' } } })], seen) })).json();
  assert.equal(r.result.post, 'message');
  assert.equal(r.result.texts.title, 'Thank *you*');
  assert.notEqual(r.result.style.palette.fg, '#fefefe');
  assert.match(seen[0].messages[0].content, /Punchy/);
  r = await (await handleAi(post({ task: 'restyle', card: { kind: 'race', title: 'x' } }), { ip: 'm2', env, fetchImpl: groq([JSON.stringify({ style: { texture: 'grain', cornerRadius: -5, fontDisplay: 'Nope' } })]) })).json();
  assert.deepEqual(r.result.style, { texture: 'grain', cornerRadius: 0 });
  assert.ok(r.result.fixes.includes('style.fontDisplay'));
  r = await (await handleAi(post({ task: 'rewrite', card: { kind: 'race', title: 'x', stats: [{ label: 'Talarico', value: '50.2%' }] } }), { ip: 'm3', env, fetchImpl: groq([JSON.stringify({ card: { title: 'Texas *tightens*', stats: [{ label: 'Talarico (D)', value: '55%' }] } })]) })).json();
  assert.deepEqual(r.result.texts.stats, [{ label: 'Talarico (D)', value: '50.2%' }]);
  assert.deepEqual(r.result.flagged, ['stats.0']);
  r = await (await handleAi(post({ task: 'social', platforms: ['x', 'tiktok', 'bogus'] }), { ip: 'm4', env, fetchImpl: groq([JSON.stringify({ bios: { x: 'b'.repeat(400), tiktok: 'Live results https://spam.example', youtube: 'not asked' }, handles: ['@Pol Tok!', 'PolTokLive', 'x'], names: ['PolTok'], pinned: 'Pinned', links: [{ label: 'Live', path: '/live' }, { label: 'Bad', path: 'javascript:alert(1)' }], style: { palette: { accent: '#ff0000' } } })]) })).json();
  assert.equal([...r.result.bios.x].length, SOCIAL_LIMITS.x.bio);
  assert.equal(r.result.bios.tiktok, 'Live results');
  assert.equal(r.result.bios.youtube, undefined);
  assert.deepEqual(r.result.handles, ['PolTok', 'PolTokLive']);
  assert.equal(r.result.links[1].path, '/');
});

test('validateSocial: every bio within its platform limit', () => {
  const bios = Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, '✓'.repeat(3000)]));
  const r = validateSocial({ bios }, SOCIAL_PLATFORMS);
  for (const p of SOCIAL_PLATFORMS) assert.ok([...r.bios[p]].length <= SOCIAL_LIMITS[p].bio, p);
});

test('social pack: real platform dimensions, safe zones inside the asset, unique files, README', () => {
  const dims = (p, id) => { const a = SOCIAL_PACK[p].assets.find((x) => x.id === id); return [a.w, a.h]; };
  assert.deepEqual(dims('x', 'avatar'), [400, 400]);
  assert.deepEqual(dims('x', 'header'), [1500, 500]);
  assert.deepEqual(dims('instagram', 'avatar'), [320, 320]);
  assert.deepEqual(dims('youtube', 'avatar'), [800, 800]);
  assert.deepEqual(dims('youtube', 'banner'), [2560, 1440]);
  assert.deepEqual(dims('facebook', 'cover'), [1640, 624]);
  assert.deepEqual(dims('facebook', 'cover-small'), [851, 315]);
  assert.deepEqual(dims('linkedin', 'banner'), [1584, 396]);
  assert.deepEqual(dims('discord', 'avatar'), [512, 512]);
  assert.deepEqual(dims('discord', 'banner'), [960, 540]);
  assert.deepEqual(dims('bluesky', 'banner'), [1500, 500]);
  assert.ok(!SOCIAL_PACK.threads.assets.some((a) => a.type === 'banner'));
  const yt = SOCIAL_PACK.youtube.assets.find((a) => a.id === 'banner').safe[0];
  assert.equal(Math.round(yt.w * 2560), 1546);
  assert.equal(Math.round(yt.h * 1440), 423);
  const all = packAssets(SOCIAL_PLATFORMS);
  assert.equal(new Set(all.map((a) => a.file)).size, all.length);
  for (const a of all) {
    assert.ok(a.w >= 200 && a.h >= 200 && a.w <= 4096 && a.h <= 4096, a.file);
    if (a.type === 'avatar') assert.equal(a.w, a.h, a.file);
    for (const r of [...(a.safe ?? []), ...(a.covers ?? [])]) assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001, a.file);
  }
  const md = packReadme(['x', 'youtube'], { bios: { x: 'Hello' }, handles: ['PolTok'] }, SOCIAL_LIMITS);
  assert.match(md, /x\/header-1500x500\.png/);
  assert.match(md, /Safe area 1546×423/);
  assert.match(md, /Bio \(5\/160 chars\)/);
});
