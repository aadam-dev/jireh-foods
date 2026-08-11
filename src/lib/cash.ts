/* Drawer arithmetic — one definition, because three places need the answer.
 * ────────────────────────────────────────────────────────────────────────────
 * "How much cash should be in this drawer?" is computed by the register, by
 * the shift-close endpoint, and by the back-office shift report. Before this
 * file they each spelled it out inline as `openingFloat + cashRevenue`, which
 * agreed only because none of them accounted for money leaving the till.
 *
 * The moment a payout exists, three independent spellings become three
 * different numbers, and the cashier is told they are short while the owner's
 * report says they balanced. So the formula lives here and all three import
 * it — the same rule the modifier defaults follow.
 */
import { roundMoney, sumMoney } from './money';

export type CashDirection = 'IN' | 'OUT';

export interface CashMovementLike {
  direction: CashDirection;
  amount: unknown; // Prisma Decimal, string or number
}

export interface DrawerInputs {
  openingFloat: unknown;
  cashRevenue: unknown;
  /** Movements for this shift, in any order. */
  movements?: CashMovementLike[] | null;
}

export interface DrawerTotals {
  openingFloat: number;
  cashRevenue: number;
  cashIn: number;
  cashOut: number;
  /** What the drawer should hold: float + cash sales + paid in − paid out. */
  expected: number;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Split movements into the two running totals shown under the Cash row. */
export function tallyMovements(movements?: CashMovementLike[] | null) {
  const list = movements ?? [];
  return {
    cashIn: sumMoney(list.filter(m => m.direction === 'IN').map(m => num(m.amount))),
    cashOut: sumMoney(list.filter(m => m.direction === 'OUT').map(m => num(m.amount))),
  };
}

/**
 * The one true expected-in-drawer figure.
 *
 * Named for the phrase the copy bank mandates on screen ("Expected in
 * drawer"), so a reader can match the code to what the cashier is looking at.
 */
export function drawerTotals({ openingFloat, cashRevenue, movements }: DrawerInputs): DrawerTotals {
  const float = num(openingFloat);
  const sales = num(cashRevenue);
  const { cashIn, cashOut } = tallyMovements(movements);
  return {
    openingFloat: float,
    cashRevenue: sales,
    cashIn,
    cashOut,
    expected: roundMoney(float + sales + cashIn - cashOut),
  };
}

/** Convenience for callers that only want the figure. */
export function expectedInDrawer(inputs: DrawerInputs): number {
  return drawerTotals(inputs).expected;
}

/**
 * Counted minus expected. Positive is over, negative is short.
 * Returns null when nothing has been counted yet — the close screen shows
 * "Not counted yet" rather than a frightening red number the cashier caused
 * by simply opening the dialog.
 */
export function drawerDifference(counted: number | null | undefined, expected: number): number | null {
  if (counted === null || counted === undefined || !Number.isFinite(counted)) return null;
  return roundMoney(counted - expected);
}

/** Staff-facing wording for a difference. Never the word "variance". */
export function differenceLabel(diff: number | null, format: (n: number) => string): string {
  if (diff === null) return 'Not counted yet';
  if (Math.abs(diff) < 0.01) return 'Exact';
  return diff > 0 ? `Over by ${format(diff)}` : `Short by ${format(Math.abs(diff))}`;
}
