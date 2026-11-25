// Offline tests for shared/au/vic-live.js (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayload, parsePolls, parseVec, seatId } from '../shared/au/vic-live.js';

const TABLE = `intro
{| class="wikitable sortable"
|-
! Date
|-
| rowspan="2" |20-23 Nov
| rowspan="2" |[[Resolve (poll)|Resolve]]<ref>x</ref>
| rowspan="2" |The Age
| rowspan="2" |1,000
| rowspan="2" |20%
| rowspan="2" style="background:#B6CDFB;"|'''31%'''
| rowspan="2" |13%
| rowspan="2" |25%
| rowspan="2" |4%
| rowspan="2" |7%
|41%
! style="background:#B6CDFB" |59%
|{{n/a}}
|-
|{{n/a}}
! style="background:#B6CDFB" |66%
|34%
|-
| 28 Oct – 3 Nov
| Spectre
| Client
| 1,200
| 25%
| 30%
| 14%
| 22%
| 4%
| 5%
|-
| 10 Feb
| DemosAU
| Client
| 800
| 23%
| 29%
| 15%
| 21%
| 4%
| 8%
|}`;

test('parsePolls reads primaries, 2PP from header cells, and orders by date', () => {
  const rows = parsePolls(TABLE.replace('|}', '') + '\n' + Array(3).fill(`|-\n| 1 Jan\n| X\n| C\n| 500\n| 30%\n| 30%\n| 10%\n| 20%\n| 5%\n| 5%`).join('\n') + '\n|}');
  assert.equal(rows[0].firm, 'Resolve');
  assert.deepEqual([rows[0].ALP, rows[0].LNP, rows[0].GRN, rows[0].ONP], [20, 31, 13, 25]);
  assert.deepEqual(rows[0].tpp, { ALP: 41, LNP: 59 });
  const spectre = rows.find((r) => r.firm === 'Spectre');
  assert.equal(spectre.tpp, null);
  assert.equal(new Date(spectre.t).getUTCMonth(), 10, '"Oct – Nov" range ends in November, same year');
  assert.equal(new Date(spectre.t).getUTCFullYear(), 2026);
});

test('parseVec sums daily early votes', () => {
  const html = '<table><tr><td>Tuesday 17 November</td><td>6,412</td><td>191</td></tr><tr><td>Wednesday 18 November</td><td>212,339</td><td>12,190</td></tr></table><p>Last updated: 25 November 2026.</p>';
  const v = parseVec(html);
  assert.equal(v.days.length, 2);
  assert.equal(v.total, 218751);
  assert.equal(v.updated, '25 November 2026');
});

test('buildPayload projects a uniform swing on Labor-v-Coalition seats only', () => {
  const polls = [
    { date: 'a', firm: 'A', t: 3, ALP: 21, LNP: 31, GRN: 14, ONP: 23, tpp: { ALP: 43, LNP: 57 } },
    { date: 'b', firm: 'B', t: 2, ALP: 22, LNP: 32, GRN: 14, ONP: 22, tpp: { ALP: 43, LNP: 57 } },
  ];
  const pendulum = [
    { seat: 'Niddrie', win: 'ALP', vs: 'LNP', margin: 6.7 },
    { seat: 'Essendon', win: 'ALP', vs: 'LNP', margin: 12.5 },
    { seat: 'Melbourne', win: 'GRN', vs: 'ALP', margin: 2.0 },
    { seat: 'Kew', win: 'LNP', vs: 'ALP', margin: 4.0 },
  ];
  const d = buildPayload({ polls, pendulum, vec: null, now: 0 });
  assert.equal(d.projection.swing, 12);
  assert.equal(d.projection.seats['vic-niddrie'].projected, 'LNP');
  assert.equal(d.projection.seats['vic-essendon'].projected, 'ALP');
  assert.equal(d.projection.seats['vic-melbourne'].projected, 'GRN');
  assert.deepEqual(d.projection.after, { LNP: 2, ALP: 1, GRN: 1 });
  assert.equal(d.polls.average.ALP, 21.5);
  assert.equal(seatId('Narre Warren North'), 'vic-narre-warren-north');
});
