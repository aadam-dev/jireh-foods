/* Money arithmetic checks — run with: npm run test:money
 *
 * These exist because every failure here is one a cashier and a customer have
 * face to face: wrong change, a total that does not match the receipt, a split
 * payment the till refuses to accept. Uses node:assert and node:test so there
 * is no test framework to install or keep current.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  roundMoney, sumMoney, lineTotal, computeOrderTotals, changeDue, moneyEquals,
} from './money';

test('rounds away binary float drift', () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(-2.345), -2.35);
  assert.equal(roundMoney(Number.NaN), 0);
});

test('line totals are exact multiples of the shelf price', () => {
  assert.equal(lineTotal(19.99, 3), 59.97);
  assert.equal(lineTotal(0.1, 3), 0.3);
  assert.equal(sumMoney([0.1, 0.2, 0.3]), 0.6);
});

test('a bill with no levy totals to its subtotal', () => {
  const r = computeOrderTotals({ lines: [{ price: 55, quantity: 1 }, { price: 10, quantity: 2 }] });
  assert.deepEqual([r.subtotal, r.taxAmount, r.total], [75, 0, 75]);
});

test('levy is applied after the discount, not before', () => {
  const r = computeOrderTotals({ lines: [{ price: 40, quantity: 1 }], discountAmount: 5, taxRate: 0.15 });
  assert.deepEqual([r.taxableAmount, r.taxAmount, r.total], [35, 5.25, 40.25]);
});

test('a discount can never exceed the bill', () => {
  const r = computeOrderTotals({ lines: [{ price: 20, quantity: 1 }], discountAmount: 999 });
  assert.deepEqual([r.discountAmount, r.total], [20, 0]);
});

test('awkward repeating amounts still land on whole pesewas', () => {
  const r = computeOrderTotals({ lines: [{ price: 33.33, quantity: 3 }], taxRate: 0.075 });
  assert.deepEqual([r.subtotal, r.taxAmount, r.total], [99.99, 7.5, 107.49]);
});

test('change is exact and never negative', () => {
  assert.equal(changeDue(100, 84.99), 15.01);
  assert.equal(changeDue(50, 85), 0);
  assert.equal(changeDue(20, 19.9), 0.1);
});

test('money equality tolerates sub-pesewa noise only', () => {
  assert.equal(moneyEquals(0.1 + 0.2, 0.3), true);
  assert.equal(moneyEquals(10, 10.01), false);
});
