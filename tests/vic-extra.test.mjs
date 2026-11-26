import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExtra } from '../shared/au/vic-extra.js';

const page = `
==Leadership polling==
===Preferred premier===
====Carroll vs Wilson vs Pickering====
{| class="wikitable"
|-
! Date !! Firm !! Client !! Sample !! Carroll !! Wilson !! Pickering !! DK !! Net
|-
|20–23 Nov 2026
|[[Resolve Strategic|Resolve]]<ref>x</ref>
|The Age
|1,000
|23%
|style="background:#B6CDFB"|'''34%'''
|19%
|25%
! 11%
|}
===Leadership approval===
====Carroll vs Wilson vs Pickering====
{| class="wikitable"
|-
! Date
|-
|13 – 20 Nov 2026
|RedBridge
|N/A
|2,000
|20%||44%||36%||−24%||37%||29%||34%||+8%||21%||26%||53%||−5%
|}
== Electorate projections (MRP) ==
===Legislative Assembly===
{| class="wikitable"
|-
! Date
|-
|July 2026
| [[YouGov]]
| Common Threads
| MRP
| 4,003
| 29
| '''31'''
| 8
| 3
| 17
| 0
| Hung
|}
`;

test('parseExtra: preferred premier, approval and MRP (Liberal + National summed)', () => {
  const x = parseExtra(page);
  assert.deepEqual(x.preferred[0], { date: '20–23 Nov 2026', firm: 'Resolve', Carroll: 23, Wilson: 34, Pickering: 19, DK: 25 });
  assert.deepEqual(x.approval[0].Carroll, { pos: 20, neg: 44, net: -24 });
  assert.equal(x.approval[0].Wilson.net, 8);
  assert.equal(x.mrp[0].LNP, 39);
  assert.equal(x.mrp[0].ONP, 17);
});
