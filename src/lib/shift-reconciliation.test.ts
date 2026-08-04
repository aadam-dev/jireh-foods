/* Shift reconciliation checks — run with: npm run test:shift
 *
 * These matter because the number they produce is the one a cashier is held to
 * at the end of a shift. Getting it wrong accuses someone of theft.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reconcileTender, reconcileShift, describeDifference, VARIANCE_NOTE_THRESHOLD,
} from './shift-reconciliation';

test('expected = opening + sales', () => {
  const r = reconcileTender({ tender: 'CASH', opening: 200, sales: 850 });
  assert.equal(r.expected, 1050);
  assert.equal(r.difference, null); // nothing counted yet
});

test('money paid out of the drawer lowers what is expected', () => {
  // The whole point: a cashier who paid GH₵200 for gas must not close short.
  const r = reconcileTender({
    tender: 'CASH',
    opening: 200,
    sales: 850,
    movements: [{ tender: 'CASH', direction: 'OUT', amount: 200 }],
    counted: 850,
  });
  assert.equal(r.movedOut, 200);
  assert.equal(r.expected, 850);
  assert.equal(r.difference, 0);
  assert.equal(r.needsNote, false);
});

test('money added to the drawer raises what is expected', () => {
  const r = reconcileTender({
    tender: 'CASH', opening: 100, sales: 0,
    movements: [{ tender: 'CASH', direction: 'IN', amount: 50 }],
    counted: 150,
  });
  assert.equal(r.expected, 150);
  assert.equal(r.difference, 0);
});

test('a transfer moves value between tenders without inventing or losing any', () => {
  // Cash → MoMo is two rows sharing a group: cash OUT, MoMo IN.
  const movements = [
    { tender: 'CASH' as const, direction: 'OUT' as const, amount: 300 },
    { tender: 'MOMO' as const, direction: 'IN' as const, amount: 300 },
  ];
  const s = reconcileShift({
    openingCash: 500, openingMomo: 100,
    cashSales: 0, momoSales: 0,
    movements,
  });
  assert.equal(s.cash.expected, 200);
  assert.equal(s.momo.expected, 400);
  // Nothing created or destroyed.
  assert.equal(s.cash.expected + s.momo.expected, 600);
});

test('an unrecorded opening balance is flagged, not silently treated as zero', () => {
  const r = reconcileTender({ tender: 'MOMO', opening: null, sales: 400 });
  assert.equal(r.openingRecorded, false);
  assert.equal(r.opening, null);
  assert.equal(r.expected, 400); // arithmetic still works
  const s = reconcileShift({
    openingCash: 100, openingMomo: null, cashSales: 0, momoSales: 0,
  });
  assert.equal(s.hasUnrecordedOpening, true);
});

test('a difference at or above the threshold demands an explanation', () => {
  const under = reconcileTender({
    tender: 'CASH', opening: 0, sales: 100, counted: 100 - (VARIANCE_NOTE_THRESHOLD - 1),
  });
  assert.equal(under.needsNote, false);

  const at = reconcileTender({
    tender: 'CASH', opening: 0, sales: 100, counted: 100 - VARIANCE_NOTE_THRESHOLD,
  });
  assert.equal(at.needsNote, true);
  assert.equal(at.difference, -VARIANCE_NOTE_THRESHOLD);
});

test('Bolt is reported but never reconciled', () => {
  const s = reconcileShift({
    openingCash: 0, openingMomo: 0,
    cashSales: 100, momoSales: 50, boltSales: 75,
  });
  assert.equal(s.boltSales, 75);
  assert.equal(s.totalSales, 225);
  // Bolt must not leak into either counted tender.
  assert.equal(s.cash.expected, 100);
  assert.equal(s.momo.expected, 50);
});

test('pesewa amounts do not drift', () => {
  const r = reconcileTender({
    tender: 'CASH', opening: 0.1, sales: 0.2,
    movements: [{ tender: 'CASH', direction: 'IN', amount: 0.1 }],
    counted: 0.4,
  });
  assert.equal(r.expected, 0.4);
  assert.equal(r.difference, 0);
});

test('differences read as plain English, never as "variance"', () => {
  assert.equal(describeDifference(null), 'Not counted yet');
  assert.equal(describeDifference(0), 'Exact');
  assert.equal(describeDifference(-40), 'GH₵40.00 short');
  assert.equal(describeDifference(12.5), 'GH₵12.50 over');
});
