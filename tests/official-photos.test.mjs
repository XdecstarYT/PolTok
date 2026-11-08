// Checks the official-headshot index written by scripts/gen-official-photos.mts: every record points at a local webp
// that exists, carries a source page and a credit, and the takedown blocklist uses the same slug format.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../src/data/photos/official.ts', import.meta.url), 'utf8');
const OFFICIAL = JSON.parse(src.match(/OFFICIAL: Record<string, OfficialRec> = (\{[\s\S]*\});/)[1]);

test('every official photo is local, sourced and credited', () => {
  for (const [k, r] of Object.entries(OFFICIAL)) {
    assert.match(k, /^(au|nz|us|us26):[a-z -]+$|^qid:Q\d+$/, k);
    assert.match(r.p, /^\/portraits\/(au|nz|us|world)\/[a-z0-9-]+\.webp$/, k);
    assert.ok(fs.existsSync(new URL(`../public${r.p}`, import.meta.url)), `missing file ${r.p}`);
    assert.ok(fs.statSync(new URL(`../public${r.p}`, import.meta.url)).size < 40_000, `${r.p} too large`);
    assert.match(r.s, /^https:\/\//, k);
    assert.match(r.c, /^Photo: /, k);
  }
});

test('blocklist slugs use the <group>/<slug> format', () => {
  const bl = fs.readFileSync(new URL('../src/data/photos/blocklist.ts', import.meta.url), 'utf8');
  const list = JSON.parse(bl.match(/PHOTO_BLOCKLIST: readonly string\[\] = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  for (const s of list) assert.match(s, /^(au|nz|us|world)\/[a-z0-9-]+$/);
});
