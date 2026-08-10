/* Customer identity — deciding when two typed names are the same person.
 * ────────────────────────────────────────────────────────────────────────────
 * Names arrive from a touchscreen during a rush, so they arrive dirty:
 * trailing spaces, double spaces, random capitalisation. Matching them raw
 * gives you "Kwame", "kwame " and "KWAME" as three customers, and a
 * suggestion list that grows a duplicate every time someone is served.
 *
 * Phone is the real key when it is given. A name key is the fallback, and it
 * is deliberately loose — a cashier picking the wrong Kwame off a list is a
 * smaller problem than a list with four of them.
 */

/** Trim, collapse runs of inner whitespace, and drop zero-width junk. */
export function cleanName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/\s+/g, ' ');
}

/** The value stored for matching: cleaned, then case-folded. */
export function nameKey(raw: string | null | undefined): string {
  return cleanName(raw).toLowerCase();
}

/**
 * Digits only, so "024 123 4567", "0241234567" and "+233 24 123 4567" are one
 * customer. Ghanaian mobiles are written both ways constantly; the leading 0
 * and the +233 country code are the same number, so the national trunk form
 * is what gets stored.
 */
export function normalisePhone(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length > 9) digits = `0${digits.slice(3)}`;
  return digits;
}

/** A phone we are willing to treat as a unique key. */
export function isUsablePhone(raw: string | null | undefined): boolean {
  return normalisePhone(raw).length >= 9;
}

/** What to show when an order has no customer attached. */
export const WALK_IN_LABEL = 'Walk-in';

/**
 * Display name for an order. Never persisted — a walk-in is stored as null so
 * the literal cannot leak into the customer list or the suggestions.
 */
export function customerLabel(order: { customerName?: string | null }): string {
  return cleanName(order?.customerName) || WALK_IN_LABEL;
}
