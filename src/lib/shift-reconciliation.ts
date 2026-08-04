/* What should be in the drawer, and in the MoMo wallet, right now.
   ────────────────────────────────────────────────────────────────────────────
   One definition shared by the register, the session report and the close
   screen, so a cashier checking the till mid-shift and the figure they are held
   to at close can never disagree.

   Per tender:  opening + sales taken + money in − money out = expected

   Bolt Food is deliberately absent from this calculation. It is a platform
   payout, not money anyone can count, so it is reported but never reconciled —
   asking a cashier to "count" it would invent variances they cannot resolve. */

import { roundMoney, sumMoney } from './money';

export type DrawerTender = 'CASH' | 'MOMO';
export type DrawerDirection = 'IN' | 'OUT';

export interface MovementLike {
  tender: DrawerTender;
  direction: DrawerDirection;
  amount: number | string;
}

/** A difference this size or larger must be explained before the shift closes. */
export const VARIANCE_NOTE_THRESHOLD = 20;

export interface TenderReconciliation {
  tender: DrawerTender;
  /** Null when the balance was never recorded at open — not the same as zero. */
  opening: number | null;
  openingRecorded: boolean;
  sales: number;
  movedIn: number;
  movedOut: number;
  expected: number;
  counted: number | null;
  /** counted − expected. Null until a count is entered. */
  difference: number | null;
  /** True when the difference is big enough to require an explanation. */
  needsNote: boolean;
}

function net(movements: MovementLike[], tender: DrawerTender, direction: DrawerDirection) {
  return sumMoney(
    movements
      .filter(m => m.tender === tender && m.direction === direction)
      .map(m => Number(m.amount) || 0),
  );
}

export function reconcileTender({
  tender,
  opening,
  sales,
  movements = [],
  counted = null,
}: {
  tender: DrawerTender;
  opening: number | string | null | undefined;
  sales: number | string;
  movements?: MovementLike[];
  counted?: number | string | null;
}): TenderReconciliation {
  const openingRecorded = opening !== null && opening !== undefined && opening !== '';
  // An unrecorded opening balance is treated as 0 for arithmetic — but the flag
  // travels with it so the UI can say the figure is incomplete rather than wrong.
  const openingValue = openingRecorded ? roundMoney(Number(opening)) : 0;
  const salesValue = roundMoney(Number(sales) || 0);
  const movedIn = net(movements, tender, 'IN');
  const movedOut = net(movements, tender, 'OUT');
  const expected = roundMoney(openingValue + salesValue + movedIn - movedOut);

  const hasCount = counted !== null && counted !== undefined && counted !== '';
  const countedValue = hasCount ? roundMoney(Number(counted)) : null;
  const difference = countedValue === null ? null : roundMoney(countedValue - expected);

  return {
    tender,
    opening: openingRecorded ? openingValue : null,
    openingRecorded,
    sales: salesValue,
    movedIn,
    movedOut,
    expected,
    counted: countedValue,
    difference,
    needsNote: difference !== null && Math.abs(difference) >= VARIANCE_NOTE_THRESHOLD,
  };
}

export interface ShiftReconciliation {
  cash: TenderReconciliation;
  momo: TenderReconciliation;
  /** Reported only — a payout, never counted. */
  boltSales: number;
  /** Total taken across every tender, including Bolt. */
  totalSales: number;
  /** True when any counted tender is off by the threshold or more. */
  requiresNote: boolean;
  /** True when a balance was missing at open, so "expected" is incomplete. */
  hasUnrecordedOpening: boolean;
}

export function reconcileShift({
  openingCash,
  openingMomo,
  cashSales,
  momoSales,
  boltSales = 0,
  movements = [],
  countedCash = null,
  countedMomo = null,
}: {
  openingCash: number | string | null | undefined;
  openingMomo: number | string | null | undefined;
  cashSales: number | string;
  momoSales: number | string;
  boltSales?: number | string;
  movements?: MovementLike[];
  countedCash?: number | string | null;
  countedMomo?: number | string | null;
}): ShiftReconciliation {
  const cash = reconcileTender({
    tender: 'CASH', opening: openingCash, sales: cashSales, movements, counted: countedCash,
  });
  const momo = reconcileTender({
    tender: 'MOMO', opening: openingMomo, sales: momoSales, movements, counted: countedMomo,
  });
  const bolt = roundMoney(Number(boltSales) || 0);

  return {
    cash,
    momo,
    boltSales: bolt,
    totalSales: sumMoney([cash.sales, momo.sales, bolt]),
    requiresNote: cash.needsNote || momo.needsNote,
    hasUnrecordedOpening: !cash.openingRecorded || !momo.openingRecorded,
  };
}

/* ── Plain-language labels ────────────────────────────────────────────────── */

export const DRAWER_REASON_LABELS: Record<string, string> = {
  MARKET_RUN: 'Market run',
  EXPENSE: 'Expense',
  OWNER_DRAWING: 'Owner took cash',
  STAFF_PAYMENT: 'Paid staff',
  FLOAT_TOP_UP: 'Added change',
  CASH_TO_MOMO: 'Cash → MoMo',
  MOMO_TO_CASH: 'MoMo → cash',
  OTHER: 'Other',
};

/** "Exact", or how far out and in which direction — never the word "variance". */
export function describeDifference(difference: number | null): string {
  if (difference === null) return 'Not counted yet';
  if (Math.abs(difference) < 0.01) return 'Exact';
  const amount = Math.abs(difference).toFixed(2);
  return difference > 0 ? `GH₵${amount} over` : `GH₵${amount} short`;
}
