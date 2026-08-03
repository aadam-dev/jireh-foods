/* Developer credit — defined once, used on the receipt, login and settings.
   ────────────────────────────────────────────────────────────────────────────
   Receipt-footer credits are advertising on someone else's paper, so they follow
   the rules that keep them from being a nuisance:
     · one line, never more — thermal paper costs the client money
     · sits last, below the client's own thank-you, so it never competes with
       their branding or gets mistaken for part of the transaction
     · smallest legible size, grey, below a divider
     · plain statement, no caps, no urgency, no fake scarcity
     · no QR code: it eats vertical paper and print time at the counter
   Set `enabled: false` to remove it from receipts entirely. */

export const DEVELOPER_CREDIT = {
  enabled: true,
  domain: 'aadambuilds.dev',
  url: 'https://aadambuilds.dev',
  /** One line, ≤48 chars — the width of an 80mm receipt at 8px. */
  receiptLine: 'Want a system like this? aadambuilds.dev',
  /** Screen-only, where there is room to say what it actually is. */
  tagline: 'Custom POS & back office systems',
} as const;
