/* Drawer counting checks — run with: npm test */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GHS_DENOMINATIONS, denomLabel, denominationTotal, bumpDenomination,
} from './denominations';

test('an uncounted drawer totals zero', () => {
  assert.equal(denominationTotal({}), 0);
});

test('notes add up', () => {
  assert.equal(denominationTotal({ '200': 2, '50': 3, '10': 1 }), 560);
});

test('pesewa coins do not leak binary drift', () => {
  // 3 × 0.1 is 0.30000000000000004 in plain JS, and that would print on a
  // shift report as the counted total.
  assert.equal(denominationTotal({ '0.1': 3 }), 0.3);
  assert.equal(denominationTotal({ '0.5': 1, '0.2': 2, '0.1': 4 }), 1.3);
});

test('a full drawer of every denomination is exact', () => {
  const counts = Object.fromEntries(GHS_DENOMINATIONS.map(d => [String(d), 1]));
  // 200+100+50+20+10+5+2+1+0.50+0.20+0.10
  assert.equal(denominationTotal(counts), 388.8);
});

test('labels distinguish notes from coins', () => {
  assert.equal(denomLabel(200), 'GH₵200');
  assert.equal(denomLabel(1), 'GH₵1');
  assert.equal(denomLabel(0.5), '50p');
  assert.equal(denomLabel(0.1), '10p');
});

test('bumping never goes negative and clears the key at zero', () => {
  let c: Record<string, number> = {};
  c = bumpDenomination(c, 50, 1);
  assert.deepEqual(c, { '50': 1 });
  c = bumpDenomination(c, 50, 1);
  assert.deepEqual(c, { '50': 2 });
  c = bumpDenomination(c, 50, -2);
  assert.deepEqual(c, {}, 'a zeroed denomination should leave no key behind');
  c = bumpDenomination(c, 50, -1);
  assert.deepEqual(c, {}, 'cannot count minus one note');
});

test('bumping does not mutate the input', () => {
  const before = { '20': 1 };
  const after = bumpDenomination(before, '20' as unknown as number, 1);
  assert.deepEqual(before, { '20': 1 });
  assert.deepEqual(after, { '20': 2 });
});
