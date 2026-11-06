// node --test tests/ — Creative Director: concepts, critique (+ auto-fix), campaign (+ CSV/ICS),
// adapt (platform limits), hooks2 (ranked, grounded hashtags), brand memory, edit learning. Groq mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../shared/director.js';
import { contrastRatio } from '../shared/compose.js';
import { handleAi, buildDirectorMessages, promptChars } from '../server/ai.js';

const DESIGNS = [
  { id: 'broadcast', name: 'Broadcast', kinds: ['race', 'flip', 'stat', 'promo', 'balance'], w: 1200, h: 675 },
  { id: 'statement', name: 'Bold statement', kinds: ['message', 'thanks', 'question', 'statement'], w: 1080, h: 1080 },
];
const FACTS = 'TX-SEN | Talarico 50.2%, Paxton 48.1%, 80% in [AP via NYT]\nnews | Victorian Labor launches campaign in Melbourne [ABC]\nnews | Victorian Liberals target Melbourne seats [The Age]\nnews | Allan pledges transport [ABC]';
const env = { GROQ: 'k', AI_RETRIEVAL: '0', AI_RATE_PER_MIN: '1000' };
function groq(contents, seen = [], status = 200) {
  return async (url, init) => {
    seen.push(JSON.parse(init.body));
    if (status !== 200) return new Response('{}', { status, headers: { 'retry-after': '17' } });
    const c = contents[Math.min(seen.length - 1, contents.length - 1)];
    return new Response(JSON.stringify({ choices: [{ message: { content: c } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
const post = (body) => new Request('http://x/api/ai', { method: 'POST', body: JSON.stringify({ question: 'Victorian election week', mode: 'director', ...body }) });
const concept = (i, extra = {}) => ({ angle: `A${i}`, hook: 'Hook', family: 'broadcast', subject: { kind: 'race', id: 'TX-SEN' }, designId: 'broadcast', tweet: 'Texas is tight #TXSen', card: { title: 'Texas *tight*' }, style: { palette: { bg: '#000000', fg: '#ffffff' } }, altText: 'card', ...extra });

test('brand kit: sanitised, compact, learned prefs injected', () => {
  const b = D.sanitizeBrand({ name: 'X'.repeat(90), palette: ['#112233', 'red', '#ABCDEF'], fonts: ['oswald', 'Comic Sans'], logo: 'tr', donts: 'woke, slams', hashtags: ['vicvotes', '#AusPol'] });
  assert.equal(b.name.length, 40);
  assert.deepEqual(b.palette, ['#112233', '#abcdef']);
  assert.deepEqual(b.fonts, ['Oswald']);
  assert.deepEqual(b.hashtags, ['#vicvotes', '#AusPol']);
  const p = D.brandPrompt(b, [{ note: 'removes emoji' }, 'prefers shorter, tighter copy']);
  assert.ok(p.length <= 900);
  assert.match(p, /Never use: woke, slams/);
  assert.match(p, /removes emoji; prefers shorter/);
  assert.deepEqual(D.brandStyle(b).palette.bg, '#112233');
});

test('learn from edits: delta → preference notes, merged', () => {
  const n = D.editDelta('Huge night!!! 🎉 Texas Senate race is tightening dramatically #TX #Senate #Vote', 'Texas Senate is tightening.');
  for (const k of ['prefers shorter, tighter copy', 'removes emoji', 'no hashtags', 'avoids exclamation marks']) assert.ok(n.includes(k), k);
  assert.deepEqual(D.editDelta('same', 'same'), []);
  const m = D.mergePrefs([{ note: 'removes emoji', at: 1 }], ['removes emoji', 'x'], 5);
  assert.deepEqual(m.map((x) => x.note), ['removes emoji', 'x']);
});

test('newsTerms + groundedTags: no invented trends', () => {
  const t = D.newsTerms(FACTS);
  assert.equal(t[0].term, 'Melbourne');
  assert.equal(t[0].tag, '#Melbourne');
  assert.ok(t.every((x) => FACTS.includes(x.term)));
  assert.deepEqual(D.groundedTags(['#Melbourne', '#TrendingNow', 'AusPol', '#melbourne'], FACTS, ['#AusPol']), ['#Melbourne', '#AusPol']);
});

test('concepts: 4 distinct families, numbers checked, brand palette under AI style', () => {
  const raw = { concepts: [concept(0), concept(1, { hook: 'Talarico up 99 points' }), concept(2, { family: 'comic' }), concept(3, { subject: { kind: 'message', id: '' }, designId: 'statement', card: { title: 'Thank *you*' } }), concept(4)] };
  const c = D.validateConcepts(raw, { designs: DESIGNS, facts: FACTS, n: 4, brand: { palette: ['#123456', '#fefefe', '#ff9900'] } });
  assert.equal(c.length, 4);
  assert.equal(new Set(c.map((x) => x.family)).size, 4);
  assert.equal(c[1].hook, '');
  assert.ok(c[1].fixes.includes('hook.numbers'));
  assert.equal(c[3].post, 'message');
  assert.equal(c[0].style.palette.bg, '#000000');
  assert.equal(c[0].style.palette.accent, '#ff9900');
});

test('critique: clamps scores, deterministic guards, whitelisted fixes; applyFixes refines', () => {
  const cs = D.validateConcepts({ concepts: [concept(0, { style: { palette: { bg: '#777777', fg: '#888888' } } }), concept(1, { tweet: 'Talarico 77%' })] }, { designs: DESIGNS, facts: FACTS });
  const m = D.conceptMetrics(cs[1], FACTS);
  assert.deepEqual(m.unsupported, ['77']);
  const raw = { critiques: [
    { i: 0, scores: { hierarchy: 14, readability: 9, clarity: 7, brand: 6, factual: 9 }, fixes: [{ target: 'palette.bg', value: '#0B0B0B' }, { target: 'title', value: 'Texas *dead heat*' }, { target: 'subtitle', value: 'Up 12 points' }, { target: 'evil', value: 'x' }, { target: 'fontDisplay', value: 'anton' }] },
    { i: 1, scores: { factual: 10 } }, { i: 1 }, { i: 9 },
  ] };
  const cr = D.validateCritique(raw, { concepts: cs, facts: FACTS });
  assert.equal(cr.length, 2);
  assert.equal(cr[0].scores.hierarchy, 10);
  assert.equal(cr[1].scores.factual, 3);
  assert.deepEqual(cr[0].fixes.map((f) => f.target), ['palette.bg', 'title', 'fontDisplay']);
  const fixed = D.applyFixes(cs[0], cr[0].fixes, FACTS);
  assert.equal(fixed.texts.title, 'Texas *dead heat*');
  assert.equal(fixed.style.fontDisplay, 'Anton');
  assert.ok(contrastRatio(fixed.style.palette.fg, fixed.style.palette.bg) >= 4.5);
  assert.deepEqual(fixed.refined, ['palette.bg', 'title', 'fontDisplay']);
});

test('campaign: sorted, typed, polls have options, CSV + ICS exports', () => {
  const posts = Array.from({ length: 9 }, (_, i) => ({ date: `2026-11-${String(20 - i).padStart(2, '0')}`, time: i === 0 ? '25:99' : '09:15', type: ['data', 'poll', 'thread', 'countdown', 'message', 'bogus'][i % 6], tweet: `Post ${i}, "quoted"`, options: i % 6 === 1 ? ['Labor', 'Coalition', 'Greens'] : [], concept: { subject: { kind: 'promo', id: 'vic-countdown' }, designId: 'broadcast' }, altText: 'alt', notes: 'Post early' }));
  posts.push({ date: '2020-01-01', time: '10:00', type: 'poll', tweet: 'Old?' });
  const c = D.validateCampaign({ name: 'Vic week', posts }, { designs: DESIGNS, facts: FACTS, n: 10, today: '2026-11-06' });
  assert.equal(c.posts.length, 10);
  assert.ok(c.posts.every((p, i) => !i || (c.posts[i - 1].date + c.posts[i - 1].time) <= p.date + p.time));
  assert.ok(c.posts.every((p) => p.date >= '2026-11-06' && /^\d\d:\d\d$/.test(p.time)));
  assert.ok(c.posts.filter((p) => p.type === 'poll').every((p) => p.options.length >= 2));
  assert.ok(!c.posts.some((p) => p.type === 'bogus'));
  const csv = D.campaignCsv(c.posts, 'Australia/Melbourne');
  assert.match(csv.split('\r\n')[0], /^n,date,time,timezone/);
  assert.match(csv, /"Post 0, ""quoted"""/);
  const ics = D.campaignIcs(c.posts.map((p, i) => ({ ...p, at: Date.UTC(2026, 10, 10 + i, 0, 0) })), 'Vic; week', 0);
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 10);
  assert.match(ics, /DTSTART:20261110T000000Z/);
  assert.match(ics, /X-WR-CALNAME:Vic\\; week/);
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
});

test('adapt: per-platform limits, links stripped; hooks2 ranked + grounded', () => {
  const a = D.validateAdapt({ posts: { x: 'y'.repeat(400), linkedin: 'Pro https://x.y post', threads: '' }, hashtags: ['#Melbourne', '#Fake'] }, { platforms: ['x', 'linkedin', 'threads'], facts: FACTS });
  assert.ok([...a.posts.x].length <= 280);
  assert.equal(a.posts.linkedin, 'Pro  post');
  assert.ok(a.fixes.includes('posts.threads') && a.fixes.includes('posts.x.length'));
  assert.deepEqual(a.hashtags, ['#Melbourne']);
  const h = D.validateHooks2({ hooks: [{ text: 'B', score: 40 }, { text: 'A', score: 90 }, { text: 'Up 63 points', score: 99 }, 'C', 'D', 'E', 'F'] }, { facts: FACTS });
  assert.equal(h.hooks.length, 5);
  assert.equal(h.hooks[0].text, 'A');
  assert.ok(!h.hooks.some((x) => /63/.test(x.text)));
});

test('prompts stay ≤ 10k chars with brand + prefs + big live data', () => {
  for (const task of D.DIRECTOR_TASKS) {
    const msgs = buildDirectorMessages({ task, prompt: 'p'.repeat(2000), context: 'c'.repeat(9000), live: 'l'.repeat(20000), designs: Array.from({ length: 60 }, (_, i) => ({ id: `d${i}`, name: 'Design name here', kinds: ['race', 'promo'], w: 1, h: 1 })), brand: { name: 'PolTok', voice: 'v'.repeat(300), donts: Array(12).fill('word') }, prefs: Array(20).fill({ note: 'n'.repeat(120) }), settings: {}, n: 14, tz: 'Australia/Melbourne', platforms: D.ADAPT_PLATFORMS, tone: { playful: 80, casual: 20 } });
    assert.ok(promptChars(msgs) <= 10000, `${task}: ${promptChars(msgs)}`);
    assert.match(msgs[0].content, /Brand: PolTok/);
  }
});

test('handler: director tasks validate input, call Groq, 429 carries retryAfter', async () => {
  const seen = [];
  let r = await (await handleAi(post({ task: 'concepts', designs: DESIGNS, brand: { donts: ['slams'] }, prefs: [{ note: 'removes emoji' }] }), { ip: 'd1', env, fetchImpl: groq([JSON.stringify({ concepts: [concept(0), concept(1), concept(2), concept(3)] })], seen) })).json();
  assert.equal(r.task, 'concepts');
  assert.equal(r.result.concepts.length, 4);
  assert.match(seen[0].messages[0].content, /Never use: slams/);
  assert.match(seen[0].messages[0].content, /removes emoji/);
  r = await handleAi(post({ task: 'nope' }), { ip: 'd2', env, fetchImpl: groq(['{}']) });
  assert.equal(r.status, 400);
  r = await handleAi(post({ task: 'critique' }), { ip: 'd2', env, fetchImpl: groq(['{}']) });
  assert.equal(r.status, 400);
  r = await (await handleAi(post({ task: 'critique', concepts: [{ texts: { title: 'T' }, tweet: 't', style: { palette: { bg: '#000000', fg: '#111111' } } }] }), { ip: 'd3', env, fetchImpl: groq([JSON.stringify({ critiques: [{ i: 0, scores: { readability: 10 } }] })]) })).json();
  assert.equal(r.result.critiques[0].scores.readability, 4);
  r = await (await handleAi(post({ task: 'campaign', designs: DESIGNS, tz: 'Australia/Melbourne', n: 7 }), { ip: 'd4', env, fetchImpl: groq([JSON.stringify({ name: 'C', posts: Array.from({ length: 7 }, () => ({ date: '2099-01-01', time: '10:00', type: 'data', tweet: 'x' })) })], seen) })).json();
  assert.equal(r.result.posts.length, 7);
  assert.match(seen.at(-1).messages[0].content, /Australia\/Melbourne/);
  r = await (await handleAi(post({ task: 'adapt', platforms: ['x', 'bluesky'], tone: { playful: 90, casual: 10 } }), { ip: 'd5', env, fetchImpl: groq([JSON.stringify({ posts: { x: 'hi', bluesky: 'hello' } })], seen) })).json();
  assert.deepEqual(Object.keys(r.result.posts), ['x', 'bluesky']);
  assert.match(seen.at(-1).messages[0].content, /playful 90\/100/);
  // bad JSON → one retry → success
  const s2 = [];
  r = await (await handleAi(post({ task: 'hooks2' }), { ip: 'd6', env, fetchImpl: groq(['not json', JSON.stringify({ hooks: [{ text: 'Hook', score: 70 }] })], s2) })).json();
  assert.equal(s2.length, 2);
  assert.equal(r.result.hooks[0].text, 'Hook');
  r = await handleAi(post({ task: 'hooks2' }), { ip: 'd7', env, fetchImpl: groq([], [], 429) });
  assert.equal(r.status, 429);
  assert.equal((await r.json()).retryAfter, 17);
});
