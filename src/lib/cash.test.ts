/* Drawer arithmetic checks — run with: npm test
 *
 * A wrong number here accuses a cashier of being short when they are not, or
 * hides a real shortfall. Both are worse than a crash.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawerTotals, expectedInDrawer, drawerDifference, differenceLabel, tallyMovements,
} from './cash';

const fmt = (n: number) => `GH₵${n.toFixed(2)}`;

test('with no movements, expected is float plus cash sales', () => {
  assert.equal(expectedInDrawer({ openingFloat: 100, cashRevenue: 200 }), 300);
  assert.equal(expectedInDrawer({ openingFloat: 100, cashRevenue: 200, movements: [] }), 300);
  assert.equal(expectedInDrawer({ openingFloat: 100, cashRevenue: 200, movements: null }), 300);
});

test('a payout lowers what the drawer should hold', () => {
  // The case that motivated the feature: GH₵50 of gas bought from the till
  // must not read as GH₵50 missing at close.
  assert.equal(
    expectedInDrawer({ openingFloat: 100, cashRevenue: 200, movements: [{ direction: 'OUT', amount: 50 }] }),
    250,
  );
});

test('cash in and cash out both count, in either order', () => {
  const movements = [
    { direction: 'OUT' as const, amount: 50 },
    { direction: 'IN' as const, amount: 20 },
    { direction: 'OUT' as const, amount: 5.5 },
  ];
  const t = drawerTotals({ openingFloat: 100, cashRevenue: 200, movements });
  assert.equal(t.cashIn, 20);
  assert.equal(t.cashOut, 55.5);
  assert.equal(t.expected, 264.5);
});

test('Prisma Decimals arrive as strings and must still add up', () => {
  const t = drawerTotals({
    openingFloat: '100.00',
    cashRevenue: '200.00',
    movements: [{ direction: 'OUT', amount: '50.00' }],
  });
  assert.equal(t.expected, 250);
});

test('float drift never leaks into a money figure', () => {
  const t = drawerTotals({
    openingFloat: 0.1,
    cashRevenue: 0.2,
    movements: [{ direction: 'IN', amount: 0.3 }],
  });
  assert.equal(t.expected, 0.6);
});

test('nothing counted yet is not the same as counted zero', () => {
  // Counting zero is a real statement about an empty drawer; not having
  // counted is not, and must not render as a huge red shortfall.
  assert.equal(drawerDifference(null, 250), null);
  assert.equal(drawerDifference(undefined, 250), null);
  assert.equal(drawerDifference(0, 250), -250);
});

test('difference is counted minus expected', () => {
  assert.equal(drawerDifference(248, 250), -2);
  assert.equal(drawerDifference(252, 250), 2);
  assert.equal(drawerDifference(250, 250), 0);
});

test('wording is plain, and never says variance', () => {
  assert.equal(differenceLabel(null, fmt), 'Not counted yet');
  assert.equal(differenceLabel(0, fmt), 'Exact');
  assert.equal(differenceLabel(-2, fmt), 'Short by GH₵2.00');
  assert.equal(differenceLabel(2, fmt), 'Over by GH₵2.00');
  for (const d of [null, 0, -2, 2]) {
    assert.ok(!differenceLabel(d, fmt).toLowerCase().includes('variance'));
  }
});

test('sub-pesewa noise reads as Exact, not as a difference', () => {
  assert.equal(differenceLabel(drawerDifference(250.004, 250), fmt), 'Exact');
});

test('tallyMovements ignores an empty or missing list', () => {
  assert.deepEqual(tallyMovements([]), { cashIn: 0, cashOut: 0 });
  assert.deepEqual(tallyMovements(null), { cashIn: 0, cashOut: 0 });
});
