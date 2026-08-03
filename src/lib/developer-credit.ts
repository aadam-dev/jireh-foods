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
  phoneDisplay: '026 303 9818',
  /** E.164 for tel: and wa.me — Ghana +233, leading 0 dropped. */
  phoneE164: '+233263039818',
  whatsapp: 'https://wa.me/233263039818',
  /** Screen-only, where there is room to say what it actually is. */
  tagline: 'Custom POS & back office systems',
} as const;

/* Two lines is the ceiling on an 80mm roll: one to say what it is, one to say
   how to get it. Anything more is someone else's advertising on the client's
   paper. Kept ≤48 chars each, the usable width at 8px. */
export const RECEIPT_CREDIT_LINES = [
  'Want a system like this?',
  `${DEVELOPER_CREDIT.domain} · ${DEVELOPER_CREDIT.phoneDisplay}`,
] as const;
