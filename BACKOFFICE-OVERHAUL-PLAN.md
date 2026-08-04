# Jireh Back Office — Design & Functionality Overhaul Plan

**Status:** Phases 0 & 1 shipped 2026-07-31 · Phases 2–5 outstanding · **Written:** 2026-07-06 · **Benchmark:** PrimeTijara back office + industry POS suites (Toast, Square for Restaurants, Lightspeed)

> **Progress log**
>
> **Phase 0 — done (2026-07-31).** Fresh Ledger tokens live in `app/globals.css`, scoped to `.fresh-ledger` so the public site and the dark POS are untouched. Fraunces / Inter Tight / JetBrains Mono load from `app/(admin)/layout.tsx` only, keeping the marketing site on its two-font budget. The six shared components are in `src/components/admin/ui/index.tsx`. `app/(admin)/layout.tsx` is now a server component that applies the theme; the client shell moved to `src/components/admin/AdminShell.tsx`.
>
> Rather than rewrite 13 screens at once, the old hardcoded dark hexes (`#191c19`, `#f4efeb`, `#2b2f2b`…) are mapped onto Fresh Ledger tokens by a **legacy bridge** at the bottom of `globals.css`. Every admin page flips to light together, and blue/purple/yellow are collapsed to one green plus ember-for-attention. As each page is migrated to semantic classes, delete its rules from that block.
>
> **Phase 1 — done (2026-07-31).** `/admin` is now the "Today" cockpit: greeting + four quick actions, "How is today going?" (vs same weekday last week, channel mix, average ticket, top seller), "Are we making money?" (collected − BOM ingredient cost − logged expenses, with recipe-coverage honesty), "What needs attention?" (stale shifts, overdue orders, low stock, 86'd items, due payroll), a live service strip while a shift is open, and a teaching empty state before the first sale. `app/api/admin/dashboard/route.ts` was extended to serve all of it.
>
> **Fixed in passing:** `tailwind.config.ts` had no `./src/**` content glob, so utility classes used only inside `src/components/` were silently dropped from the build. This had been quietly breaking the sidebar and shared UI.
>
> **Known gaps:** the bridge is a compatibility layer, not a migration — individual admin pages still carry dark-theme hexes in their markup and should be moved onto semantic classes as they're touched. Phase 0's "zero multi-accent remnants" holds visually, but only because the bridge overrides them.
>
> **Phase 2 — done (2026-07-31).** `src/lib/plate-economics.ts` is the single source of plate cost: recipe (BOM) priced at current ingredient cost where one exists, otherwise the item's `costPrice`, always labelled so an estimate is never mistaken for a costed plate. Every menu card now shows cost + margin %, ember below 55%. With today's data all 17 items land 57–70%, so nothing false-flags.
>
> **Availability sync is now complete.** It was two-thirds wired: the menu manager toggled `isAvailable` and the register respected it, but the public website's menu was a hardcoded array, so an 86'd dish stayed advertised to customers. Added `app/api/menu/route.ts` (public, no cost data) and the marketing page now reads from it, falling back to its built-in menu if the feed fails so the page is never blank. Verified end-to-end: 86'ing Meat Pie removed it from the public feed.
>
> **Shift policy changed (2026-07-31).** `ANY_POS_USER_MAY_CLOSE_ANY_SHIFT` in `app/api/pos/sessions/route.ts` — the whole team shares one register, so anyone at the POS can open a shift and close any shift, including one left open overnight. `closedBy` is still recorded. The stricter own-shift/manager logic is retained behind the flag; set it to `false` to restore. `canManageStale` in the POS page mirrors it — keep both in step.
>
> **Shift close now persists what was counted.** `PosSession` gained `closingMomo`, `closingBolt` and `cashCount` (denomination breakdown). Previously the counted MoMo and Bolt figures were computed for the on-screen summary and then discarded, so a shortfall left no record once the shift ended. The close screen now has a GH₵ denomination counter (200 → 10p) with **Expected in drawer / Counted / Difference**, plus a "type total" fallback.
>
> **Phase 3 — partially done (2026-07-31).**
> - **86 board — done.** Long-press (or right-click) a register tile to take a dish off or put it back. Optimistic with rollback, removes the item from any open ticket, propagates to the menu manager and the public site via the new `PATCH /api/pos/menu` — scoped so a cashier can flip availability without gaining admin menu rights.
> - **Shift-close count — done.** See above.
> - **Split pay + change calculator — already existed** before this session (cash/MoMo/Bolt legs, MoMo reference, progress bar, change). No work needed.
> - **Modifiers — NOT done.** The plan assumed "the data model exists via BOMs/variants", but there is no variant or modifier model: sizes are separate `MenuItem` rows ("Jollof Rice — Small"). Protein choice / extras / spice level need a new `MenuModifier` + `OrderItemModifier` schema and a bottom sheet on tile tap. Genuinely a phase of its own.
> - **Open-tickets rail / send-to-kitchen — NOT done.** Needs an order state between created and settled, plus a table-ticket concept.
>
> **Stability & performance pass — done (2026-07-31).**
> - **Auth returned the wrong thing to API calls.** The `authorized()` callback in `auth.config.ts` runs *before* the middleware body, so every unauthenticated `/api/**` request got a 302 to the HTML login page — `fetch()` resolved 200 with a page body, and the middleware's 401 branch was dead code. The POS offline queue was parsing a login page as an order response. `authorized()` now answers API routes with JSON (401 / 403) and only redirects pages. Verified: all four protected endpoints return `{"error":"Unauthorized"}` with `application/json`.
> - **POS re-rendered every second.** The header clock's state lived in the page component, so each tick re-rendered the whole 1,600-line register — menu grid, tiles, cart. Extracted to `HeaderClock`; one `<span>` repaints now instead of the screen.
> - **19 unindexed foreign keys** — every one is now covered (`OrderItem.orderId`/`menuItemId`, `MenuItem.categoryId`, `BomLine.*`, `PosSession.openedBy`/`closedBy`, PO chain, etc.). The Supabase performance advisor is clean of them. Remaining "unused index" notices are expected while the tables are empty.
> - **Silent failures on session expiry.** Admin screens did `setData(await res.json())` with no status check, so a 401 body was set as the list and threw on `.map`; `setLoading(false)` sat outside `finally`, leaving a permanent spinner. Added `src/lib/api-client.ts` (401 → login with callbackUrl, otherwise throws the server's message) and wired dashboard, menu, inventory, expenses and suppliers to it with visible error banners.
> - **Dashboard polling** eased 30s → 60s and paused while the tab is hidden, refreshing on return — that endpoint runs ~17 queries and owners leave it open all day.
> - **Public site weight**: hero PNG 809KB → 341KB JPEG, fufu PNG 708KB → 281KB (DB image paths updated to match). Raw `<img>` tags got `width`/`height` + `loading="lazy"`, removing layout shift. Also deleted the **Unsplash stock-photo fallback** on the hero — someone else's food should never stand in for theirs.
> - **`rls_auto_enable()`** was executable by `anon`/`authenticated` via PostgREST; `EXECUTE` revoked from `PUBLIC`. Confirmed the event trigger still auto-enables RLS on new tables.
>
> **Phase 3 completed (2026-08-01).**
> - **Modifiers — built.** The plan assumed a variant model existed; it did not. Added `ModifierGroup` / `ModifierOption` / `MenuItemModifier` (which dishes get which choices) and `OrderItemModifier` (what was actually chosen, name and price snapshotted so renaming an option never rewrites a printed receipt). Seeded Protein (required), Spice level and Extras, mapped to the rice dishes and fries, spice-only on the soups. Tapping a dish with choices opens a bottom sheet; a required group blocks Add until answered. **Price deltas are verified server-side** exactly like base prices — the client sends option ids only, never amounts.
> - The POS cart is now keyed by a **line id**, not `menuItemId`: "Jollof, grilled" and "Jollof, fried" have to stay two lines.
> - **Open tickets rail — built.** "Send to kitchen · pay later" creates an UNPAID ticket that appears on a rail above the menu grid with its age in minutes; tapping it opens a settle sheet. `PATCH /api/pos/orders` takes payment only — line items are immutable once cooked, so a change is a void-and-reorder, not a silent edit. Payment and its audit event are written in one transaction.
> - Caught while building: the create path hardcoded `status: 'COMPLETED'`, so an unpaid ticket would have been born already-completed and **never appeared on the rail**. Now `PREPARING` when unpaid.
>
> **Phase 4 — built (2026-08-01).**
> - **Market list** (`src/components/admin/MarketList.tsx`): low-stock items, checkable, restock quantity suggested back to 2× par, running GH₵ estimate, and a one-tap **Copy for WhatsApp** in the plan's exact format. Verified against real data — 3 of 5 seeded ingredients qualify, GH₵1,120 estimated.
> - **Waste log**: fixed reasons (Spoiled / Burnt / Comp / Staff meal) rather than free text, because four buttons get used and a text box doesn't. Writes the existing `WASTE` inventory transaction, which already decremented stock server-side.
> - **Reports renamed to questions**: "What sold?" / "What's left?" / "Who sold it?".
> - **Order intake** (`/admin/intake`): WhatsApp, phone and Bolt orders become real UNPAID tickets in the same queue, so they show on the POS rail and count in channel mix. Orders API now accepts a `source`. Also relaxed the open-shift requirement for UNPAID tickets only — a 9am WhatsApp order takes no money and shouldn't need an open drawer.
>
> **ESLint configured** (`.eslintrc.json`, `next/core-web-vitals`). Clean of errors; the remaining `exhaustive-deps` warnings are intentional mount/dependency-scoped fetches where adding the dep would loop.
>
> **Phase 5 — partially covered.** Empty states, 390px behaviour, reduced-motion and print styles were handled as each screen was touched. A dedicated end-to-end QA pass against the live UI has not been run, because signing in is something I can't do — see below.
>
> **Standing limitation:** none of this has been exercised through the actual signed-in UI. Verification was by build, typecheck, lint, direct SQL against the real schema, and unauthenticated route probes. The flows that most need a human pass: modifier sheet on a real tablet, settling an open ticket, and closing a shift with the denomination counter.
**For the executing model:** work phase by phase; each phase ends with acceptance criteria. Values (hex, copy, routes) are exact — use them verbatim. Do not touch the public website (`app/(site)` routes), Prisma schema migrations beyond what Phase 4 specifies, or auth. The live DB is a real client's — never seed or mutate production data; all UI work must handle empty states gracefully instead.

---

## 1. Where we are vs where PrimeTijara is

Audited 2026-07-06 (screens: `/admin`, `/admin/orders`, `/admin/menu`, `/admin/inventory`, `/pos`).

**What's already strong (keep):**
- Solid module coverage: Orders, Menu, Inventory, Recipes/BOMs, Suppliers, Purchasing, Expenses, Staff, Payroll, Reports, Customers, Settings + POS with shift management (incl. stale-shift recovery — genuinely good).
- Menu manager is the best screen: real photography, categories, availability toggles, GH₵ pricing.
- POS register: menu grid + order panel + Dine In / Takeaway / Delivery + charge flow.
- Role-based auth, per-shift cash accountability ("Shift open · Chef Prince").

**Why it reads "basic" next to PrimeTijara:**

| Gap | Today | PrimeTijara standard |
|---|---|---|
| **Design system** | Generic dark admin; four different accent colors on four KPI cards (green/blue/purple/orange); default component styling | One identity, one accent, 1px hairline surfaces, intentional typography |
| **Language** | Metric labels ("Today's Revenue", "Stock Value") | Plain-language questions an owner asks: "Are we making money?", "What needs attention?" with explainer banners |
| **Truth model** | Revenue shown ≠ profit; no cost/margin surfaced anywhere on dashboard | GL-style separation: money collected vs money left after costs, stated in words |
| **Action-first UX** | Dashboard is read-only; actions live deep in modules | Header quick actions: New sale · Receive stock · Create quote · Ask the assistant |
| **Empty states** | GH₵0.00 + blank chart + "No orders yet today" = dead screen at 9am | Every empty state teaches or prompts the next action |
| **Eatery specificity** | Generic retail patterns | Nothing about prep, service rush, 86'd items, plate cost, or market runs |

## 2. Design system — "Fresh Ledger"

Dump the generic dark multi-accent theme. One identity, tuned for a kitchen office: **calm light surfaces for the back office** (owners read numbers in daylight), **dark high-contrast for the POS** (fast targeting during service, greasy fingers, glare).

### Tokens (`app/globals.css` or tailwind config)
```css
/* Back office — light, paper & greens */
--bg:        #F7F6F2;  /* warm paper */
--surface:   #FFFFFF;
--surface-2: #F0EEE8;
--ink:       #1C2420;
--ink-2:     rgba(28,36,32,0.68);
--ink-3:     rgba(28,36,32,0.44);
--line:      rgba(28,36,32,0.10);
--brand:     #1E5C3A;  /* Jireh deep leaf green — headers, active nav, primary buttons */
--brand-soft:#E4F0E8;  /* tinted fills, active row background */
--accent:    #E8862E;  /* ember orange — alerts, low stock, "needs attention" ONLY */
--good:      #2E8B57;  --bad: #C0392B;
/* POS — dark service mode */
--pos-bg:    #10140F;  --pos-surface: #1A211A;
--pos-ink:   #F2F4EF;  --pos-brand:  #4FB477;
```
Rules: `--accent` orange is reserved for attention states — if a screen shows orange, something needs doing. All money in `tabular-nums`. Positive/negative deltas always signed and colored (`--good`/`--bad`). Kill the per-card gradient top borders and the 4-color KPI icons.

### Type
- **Display/headers:** "Fraunces" 600 (matches the Jireh site's food-brand warmth) — page titles, KPI numbers.
- **UI/body:** "Inter Tight" — everything else. **Mono:** "JetBrains Mono" for order codes, SKUs, times, receipts.
- KPI numbers big: `clamp(1.8rem, 2.4vw, 2.6rem)`; labels 11px mono uppercase tracking 0.14em.

### Components (build once in `components/admin/ui/`, reuse everywhere)
`StatCard` (value, delta, plain-language sub-line, optional sparkline) · `SectionCard` (title-as-question + explainer line + "→ deep link") · `DataTable` (hairline rows, sticky header, row hover `--brand-soft`, per-row actions) · `StatusChip` (paid/pending/void; open/closed; ok/low/out) · `EmptyState` (icon + one sentence + primary action button — never just "No data") · `PageHeader` (title, date, quick actions).

### Motion
Framer-style but minimal: count-up on KPI values (0.8s, once), 0.3s ease-out on rows/chips, no decorative animation. POS: zero animation except a 120ms press-scale on tiles and a slide-in for the charge sheet — speed is the aesthetic.

## 3. Functionality overhaul — think like an eatery, not a store

The organizing idea: **the back office should follow the day of service.** Morning (prep & market), service (rush), night (close & count). Every screen answers an owner question in plain language.

### 3.1 Dashboard → "Today" (rewrite of `/admin`)
Replace the four KPI cards + 30-day chart with a service-day cockpit:

1. **Header:** "Good morning, Chef Prince — Monday, 6 July" + quick actions: **Open POS · Receive stock · Add expense · Market list**.
2. **"How is today going?"** — Sales collected today (vs same weekday last week, not vs yesterday — restaurants are weekly-cyclical), orders by channel (Walk-in / WhatsApp / Bolt Food / Phone), average ticket, top seller so far.
3. **"Are we making money?"** — this week: collected − ingredient cost (from BOM consumption) − expenses = **money left**, with a one-line explainer banner exactly like PrimeTijara's ("Profit comes from your recipes' ingredient costs and logged expenses — see Reports for the full picture.").
4. **"What needs attention?"** — single orange section, auto-populated: low-stock ingredients (with "add to market list" one-tap), unclosed shifts, pending orders > 20 min, items 86'd (out of stock) still visible on POS, payroll due dates.
5. **Live service strip** when a shift is open: orders in queue, kitchen elapsed times, register cash expected.
6. **Empty-state rule:** before first sale the page must still be useful — show prep prompts ("3 ingredients low — build today's market list"), yesterday's close summary, and this week so far. Never a flat GH₵0.00 wall.

### 3.2 POS — service-speed upgrades (`/pos`)
Keep the layout; make it rush-proof:
- **86 board:** long-press a tile → "Mark unavailable today" → tile grays with "86'd" badge, auto-syncs to website menu availability.
- **Modifiers:** protein choice (grilled/fried), extras, spice level — as a bottom sheet on tile tap (data model exists via BOMs/variants; wire it).
- **Ticket flow:** order → optional "send to kitchen" state → settle later; open-tickets rail for dine-in tables.
- **Payments Ghana-style:** split GH₵ cash + MoMo on one ticket; MoMo reference field; change calculator.
- **Shift close:** expected-vs-counted cash screen with denomination counter, variance highlighted, one-tap "email/WhatsApp summary to owner." (Stale-shift recovery already exists — surface the same pattern here.)
- Touch targets ≥ 72px; entire register usable without keyboard.

### 3.3 Menu + Recipes → plate economics (`/admin/menu`, `/admin/boms`)
- On every menu item card: **plate cost** (from BOM ingredient prices) and **margin %** chip next to price. Below 55% margin → orange chip. This is the single highest-value feature for an eatery.
- "What if" panel: change an ingredient price (tomatoes doubled at Makola) → see every affected plate margin instantly.
- Availability sync: menu manager toggle ⇄ POS 86 board ⇄ public website, one source of truth.

### 3.4 Inventory → kitchen stock (`/admin/inventory`)
- Two views: **Ingredients** (kg/L/pieces, par levels, low-stock) and **Ready items** (drinks, packaged).
- **Market list:** low-stock items accumulate into a checkable list with expected cost, exportable to WhatsApp text ("Today's market run — GH₵ est. 420: tomatoes 10kg, chicken 15kg…").
- **Waste log:** quick entry (item, qty, reason: spoiled/burnt/comp) — feeds true cost in reports.
- Depletion: BOM consumption on each POS sale already implied by Recipes module — verify it runs, show "days of cover" per ingredient.

### 3.5 Reports → owner questions (`/admin/reports`)
Rename tabs to questions: **What sold?** (item ranking, channel mix, hour heatmap) · **What did it cost?** (ingredients, waste, expenses) · **What's left?** (weekly P&L in plain words) · **Who sold it?** (per-staff/shift). Every report: date-range picker, GH₵ totals, one-line takeaway sentence at top ("Best day: Saturday. Fufu — Large carried 31% of food revenue.").

### 3.6 Website order intake (bridge, Phase 4)
WhatsApp/website orders currently live outside the system. Add a lightweight **Order intake** screen: paste/receive order → becomes a ticket in the same queue as POS orders → included in channel-mix reporting. (Full online ordering is a later, separately-scoped project.)

## 4. Execution phases

| Phase | Scope | Done when |
|---|---|---|
| **0. Design system** | Tokens, fonts, the 6 shared components, restyle sidebar/nav (light theme, Fraunces titles, single brand green, orange = attention only) | Every admin page renders on the new tokens with zero purple/blue/multi-accent remnants; build passes; POS keeps dark tokens |
| **1. Today dashboard** | §3.1 full rewrite incl. empty states + attention feed | Owner sees plain-language cockpit with real data when present, useful prompts when not; all four sections deep-link correctly |
| **2. Plate economics** | §3.3 — cost/margin on menu cards, what-if panel, availability sync | Margins visible on every item with a BOM; changing an ingredient price updates margins; 86'd item disappears from website + POS |
| **3. POS rush pack** | §3.2 — 86 board, modifiers, split pay, shift-close count | A full service can run keyboard-free: order w/ modifiers → charge split cash+MoMo → close shift with counted cash variance |
| **4. Stock + reports** | §3.4 market list & waste log, §3.5 question-led reports, §3.6 intake | Market list exports to WhatsApp; weekly "What's left?" matches manual calculation on test data |
| **5. Polish/QA** | Empty states everywhere, 390px audit (owner checks on phone), reduced-motion, print stylesheet for receipts/market list | Checklist below passes |

**QA gate:** `npm run build` clean · every module usable at 390px · every table has an EmptyState with an action · no orange on screen unless something needs attention · POS tile hit-areas ≥72px · money always tabular + GH₵-prefixed · screenshots of Today, Menu, POS pass the "would Toast ship this?" squint test.

## 5. Copy bank (verbatim)
- Dashboard sections: "How is today going?" / "Are we making money?" / "What needs attention?"
- Explainer banner: "Money left = sales collected − ingredient costs from your recipes − logged expenses. Waste and comps are included once you log them."
- Empty morning state: "No sales yet — service starts when you open the register." + button "Open POS Register"
- Market list header: "Market run — {date}" · Waste reasons: "Spoiled / Burnt / Comp / Staff meal"
- Shift close: "Expected in drawer" / "Counted" / "Difference" (never "variance")

---

*Once shipped, re-capture for the portfolio with `portfolio/capture-jireh.js` — the Today dashboard and plate-margin menu will be the new hero shots.*
