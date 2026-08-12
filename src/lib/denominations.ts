/* Ghanaian cash denominations and drawer counting.
 * ────────────────────────────────────────────────────────────────────────────
 * Counting a drawer by typing one total invites fat-finger errors and gives no
 * way to recheck. Counting the notes derives the total and stores the
 * breakdown with the shift, so a difference can be traced to the denomination
 * that was miscounted rather than argued about.
 *
 * Lives in lib rather than the register because two screens count a drawer:
 * the close dialog, and the mid-shift count from the register menu.
 */

/** GH₵ notes down to 10 pesewa coins, largest first — the order you stack. */
export const GHS_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

/** "GH₵50" for notes, "50p" for coins. */
export const denomLabel = (d: number) => (d >= 1 ? `GH₵${d}` : `${Math.round(d * 100)}p`);

/** Counts keyed by denomination as a string, e.g. { "50": 3, "0.5": 4 }. */
export type DenominationCounts = Record<string, number>;

export function denominationTotal(counts: DenominationCounts): number {
  const raw = Object.entries(counts).reduce((s, [d, q]) => s + Number(d) * Number(q), 0);
  // Pesewa coins are binary-unfriendly: 3 × 0.1 is 0.30000000000000004 without
  // this, which then prints on a shift report.
  return Math.round(raw * 100) / 100;
}

/** Add or remove one note, dropping the key entirely when it reaches zero. */
export function bumpDenomination(
  counts: DenominationCounts,
  denomination: number,
  delta: number,
): DenominationCounts {
  const key = String(denomination);
  const next = Math.max(0, (counts[key] ?? 0) + delta);
  const updated = { ...counts };
  if (next === 0) delete updated[key];
  else updated[key] = next;
  return updated;
}
