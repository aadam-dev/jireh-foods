/* Money arithmetic for the register.
   ────────────────────────────────────────────────────────────────────────────
   Cedi amounts are stored as Decimal(10,2) but computed in JavaScript numbers,
   where 0.1 + 0.2 is 0.30000000000000004. Left unrounded that leaks into
   change owed, split-payment checks and drawer reconciliation — the places a
   cashier and a customer are standing face to face disagreeing about coins.

   Everything here rounds to whole pesewas at each step, the same way a till
   does. Use roundMoney on any value that will be shown, stored or compared. */

/** Round to whole pesewas (2dp), avoiding binary-float drift. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // Scale, round half-away-from-zero, unscale. The epsilon nudge keeps values
  // like 1.005 (stored as 1.00499999…) from rounding down.
  const scaled = value * 100;
  const rounded = Math.round(Math.abs(scaled) + Number.EPSILON * Math.abs(scaled)) * Math.sign(scaled);
  return rounded / 100;
}

/** Sum a list of money values, rounding once at the end. */
export function sumMoney(values: number[]): number {
  return roundMoney(values.reduce((s, v) => s + v, 0));
}

/**
 * Price one order line: (unit price + modifier deltas) × quantity.
 * Rounds the unit price before multiplying so the line total is always an
 * exact multiple of what the customer sees on the tile.
 */
export function lineTotal(unitPrice: number, quantity: number): number {
  return roundMoney(roundMoney(unitPrice) * quantity);
}

export interface OrderTotals {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
}

/**
 * The single definition of what an order costs. The register and the API both
 * call this, so the amount on the Charge button is always the amount charged —
 * previously the client showed the pre-tax figure while the server added tax,
 * which would have had cashiers collecting the wrong money the moment anyone
 * set a tax rate in Settings.
 */
export function computeOrderTotals({
  lines,
  discountAmount = 0,
  taxRate = 0,
}: {
  lines: { price: number; quantity: number }[];
  discountAmount?: number;
  taxRate?: number;
}): OrderTotals {
  const subtotal = sumMoney(lines.map(l => lineTotal(l.price, l.quantity)));
  // A discount can never exceed the bill.
  const discount = roundMoney(Math.min(Math.max(0, discountAmount), subtotal));
  const taxableAmount = roundMoney(subtotal - discount);
  const taxAmount = roundMoney(taxableAmount * taxRate);
  const total = roundMoney(taxableAmount + taxAmount);
  return { subtotal, discountAmount: discount, taxableAmount, taxAmount, total };
}

/** Change owed, never negative. */
export function changeDue(tendered: number, total: number): number {
  return roundMoney(Math.max(0, roundMoney(tendered) - roundMoney(total)));
}

/** Two money values are equal if they agree to the pesewa. */
export function moneyEquals(a: number, b: number): boolean {
  return Math.abs(roundMoney(a) - roundMoney(b)) < 0.005;
}
