// node --test tests/  — Owner "Make with AI" compose mode: JSON parsing, validation, budget, Groq mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseComposeJson, validateCompose, cleanTweet, TWEET_MAX } from '../shared/compose.js';
import { handleAi, buildComposeMessages, promptChars, COMPOSE_BUDGET } from '../server/ai.js';

const DESIGNS = [
  { id: 'broadcast', name: 'Broadcast lower-third', kinds: ['race', 'flip', 'balance', 'au-seat', 'stat', 'promo'], w: 1200, h: 675 },
  { id: 'comic', name: 'Comic burst', kinds: ['flip', 'race', 'stat', 'promo'], w: 1080, h: 1080 },
  { id: 'hemicycle', name: 'Hemicycle', kinds: ['balance'], w: 1200, h: 675 },
  { id: 'aurora', name: 'Gradient aurora (story)', kinds: ['race', 'balance', 'au-seat', 'promo', 'stat', 'flip', 'quote'], w: 1080, h: 1920 },
];
const GOOD = { subject: { kind: 'race', id: 'TX-SEN' }, designId: 'comic', tweet: 'Texas Senate: Talarico leads 50.2% with 80% in. #TXSen', cardOverrides: { title: 'Texas shock', subtitle: 'Upset watch' }, altText: 'Comic card of the Texas Senate race' };

test('parseComposeJson: plain, fenced, prose-wrapped, nested braces in strings, garbage', () => {
  assert.deepEqual(parseComposeJson(JSON.stringify(GOOD)), GOOD);
  assert.deepEqual(parseComposeJson('```json\n' + JSON.stringify(GOOD) + '\n```'), GOOD);
  assert.deepEqual(parseComposeJson('Sure! Here: ' + JSON.stringify({ a: '}{ "x"', b: { c: 1 } }) + ' thanks {nope}'), { a: '}{ "x"', b: { c: 1 } });
  assert.equal(parseComposeJson('no json here'), null);
  assert.equal(parseComposeJson('{"broken": '), null);
  assert.equal(parseComposeJson('[1,2]'), null);
});

test('validateCompose: good input passes through', () => {
  const r = validateCompose(GOOD, DESIGNS);
  assert.deepEqual(r.subject, { kind: 'race', id: 'TX-SEN' });
  assert.equal(r.designId, 'comic');
  assert.equal(r.cardOverrides.title, 'Texas shock');
  assert.deepEqual(r.fixes, []);
});

test('validateCompose: unknown kind/id/design fall back; incompatible design replaced', () => {
  const r = validateCompose({ subject: { kind: 'senator', id: 'x' }, designId: 'nope', tweet: 'hi' }, DESIGNS);
  assert.equal(r.subject.kind, 'promo');
  assert.equal(r.subject.id, 'default');
  assert.ok(DESIGNS.find((d) => d.id === r.designId).kinds.includes('promo'));
  const h = validateCompose({ subject: { kind: 'au-seat', id: 'kooyong' }, designId: 'hemicycle', tweet: 'x' }, DESIGNS);
  assert.equal(h.designId, 'broadcast');
  assert.ok(h.fixes.includes('designId'));
  const v = validateCompose({ subject: { kind: 'race', id: 'ZZ-FAKE' }, designId: 'comic', tweet: 'x' }, DESIGNS, { validId: (k, id) => id === 'TX-SEN' });
  assert.equal(v.subject.id, '');
  assert.ok(v.fixes.includes('subject.id'));
  const bal = validateCompose({ subject: { kind: 'balance', id: '<script>' }, designId: 'hemicycle', tweet: 'x' }, DESIGNS);
  assert.equal(bal.subject.id, 'senate');
  assert.equal(validateCompose(null, DESIGNS).subject.kind, 'promo');
});

test('validateCompose: overrides with numbers rejected (numbers come from live data); tweet trimmed, links removed', () => {
  const r = validateCompose({ ...GOOD, cardOverrides: { title: 'Dems win 51 seats', subtitle: 'ok wording', footer: 'x'.repeat(200) } }, DESIGNS);
  assert.equal(r.cardOverrides.title, undefined);
  assert.equal(r.cardOverrides.subtitle, 'ok wording');
  assert.ok(r.cardOverrides.footer.length <= 60);
  assert.ok(r.fixes.includes('cardOverrides.title'));
  const t = cleanTweet('Look https://evil.example/x ' + 'a'.repeat(400));
  assert.ok(!t.includes('http'));
  assert.ok([...t].length <= TWEET_MAX);
  assert.equal(validateCompose({ ...GOOD, tweet: 42 }, DESIGNS).tweet, '');
});

const noLive = { senate: async () => null, house: async () => null, governor: async () => null };
function groqReturning(contents, seen = []) {
  return async (url, init) => {
    if (!String(url).includes('groq.com')) return new Response('nope', { status: 404 });
    const body = JSON.parse(init.body);
    seen.push(body);
    const c = contents[Math.min(seen.length - 1, contents.length - 1)];
    if (typeof c === 'number') return new Response(c === 400 ? '{"error":{"message":"response_format json_object not supported"}}' : 'err', { status: c });
    return new Response(JSON.stringify({ choices: [{ message: { content: c } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
const req = (extra = {}) => new Request('http://x/api/ai', { method: 'POST', body: JSON.stringify({ question: 'Post about the Texas Senate upset, comic style', mode: 'compose', designs: DESIGNS, temperature: 0.7, ...extra }) });

test('compose handler: non-streaming JSON, json_object mode, validated result', async () => {
  const seen = [];
  const res = await handleAi(req(), { ip: 'c1', env: { GROQ: 'k', AI_RETRIEVAL: '0' }, fetchImpl: groqReturning([JSON.stringify({ ...GOOD, designId: 'hemicycle' })], seen) });
  assert.equal(res.status, 200);
  const d = await res.json();
  assert.equal(d.ok, true);
  assert.equal(d.result.designId, 'broadcast'); // hemicycle can't show a race
  assert.equal(seen[0].stream, false);
  assert.deepEqual(seen[0].response_format, { type: 'json_object' });
  assert.equal(seen[0].temperature, 0.7);
  assert.ok(promptChars(seen[0].messages) <= COMPOSE_BUDGET.total);
});

test('compose handler: retries without response_format; parses prose-wrapped JSON', async () => {
  const seen = [];
  const res = await handleAi(req(), { ip: 'c2', env: { GROQ: 'k', AI_RETRIEVAL: '0' }, fetchImpl: groqReturning([400, 'Here you go: ' + JSON.stringify(GOOD)], seen) });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).result.subject.id, 'TX-SEN');
  assert.equal(seen.length, 2);
  assert.equal(seen[1].response_format, undefined);
});

test('compose handler: 413 → smaller retry; invalid output → bad_output; 429 → rate_limited; not configured', async () => {
  const seen = [];
  const ok = await handleAi(req(), { ip: 'c3', env: { GROQ: 'k', AI_RETRIEVAL: '0' }, fetchImpl: groqReturning([413, JSON.stringify(GOOD)], seen) });
  assert.equal(ok.status, 200);
  assert.equal(seen.length, 2);
  const bad = await handleAi(req(), { ip: 'c4', env: { GROQ: 'k', AI_RETRIEVAL: '0' }, fetchImpl: groqReturning(['I cannot do that']) });
  assert.equal(bad.status, 502);
  assert.equal((await bad.json()).code, 'bad_output');
  const busy = await handleAi(req(), { ip: 'c5', env: { GROQ: 'k', AI_RETRIEVAL: '0' }, fetchImpl: groqReturning([429]) });
  assert.equal(busy.status, 429);
  assert.equal((await busy.json()).code, 'rate_limited');
  const nc = await handleAi(req(), { ip: 'c6', env: {}, fetchImpl: groqReturning([]) });
  assert.equal((await nc.json()).code, 'not_configured');
});

test('compose prompt stays ≤ ~10k chars even with huge live data and many designs', () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ id: `design-${i}`, name: `Design number ${i}`, kinds: ['race', 'balance', 'au-seat', 'promo', 'stat', 'flip', 'quote'], w: 1080, h: 1080 }));
  const msgs = buildComposeMessages({ prompt: 'x'.repeat(2000), designs: many, live: 'fact | y\n'.repeat(5000), refs: Array.from({ length: 50 }, (_, i) => `race:R${i}`) });
  assert.ok(promptChars(msgs) <= COMPOSE_BUDGET.total, String(promptChars(msgs)));
  assert.match(msgs[0].content, /STRICT JSON/);
});
