# Jireh Natural Foods — System Assessment & Scalability Roadmap

> Prepared June 2026 after a live, end-to-end test pass and a best-practices
> comparison against a production **Odoo 19** restaurant deployment (Delish, Accra).
> Context: Jireh is an early-stage startup — **2 operational staff + 1 IT/owner today**,
> built to scale.

---

## 1. Live test results (this pass)

Driven through a real browser against a **production build**, using all three seeded accounts.

| Account | Role | Result |
|---|---|---|
| `prince@jireh.com` | OWNER | ✅ Full admin: dashboard, orders, menu, inventory, reports, staff, customers |
| `nii@jireh.com` | CASHIER | ✅ Lands on POS; **correctly blocked from /admin** (redirected to /pos) |
| `it@jireh.com` | OWNER (demo) | ✅ Bypasses shift gate, DEMO badge, full order flow — isolated from real sales |

**17/17 functional checks passed**, plus:
- Cash order: 2 items → GH₵80, tendered GH₵100 → **change GH₵20** computed correctly
- Idempotency: same order submitted twice → **one order** (no duplicate)
- Admin → POS load: **~0.8s** (was a multi-second blank spinner before this round)

### Bugs found & fixed during testing
1. **Security:** CASHIER/STAFF could load the `/admin` shell — the edge auth config
   didn't surface `role`, so the middleware role-gate never fired. **Fixed.**
2. **Settings/receipts:** seed used `restaurant_name`/`currency`; app reads
   `business_name`/`currency_symbol` → blank fields and **blank business name on
   printed receipts**. **Fixed** (DB back-filled + `||` fallback + seed files aligned).

---

## 2. Best-practice comparison vs Odoo

Lessons drawn from the Delish Odoo implementation report (esp. its hard-won
"lost orders" and stock-drift sections).

| Capability | Odoo (Delish) | Jireh | Notes |
|---|---|---|---|
| POS + categories + prices | ✅ | ✅ | Menu mirrors the public site |
| Recipes / BOMs deduct stock on sale | ✅ (phantom BoM) | ✅ | `Bom`/`BomLine`; deduction + `USAGE` txn inside one DB transaction |
| Pack→unit purchasing (UoM) | ✅ (crate=12, etc.) | ✅ | `purchaseUnit` + `conversionFactor` per item |
| Per-item reorder/low-stock level | ✅ | ✅ | `lowStockThreshold` per item (not just global) |
| Stock valuation | ✅ | ✅ | Dashboard "Stock Value" from `costPerUnit × qty` |
| Payment methods | Cash/Card/MoMo/Account | Cash/MoMo/Bolt/Card/Bank/**Split** | Jireh is broader incl. split payments |
| Shift/session + cash reconciliation | ✅ | ✅ | Per-method expected-vs-actual + discrepancy alert |
| **Offline orders never lost** | ⚠️ weak (main pain point) | ✅ **stronger** | IndexedDB queue, auto-sync, visible banner + "Sync now" |
| **Idempotent orders (no duplicates)** | ⚠️ a known failure mode | ✅ **new** | `clientRef` unique key — safe under re-sync/double-tap |
| Role-based access | ✅ | ✅ | Owner/Manager/Accountant/Cashier/Staff + IT demo |
| Void/refund with audit | ✅ | ✅ | Owner/Manager only, reason required, audit-logged |
| Audit log | ✅ | ✅ | Create/update/void, user + IP |

**Takeaway:** Jireh already meets or exceeds the Odoo deployment on the points
that actually caused Delish operational pain — **lost/duplicated orders** and
**printer-coupled reliability** (Jireh prints via the browser dialog, so it never
depends on a separate IoT bridge).

---

## 3. Odoo lessons explicitly adopted

1. **No lost orders** (Odoo report §8) — offline queue already existed; this round
   added an **idempotency key** so re-sync/double-tap can't create duplicates or
   double-deduct stock (the exact failure Delish hit).
2. **Daily sync discipline** — Jireh surfaces a visible offline/pending banner so
   staff *see* unsynced orders (Odoo's were easy to miss). Reflected in training.
3. **One session per shift** — enforced: only one OPEN session at a time.

---

## 4. Scalability roadmap (prioritized for a 2 → N employee startup)

### Now (correctness / low effort) — DONE this round
- ✅ Edge role-gate fix (security)
- ✅ Order idempotency (no duplicates)
- ✅ Settings/receipt key alignment

### Next (when you add your 3rd–5th staff member)
| Priority | Item | Why it matters at scale |
|---|---|---|
| High | **Negative-stock visibility** | BOM deduction currently allows stock to go negative silently (Odoo's exact drift problem). Add a red "oversold/negative" flag in Inventory + dashboard. *We deliberately do **not** block the sale* — refusing a paying customer over a possibly-stale count is worse; Odoo's approach is allow-but-monitor. |
| High | **Employee PINs for POS** | With shared tablets, per-user email/password login is slow at the counter. A 4-digit PIN per staff (on top of the device login) speeds order attribution and scales to many waiters. |
| Medium | **Two-step waiter → cashier flow** | Odoo's model: waiters submit orders, a cashier takes payment. Worth it once you have floor staff separate from the till. Schema already supports `staffId` per order. |
| Medium | **Per-item supplier + auto-reorder suggestions** | `supplier` + `lowStockThreshold` exist; add a "items below reorder level → draft PO" action to cut manual purchasing work. |
| Low | **Multi-location** | `Order.locationId` is already reserved in the schema — no migration needed when a 2nd branch opens. |

### Foundational strengths already in place (no action needed)
- Stateless JWT auth + middleware defense-in-depth
- DB indexes on the hot query paths (orders by date/session/staff/status)
- Rate limiting hooks (activate by setting Upstash env vars)
- PWA/offline + idempotent sync
- Audit logging for sensitive actions

---

## 5. One operational recommendation

Mirror Odoo's best operational habit: **close the shift only when there are no
pending/syncing orders**, and do a quick **end-of-day per-method reconciliation**
(already built into the close flow). That single discipline is what keeps the
numbers trustworthy as the team grows.

---

*Assessment based on direct code/schema review and a live production-build test
pass. See `TESTING.md` for the full manual test plan and `docs/STAFF_TRAINING.md`
for staff procedures.*
