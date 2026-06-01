# Jireh Natural Foods — Project Log (Internal Context Bank)

> Running record of progress, decisions, and system state. Newest entries at the top.
> Append a dated entry whenever something meaningful ships. This is the
> single source of truth for "what was done and why."
>
> Related docs: [`TESTING.md`](TESTING.md) · [`SYSTEM_ASSESSMENT.md`](SYSTEM_ASSESSMENT.md) · [`docs/STAFF_TRAINING.md`](docs/STAFF_TRAINING.md)

---

## System snapshot (current)

- **Stack:** Next.js 14.2 App Router · Prisma 6 + Supabase Postgres (`oflraijzxczmzbkshfpe`, eu-north-1) · NextAuth v5 (JWT) · `@ducanh2912/next-pwa`.
- **Hosting:** Vercel — `jirehnaturalfoods.vercel.app` (project `prj_rCeB3jJGtdfDwgwedwiQeVZL5HkP`, team `team_EZDRisZcxbsAM6Ifyo3zQ7pV`). Auto-deploys on push to `main`.
- **Surfaces:** `(admin)` back-office · `(pos)` register · `(auth)` login. Public marketing site at `/`.
- **Accounts (3):** OWNER `prince@jireh.com`, CASHIER `nii@jireh.com`, OWNER-demo `it@jireh.com`. Passwords were rotated 2026-06-01 and are held **outside the repo** (never commit them).
- **Inventory:** schema/BOM features built but **table is currently empty** — stock tracking goes live once items are entered.
- **Local verification:** headless Chrome via `puppeteer-core` (installed `--no-save`); run a production build on `PORT=3100` with `AUTH_TRUST_HOST=true AUTH_URL=http://localhost:3100`.

---

## 2026-06-01 — Live test pass, security fix, Odoo best practices

Full multi-credential walkthrough against a production build (headless Chrome). **17/17 functional checks + idempotency passed.**

**Bugs found & fixed**
- **Security (`ec7ea32`):** CASHIER/STAFF could load the `/admin` shell. Root cause — `auth.config.ts` (used by middleware) had no `session` callback, so `role` was undefined in the edge context and the role-gate never fired. Added edge-safe `jwt`/`session` callbacks. Verified: Nii now redirects `/admin → /pos`.
- **Settings/receipts (`3370713`):** seed wrote `restaurant_name`/`currency`; app reads `business_name`/`currency_symbol` → blank fields and **blank business name on printed receipts** (`'' ?? default` keeps the empty string). Fixed: DB back-filled with correct keys, POS receipt fetch switched to `||`, all three seed files aligned.

**Features (Odoo-inspired)**
- **Order idempotency (`df785b4`):** `Order.clientRef` unique key minted per attempt; re-posting the same ref returns the existing order. Closes the "duplicate order / double stock deduction" class of bug (Odoo report §8). DB migration applied. Verified: same `clientRef` twice → one order.
- **Oversold flag (`9680b9d`):** negative stock shows a red "Oversold" badge + header counter in Inventory. Allow-but-monitor (we deliberately do **not** block sales). Verified live with temporary test rows.

**Docs**
- `SYSTEM_ASSESSMENT.md` (`7d1e743`) — Jireh vs Odoo comparison + scalability roadmap. Conclusion: Jireh already matches/exceeds the Delish Odoo deployment on the points that caused real pain (lost/duplicated orders, printer-coupled reliability). Jireh prints via the browser dialog, so it never depends on an IoT bridge.

**Reference consulted:** Delish Odoo 19 implementation report (`~/Desktop/projects/delish-restaurant/odoo-setup`). Key lessons adopted: no-lost-orders discipline, idempotent sync, allow-but-monitor negative stock, one-session-per-shift.

---

## 2026-05-29 — POS polish, receipt redesign, split payments

- **Faster POS load (`ba95067`):** removed the session-fetch from the blocking gate — shift UI now renders as soon as auth resolves (~0.8s vs multi-second blank spinner); button shows "Checking shift…" until the session check returns. Also de-duplicated `fetchOrders`.
- **Settings redesign (`ba95067`):** status bar, per-section save, new fields (phone, address, receipt tagline), live receipt preview, tax-impact example.
- **Receipt redesign (`e93ea84`):** Odoo-inspired — logo, business name/tagline/address/phone header, large kitchen "call number" (last block of order #), per-item unit price when qty>1, clean Subtotal→Discount→Tax→Total ladder. **Kept** our advantage over Odoo: payment method + tendered + change; split legs itemised. Logo/phone/tagline now pulled from Settings.
- **Split payments (`1d41dcc`, `bf2554a`):** `SPLIT` enum + `splitPayments` JSONB; Cash/MoMo/Bolt legs with progress bar, "Fill remaining," per-leg refs; `calcRevenue()` attributes each leg to its method for reconciliation. Labels/badges/receipt updated everywhere.
- **Orders/MoMo/reconciliation (`bced0b6`):** fixed "Order failed: Unknown error" (Prisma Decimal → Zod `z.coerce.number()` + menu API `Number()` coercion + `safeParse`). MoMo got an amount numpad. Session close does per-method (Cash/MoMo/Bolt) expected-vs-actual with a discrepancy confirm. Default delivery type → TAKEAWAY. Total font made functional/large. Banku photo added.
- **POS item images + test plan (`6f0ee3b`):** menu cards show food photos; `TESTING.md` (20-section manual plan) added.

---

## 2026-05-28 — Foundations

- **PWA offline + auth hardening (`55f5b00`):** IndexedDB offline order queue, auto-sync on reconnect, visible offline/pending banner + "Sync now". Middleware defense-in-depth; CVE-2025-29927 header strip; optional Upstash rate limiting.
- **Mobile/tablet responsiveness + IT demo fast POS (`90f0025`).**

---

## Key decisions / conventions

- **Settings keys are canonical in `app/api/admin/settings/route.ts` `PUBLIC_KEYS`.** Seed files MUST match them (the 2026-06-01 bug was a mismatch). Never read settings with `??` against possibly-empty strings — use `||`.
- **Demo isolation:** `it@jireh.com` orders are `isDemo=true` — excluded from revenue, dashboard, inventory deduction. Safe for testing.
- **Idempotency:** every POS order carries a `clientRef`; the orders API dedupes on it.
- **Negative stock:** allowed (never block a sale) but flagged red as "Oversold."
- **Verification:** prefer headless Chrome (text-based selectors) for repeatable test runs; it's ~5–8× cheaper in tokens than vision-driven browser control and isn't permission-blocked.
- **Docs in `docs/` are gitignored** — force-add (`git add -f`) when they must be tracked (e.g. `STAFF_TRAINING.md`).

---

## Open items / roadmap

From `SYSTEM_ASSESSMENT.md`, for when staff grows past 2 (owner chose "ship as-is" for now):
- Employee PINs for fast POS attribution on shared tablets
- Auto-reorder drafts (items below reorder level → draft PO)
- Two-step waiter → cashier flow
- Multi-location (`Order.locationId` already reserved — no migration needed)

Immediate: **populate inventory** so BOM deduction + oversold flag become live.
