// node --test tests/ — Owner AI Studio modes: settings caps, per-mode parsing/validation, handler with Groq mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSettings, settingsPrompt, validateStudio, clampN, numbersIn, unsupportedNumbers, STUDIO_MODES, parseComposeJson } from '../shared/compose.js';
import { handleAi, buildStudioMessages, promptChars, STUDIO_BUDGET } from '../server/ai.js';

test('sanitizeSettings clamps and drops junk', () => {
  const s = sanitizeSettings({ voice: 'evil', custom: 'x'.repeat(999), audience: 'mars', emoji: 7, banned: 'a, b,' + 'c'.repeat(99), lang: 'vi', model: 'bad model!', temperature: 9 });
  assert.equal(s.voice, 'neutral');
  assert.equal(s.custom.length, 300);
  assert.equal(s.audience, 'global');
  assert.equal(s.emoji, 1);
  assert.deepEqual(s.banned.slice(0, 2), ['a', 'b']);
  assert.ok(s.banned[2].length <= 30);
  assert.equal(s.lang, 'vi');
  assert.equal(s.model, '');
  assert.equal(s.temperature, 1.2);
  assert.match(settingsPrompt(s), /Vietnamese/);
  assert.ok(settingsPrompt({ ...s, custom: 'y'.repeat(300), banned: Array(20).fill('w'.repeat(30)) }).length < 1600);
  assert.equal(clampN('thread', 50), 10);
  assert.equal(clampN('thread', 1), 3);
  assert.equal(clampN('variants', 'x'), 3);
});

test('thread', () => {
  const r = validateStudio('thread', { tweets: ['1/ a https://x.y', '2/ b', 3, { text: '3/ c' }], subject: { kind: 'race', id: 'TX-SEN' } });
  assert.deepEqual(r.tweets, ['1/ a', '2/ b', '3/ c']);
  assert.deepEqual(r.subject, { kind: 'race', id: 'TX-SEN' });
  assert.equal(validateStudio('thread', { tweets: ['only one'] }), null);
  assert.equal(validateStudio('thread', { tweets: Array(14).fill('t') }).tweets.length, 10);
});

test('calendar', () => {
  const r = validateStudio('calendar', { days: [{ date: '2026-11-06', theme: 'Count', posts: [{ idea: 'Uncalled races', tweet: 'x', subject: { kind: 'stat', id: 'calls' } }, { idea: 'y' }, { idea: 'z' }, { idea: 'dropped' }] }, { date: 'bad', posts: [] }] });
  assert.equal(r.days.length, 1);
  assert.equal(r.days[0].posts.length, 3);
  assert.deepEqual(r.days[0].posts[0].subject, { kind: 'stat', id: 'calls' });
  assert.equal(r.days[0].posts[1].subject, null);
  assert.ok(r.fixes.includes('days.length'));
  assert.equal(validateStudio('calendar', { days: 'no' }), null);
});

test('reply / hashtags / variants / hooks', () => {
  const rp = validateStudio('reply', { replies: [{ text: 'Not yet called.', tone: 'rude' }, 'Plain string'] }, { n: 3 });
  assert.equal(rp.replies[0].tone, 'factual');
  assert.equal(rp.replies[1].text, 'Plain string');
  const h = validateStudio('hashtags', { hashtags: ['Midterms2026', '#auspol', '#auspol', 'bad tag!', ''] });
  assert.deepEqual(h.hashtags, ['#Midterms2026', '#auspol', '#badtag']);
  const v = validateStudio('variants', { variants: [{ tweet: 'A', angle: 'data' }, 'B', {}] });
  assert.equal(v.variants.length, 2);
  const k = validateStudio('hooks', { hooks: ['One', 'One', 'Two'] });
  assert.deepEqual(k.hooks, ['One', 'Two']);
  assert.equal(validateStudio('hooks', {}), null);
});

test('explain / image-alt', () => {
  const e = validateStudio('explain', { post: 'GA-SEN explained', bullets: ['a', 'b', 'c', 'd', 'e', 'f'], subject: { kind: 'race', id: '<x>' } });
  assert.equal(e.bullets.length, 5);
  assert.equal(e.subject.id, '');
  assert.equal(validateStudio('explain', { bullets: [] }), null);
  assert.equal(validateStudio('image-alt', { alt: 'Card', caption: 'c' }).alt, 'Card');
  assert.equal(validateStudio('image-alt', {}), null);
});

test('factcheck flags numbers absent from retrieved facts', () => {
  assert.deepEqual(numbersIn('51.2% of 1,234 votes'), ['51.2', '1234']);
  const live = 'race:TX-SEN | Talarico 50.2% vs Paxton 48.1%, 80% in [AP via NYT]';
  assert.deepEqual(unsupportedNumbers('Talarico 52% with 80% in, 2026', live), ['52']);
  const r = validateStudio('factcheck', { verdict: 'ok', issues: [], corrected: 'Talarico 50.2% with 80% in' }, { live, draft: 'Talarico 52% with 80% in' });
  assert.equal(r.verdict, 'issues'); // deterministic guard overrides the model
  assert.deepEqual(r.mismatched, ['52']);
  assert.deepEqual(r.correctedUnverified, []);
  const bad = validateStudio('factcheck', { issues: [{ claim: '52%', problem: 'wrong', evidence: live }], corrected: 'Talarico 61%' }, { live, draft: 'Talarico 52%' });
  assert.deepEqual(bad.correctedUnverified, ['61']);
  assert.ok(bad.fixes.includes('corrected.numbers'));
});

test('prompt stays ≤ 10k chars for every mode', () => {
  for (const mode of STUDIO_MODES) {
    const m = buildStudioMessages({ mode, prompt: 'p'.repeat(5000), context: 'c'.repeat(9000), live: 'fact | y\n'.repeat(5000), refs: Array(60).fill('race:XX-SEN'), settings: { custom: 'v'.repeat(300), banned: Array(20).fill('w'.repeat(30)), lang: 'ar' }, n: 10 });
    assert.ok(promptChars(m) <= 10000, `${mode} ${promptChars(m)}`);
    assert.match(m[0].content, /STRICT JSON/);
  }
});

function groq(contents, seen = [], models = ['llama-3.3-70b-versatile', 'whisper-large-v3', 'openai/gpt-oss-120b']) {
  return async (url, init) => {
    if (String(url).endsWith('/models')) return Response.json({ data: models.map((id) => ({ id })) });
    const body = JSON.parse(init.body);
    seen.push(body);
    const c = contents[Math.min(seen.length - 1, contents.length - 1)];
    if (typeof c === 'number') return new Response('err', { status: c, headers: c === 429 ? { 'retry-after': '17' } : {} });
    return Response.json({ choices: [{ message: { content: c } }] });
  };
}
const env = { GROQ: 'k', AI_RETRIEVAL: '0' };
const post = (b) => new Request('http://x/api/ai', { method: 'POST', body: JSON.stringify(b) });

test('handler: every mode returns validated JSON with mocked Groq', async () => {
  const OUT = {
    thread: { tweets: ['1/ a', '2/ b', '3/ c'] }, calendar: { days: [{ date: '2026-11-06', posts: [{ idea: 'x' }] }] }, reply: { replies: ['r'] }, hashtags: { hashtags: ['a'] },
    variants: { variants: ['v'] }, hooks: { hooks: ['h'] }, explain: { post: 'p' }, factcheck: { verdict: 'ok', corrected: 'fine' }, 'image-alt': { alt: 'a' },
  };
  let i = 0;
  for (const mode of STUDIO_MODES) {
    const seen = [];
    const res = await handleAi(post({ question: 'Texas Senate', mode, n: 4, context: 'ctx', settings: { voice: 'punchy', temperature: 0.9, model: 'openai/gpt-oss-120b' } }), { ip: `s${i++}`, env, fetchImpl: groq(['Here: ' + JSON.stringify(OUT[mode])], seen) });
    assert.equal(res.status, 200, mode);
    const d = await res.json();
    assert.equal(d.mode, mode);
    assert.ok(d.result, mode);
    assert.equal(seen[0].model, 'openai/gpt-oss-120b');
    assert.equal(seen[0].temperature, mode === 'factcheck' ? 0.1 : 0.9);
    assert.ok(parseComposeJson(JSON.stringify(d.result)));
  }
});

test('handler: unknown model ignored; 429 carries retryAfter; bad output → 502; GET models', async () => {
  const seen = [];
  await handleAi(post({ question: 'x', mode: 'hooks', settings: { model: 'not-a-real-model' } }), { ip: 'm1', env, fetchImpl: groq([JSON.stringify({ hooks: ['a'] })], seen) });
  assert.notEqual(seen[0].model, 'not-a-real-model');
  const busy = await handleAi(post({ question: 'x', mode: 'hooks' }), { ip: 'm2', env, fetchImpl: groq([429]) });
  assert.equal(busy.status, 429);
  const b = await busy.json();
  assert.equal(b.code, 'rate_limited');
  assert.equal(b.retryAfter, 17);
  const bad = await handleAi(post({ question: 'x', mode: 'thread' }), { ip: 'm3', env, fetchImpl: groq(['{"tweets":[]}']) });
  assert.equal((await bad.json()).code, 'bad_output');
  const g = await (await handleAi(new Request('http://x/api/ai?models=1'), { env, fetchImpl: groq([]) })).json();
  assert.ok(g.models.includes('llama-3.3-70b-versatile'));
  assert.ok(!g.models.includes('whisper-large-v3'));
  assert.equal(g.models[0], 'openai/gpt-oss-120b');
});
