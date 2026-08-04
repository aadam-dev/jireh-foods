# Shift reporting, audit trail & notifications — assessment

**Status: proposal. Nothing built yet, awaiting go-ahead.**
Written 4 August 2026 after reading PrimeHub's register-session implementation.

---

## 1. What I read in PrimeHub

| File | What it does |
|---|---|
| `lib/pos/drawer-movements.ts` | Money in/out of the drawer mid-shift, each with a *reason* |
| `components/pos/shift/CloseShiftReconciliation.tsx` | Per-method close: opening + payments ± movements → expected vs counted |
| `lib/pos/shift-tender.ts` | Tender totals by method |
| `lib/pos/session-report.ts` + `session-report-html.ts` | Z-report: sales, lines, product movement, printable HTML |
| `lib/pos/shift-activity.ts` | Turns `activity_log` rows into a human-readable shift timeline |
| `components/pos/shell/POSTerminalHeader.tsx` | The header dropdown: print session, drawer movement, close shift |
| `lib/notifications/*` | SSE notifications via an in-memory emitter |

---

## 2. Worth taking — and why

### 2.1 Opening balances per tender, not just cash
Jireh opens a shift with a cash float only. MoMo is received into a wallet that
**already has a balance**, so "expected MoMo" is currently meaningless — we compare
sales against nothing.

PrimeHub treats each tender as its own column: `opening + payments ± movements = expected`.
That is the correct model and it is what makes the till figure trustworthy.

### 2.2 Drawer movements — the most valuable thing here
PrimeHub's own rationale, paraphrased: before drawer movements existed, the only way
money leaving the drawer reached the books was as a **closing variance**. Variance is
supposed to mean *"cash we cannot account for."* Real, explainable events were landing
there instead.

For Jireh the consequence is human rather than accounting: a cashier who paid the gas
man GH₵200 out of the drawer closes GH₵200 short and looks like a thief. **This is the
single biggest gap in the current shift design.**

Reasons that actually fit a restaurant — not PrimeHub's supplier/chart-of-accounts list:

| Reason | Direction |
|---|---|
| Market run / ingredient purchase | out |
| Gas, water, small expense | out |
| Owner took cash | out |
| Paid staff / advance | out |
| Change top-up (added float) | in |
| Cash → MoMo (deposited) | out of cash, in to MoMo |
| MoMo → cash (withdrew) | out of MoMo, in to cash |

Each posts to the existing `Expense` table where it is an expense, so the money is
explained **and** the cost lands in "Are we making money?" instead of vanishing.

### 2.3 Session report (Z-report) from a header dropdown
Exactly what was asked for. Reuses the existing 80mm `Receipt80mm` print path, so it
prints on the same thermal roll with no new hardware.

Contents: shift header (who, since when), per-tender expected/counted, sales list with
line items and modifiers, item movement (what sold and how many), payment mix, drawer
movements, and the totals a cashier needs to check the till mid-shift.

### 2.4 Shift timeline as the audit trail
PrimeHub's comment is the important part: *"The activity data has always been recorded;
it just wasn't shown anywhere."*

Jireh is in exactly that state — `AuditLog` (9 rows, 1 action type) and `OrderEvent`
(2 rows, 1 type) exist and are barely written to, and nothing renders either. The work
is **80% widening what we record and rendering it**, not building new plumbing.

### 2.5 Force a note on a material variance
PrimeHub blocks close until a variance above a threshold is explained. Cheap, and it is
what turns "GH₵40 short" into "GH₵40 short — paid the water man, forgot to log it."

---

## 3. Deliberately NOT copying

### 3.1 The SSE notification transport — this one matters
PrimeHub's emitter says plainly:

> *"Works because server actions and the SSE route handler run in the same Node.js
> process, so a module-level singleton is shared across both."*

**That assumption is false on Vercel.** Jireh runs on Vercel Functions, where instances
are isolated and recycled. A module-level singleton is not shared between the function
that emits and the function holding the stream, so notifications would silently never
arrive — the worst kind of failure, because it looks like it works in dev.

Long-lived SSE connections also bill as function time on Vercel, all day, per open tab.

**Recommendation: poll.** A `/api/notifications` endpoint polled every 45–60s, using the
same visibility-aware pattern already in the dashboard (skip when the tab is hidden,
refresh on return). For a two-till restaurant this is indistinguishable from real-time,
costs almost nothing, and cannot silently break. Upstash Redis pub/sub is the upgrade
path if it is ever genuinely needed — note the Upstash env vars are **not currently set**,
so rate limiting is also inactive today.

### 3.2 The chart-of-accounts mapping
PrimeHub maps every drawer reason to a GL account (2000, 6950…). It is a trading business
with double-entry books. Jireh has no general ledger. Take the *reasons*, write to
`Expense`, drop the account codes.

### 3.3 `bank` as a tender
Jireh's third tender is Bolt Food, which behaves differently — it is a platform payout,
not money in a drawer, and should never be "counted."

---

## 4. Where Jireh is already ahead — keep these

- **Modifiers with price snapshots.** PrimeHub has no equivalent.
- **86 board synced to the public website.** No equivalent.
- **Plate economics from recipes.** PrimeHub has cost, not per-plate margin.
- **Offline queue with idempotency keys.** Genuinely better than PrimeHub's flow.
- **`src/lib/money.ts` with 8 tests**, shared by client and server. PrimeHub rounds
  ad hoc at each call site. Do not regress this — all new totals go through it.
- **The denomination counter** is already built and working.

---

## 5. Proposed build

### Phase A — Shift tender model *(foundation; everything else depends on it)*
- `PosSession`: add `openingMomo`, keep `openingFloat`; add `expectedCash`/`expectedMomo`
  snapshots at close.
- New `DrawerMovement` table: session, direction, tender, amount, reason, note, actor,
  optional linked `Expense`.
- Open-shift screen asks for **cash in drawer** and **MoMo balance**.

### Phase B — Session report + header dropdown
- Dropdown at far right of the POS header: **Session report**, **Money in/out**,
  **Close shift**.
- Report screen: live figures, sales list, item movement, printable via existing 80mm path.

### Phase C — Better close dialogue
- Per-tender sections (cash / MoMo), each `opening + sales ± movements = expected`
  vs counted, with the difference named plainly.
- Denomination counter stays; movements listed inline so the difference is explainable.
- Note required above a threshold.

### Phase D — Audit trail
- Widen `AuditLog` / `OrderEvent` writes to cover: shift open/close, drawer movement,
  void, discount, price override, 86 toggle, menu and settings edits, staff changes.
- Render as a timeline on the shift record and on `/admin/activity`.

### Phase E — Notifications (polling)
- `Notification` table; bell in the admin header; `/admin/notifications` list.
- Events worth interrupting an owner for: shift closed with a material variance, shift
  left open past closing time, item 86'd, stock below par, order unpaid > N minutes,
  void over a threshold, payroll due.
- **Best practices applied:** only notify what is actionable; one row per event, deduped;
  digest rather than one-per-sale (a busy service must not spam); read state per user;
  never a notification the reader cannot act on.

---

## 6. Decisions — settled 4 August 2026

| Question | Decision | Consequence for the build |
|---|---|---|
| Bolt Food at close | **Reference only** | Only cash and MoMo get an expected-vs-counted line. Bolt shows as a figure for the shift; nobody is asked to count a payout they cannot see. |
| Variance forcing a note | **GH₵20** | `SHIFT_VARIANCE_NOTE_THRESHOLD = 20`. Below it the shift closes freely; at or above, the note field is required. |
| Who records drawer movements | **Any cashier** | The person who handed over the money logs it, in the moment. Restricting this to managers would mean it simply is not logged and the drawer goes short anyway. Every movement records its actor, so the trail stays intact without a gate. |
| Session report visibility | **Everything for their shift** | Sales total, tender breakdown and item movement are all visible to the cashier on duty. They are accountable for the till, so they get the full picture to check it against. Other shifts remain back-office only. |

### Still to confirm before building
- **Sequence.** Proposed: A → B → C (the till figure becomes trustworthy and printable),
  then D → E (audit trail, then notifications). A is a schema change and everything
  else depends on it.
- **Migration.** `openingMomo` needs a value for the shift that is currently open.
  Proposed: default `0` and flag it on the report as "not recorded at open" rather than
  silently implying the wallet was empty.
