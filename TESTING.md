# Jireh Natural Foods — System Test Plan

> Last updated: June 2026 (order audit timeline, transaction snapshots, void inventory actions)  
> System: [jirehnaturalfoods.vercel.app](https://jirehnaturalfoods.vercel.app)  
> Staff training: [docs/TRAINING.md](./docs/TRAINING.md) · Team guide: [docs/TEAM_GUIDE.md](./docs/TEAM_GUIDE.md)  
> Run these manually or hand to Claude Code with: _"Run the Jireh test plan at docs/TESTING.md"_

---

## Test Accounts

| Email | Password | Role | Access |
|---|---|---|---|
| `prince@jireh.com` | `jireh2024!` | OWNER | POS + Full Back-Office |
| `it@jireh.com` | _(reset if unknown)_ | OWNER (demo) | POS demo mode + Full Back-Office |
| `nii@jireh.com` | `cashier123` | CASHIER | POS only |
| _(create in test)_ | `test1234` | MANAGER | POS + Back-Office |

---

## 1. Authentication & Access Control

### 1.1 Login
- [ ] Navigate to `https://jirehnaturalfoods.vercel.app/login`  
  **Expect:** Login form with Jireh logo, email + password fields
- [ ] Submit with wrong password  
  **Expect:** "Invalid email or password" error shown inline
- [ ] Submit with blank fields  
  **Expect:** Validation errors under each field
- [ ] Login as `prince@jireh.com`  
  **Expect:** Redirect to `/admin` (OWNER goes to back-office by default)
- [ ] Login as `nii@jireh.com` (CASHIER)  
  **Expect:** Redirect to `/pos` (cashier goes directly to POS)

### 1.2 Route Protection
- [ ] Open incognito window, navigate directly to `https://jirehnaturalfoods.vercel.app/pos`  
  **Expect:** Redirect to `/login?callbackUrl=/pos` — POS never visible without login
- [ ] Open incognito, navigate to `https://jirehnaturalfoods.vercel.app/admin`  
  **Expect:** Redirect to `/login`
- [ ] Login as `nii@jireh.com` (CASHIER), try navigating to `/admin`  
  **Expect:** Redirect to `/pos` — cashier cannot access back-office
- [ ] Login as any user, log out via the Logout button  
  **Expect:** Redirect to `/login`, subsequent `/pos` visit redirects to login

### 1.3 IT Admin Demo Mode
- [ ] Login as `it@jireh.com`  
  **Expect:** POS opens immediately with **"DEMO MODE"** amber badge — no shift required
- [ ] Place an order as IT admin  
  **Expect:** Order succeeds but does NOT appear in back-office revenue/dashboard

---

## 2. POS — Shift Management

### 2.1 Opening a Shift
- [ ] Login as `prince@jireh.com`, navigate to `/pos`  
  **Expect:** "Open Today's Shift" gate screen (not the register)
- [ ] Enter 100 as opening float using the numpad  
  **Expect:** Display shows `GH₵ 100.00`
- [ ] Tap "Open Shift & Start Selling"  
  **Expect:** Register opens; header shows green "Shift Open" pill

### 2.2 Closing a Shift
- [ ] With a shift open, tap **Menu** → **Close the shift**
  **Expect:** One card per tender that took money. Cash always; MoMo and Bolt only if the shift took some.
- [ ] Read the Cash line before touching anything
  **Expect:** Its working is spelled out — `Float … · Sales + … · Out − …` — and **Difference** reads **"Not counted yet"**, not a red number.
- [ ] Tap **Count notes**, add a few denominations, tap **Done**
  **Expect:** The sheet closes, **Counted** fills in, **Difference** appears, and the card shows "N notes and coins counted · recount".
- [ ] Tap **Type total** instead and key a figure
  **Expect:** Same Counted / Difference behaviour without the note sheet.
- [ ] If MoMo or Bolt revenue > 0, key the amount received
  **Expect:** That row shows "Not counted yet" until keyed, then Exact / Over by / Short by.
- [ ] Check **Total difference**
  **Expect:** Rolls up every counted tender. Reads "Not counted yet" while nothing has been counted.
- [ ] Type a **Closing note**, then tap **Close Shift**
  **Expect (exact):** Summary screen; note saved to the shift.
  **Expect (difference):** A confirm listing each difference, worded "Difference found" — never "variance". Cancelling returns you to the screen with the count intact.
- [ ] Tap **Not yet**
  **Expect:** Back to selling, shift still open, counted figures kept.
- [ ] Tap **Print summary**
  **Expect:** Shift report on till paper — opened/closed, cashier, sales by tender, cash in/out lines, expected vs counted, difference, note.

### 2.3 Cash in / cash out
- [ ] **Menu** → **Cash out**, key 50, tap **Bought gas**, tap **Record**
  **Expect:** Saved. **Expected in drawer** drops by GH₵50 on the close screen, and the movement is listed with who recorded it.
- [ ] Try to record with an empty reason
  **Expect:** Refused — a movement with no explanation is the thing this prevents.
- [ ] Try to record with amount 0
  **Expect:** Refused.
- [ ] **Menu** → **Cash in**, key 20, reason "Change for drawer"
  **Expect:** Expected in drawer rises by GH₵20.
- [ ] Open Admin → Reports → "Who sold it?" for the same shift
  **Expect:** Its **Expected in drawer** matches the till exactly. (Three places compute this; they share one helper.)

### 2.4 The register Menu
- [ ] Tap **Menu** at both a phone width and a desktop width
  **Expect:** Same items at both — nothing is desktop-only.
- [ ] Press Escape, and tap outside
  **Expect:** Closes both ways; focus returns to the Menu button.
- [ ] As a CASHIER
  **Expect:** No "Back to dashboard".
- [ ] As OWNER or MANAGER
  **Expect:** "Back to dashboard" present.
- [ ] With no shift open
  **Expect:** Shift sales, Count the drawer, Cash in and Cash out are visibly disabled, not hidden.
- [ ] Tap **Sign out**
  **Expect:** A confirm first.

## 3. POS — Taking Orders

### 3.1 Menu Display
- [ ] Open the register with shift active  
  **Expect:** Food and Juices categories visible; correct items:
  - Food: Jollof Rice (S/M/L), Asian Fried Rice (S/M/L), Fries with Chicken, Fufu (M/L), Banku (M/L)
  - Juices: Sobolo, Millet Drink, Brukina, Pineapple Drink
  - Snacks: Buns, Meat Pie
- [ ] Verify item images show for Jollof Rice, Asian Fried Rice, Fufu, Sobolo, Pineapple Drink  
  **Expect:** Food photo thumbnails visible on cards
- [ ] Verify items without images show a placeholder icon  
  **Expect:** Subtle plate emoji shown instead

### 3.2 Adding Items to Cart
- [ ] Tap "Jollof Rice — Medium" (GH₵55)  
  **Expect:** Item appears in cart panel with quantity 1; card shows green `1` badge
- [ ] Tap the same item again  
  **Expect:** Quantity increases to 2
- [ ] Use `+` and `−` buttons in cart  
  **Expect:** Quantity updates correctly; `−` at 1 removes the item
- [ ] Tap cart item's pencil icon and add a note "No pepper"  
  **Expect:** Note saved inline on item row
- [ ] Add multiple items from different categories  
  **Expect:** Cart shows all items, total is correct sum

### 3.3 Search
- [ ] Type "fufu" in the search box  
  **Expect:** Only Fufu items shown, categories hidden
- [ ] Clear search  
  **Expect:** Returns to active category view

### 3.4 Delivery Type
- [ ] Open register with items in cart — check the default delivery type  
  **Expect:** **Takeaway** is selected by default (not Dine In)
- [ ] Switch to "Dine In" and back to "Takeaway"  
  **Expect:** Selection highlights green; type saved to order correctly

### 3.5 Cash Payment
- [ ] Tap "Charge GH₵ X" button  
  **Expect:** Payment screen opens with order summary
- [ ] Select "Cash" payment method  
  **Expect:** Numpad appears for tendered amount
- [ ] Enter tendered amount (e.g. 100 for a GH₵55 order)  
  **Expect:** Change calculated correctly as GH₵45
- [ ] Tap "Confirm Payment"  
  **Expect:** Success screen → receipt auto-prints (thermal format)

### 3.6 MoMo Payment
- [ ] Repeat order, select "MoMo"  
  **Expect:** Numpad appears to enter the MoMo amount received (same as cash flow)
- [ ] Enter the MoMo amount using numpad (e.g. exact order total)  
  **Expect:** Amount displayed; optionally enter a transaction reference below
- [ ] Confirm payment  
  **Expect:** Order placed successfully; MoMo payment recorded for session reconciliation

### 3.7 Bolt Food Payment
- [ ] Repeat order, select "Bolt Food"  
  **Expect:** Bolt order reference input appears
- [ ] Enter reference, confirm  
  **Expect:** Order placed; shows Bolt payment in orders list

### 3.8 Split Payment
- [ ] Add items totalling e.g. GH₵ 100 to cart, tap "Charge →"  
  **Expect:** Payment screen shows Cash / MoMo / Bolt Food tabs plus a **"⊕ Split"** toggle
- [ ] Tap "⊕ Split"  
  **Expect:** Split mode activates; tabs for Cash, MoMo, Bolt Food appear; progress bar at bottom shows GH₵ 0 / GH₵ 100
- [ ] Tap "Cash" leg, enter GH₵ 60 using numpad  
  **Expect:** Progress bar advances to GH₵ 60 / GH₵ 100; Cash leg shows GH₵ 60
- [ ] Tap "MoMo" leg, tap "Fill remaining"  
  **Expect:** MoMo leg fills to GH₵ 40; progress bar shows GH₵ 100 / GH₵ 100 ✅
- [ ] Tap "Confirm Payment"  
  **Expect:** Order placed with payment method "SPLIT"; receipt shows two legs (Cash GH₵60 + MoMo GH₵40)
- [ ] Try confirming with only GH₵ 60 entered (GH₵ 40 gap)  
  **Expect:** "Confirm Payment" button disabled — cannot confirm until total is reached
- [ ] Add a 3-way split: Cash + MoMo + Bolt Food  
  **Expect:** All three legs accepted; order created correctly
- [ ] In Admin → Orders, find the SPLIT order  
  **Expect:** Payment badge shows "Split"; order detail shows individual leg amounts
- [ ] Close session after a SPLIT order and check reconciliation  
  **Expect:** Cash and MoMo (and Bolt) sections reflect their respective leg amounts

### 3.9 Cart Persistence
- [ ] Add items to cart, navigate away (to Admin), return to POS  
  **Expect:** Cart is still intact (saved in localStorage); split mode resets to single payment

---

## 4. POS — Mobile / Tablet

### 4.1 Bottom Navigation (< 768px viewport)
- [ ] Open POS on mobile or narrow the browser to < 768px  
  **Expect:** Bottom tab bar visible with: Menu | Cart | Orders | Shift
- [ ] Tap "Cart" tab  
  **Expect:** Cart panel shown full-width; menu hidden
- [ ] Tap "Menu" tab  
  **Expect:** Menu shown; cart hidden
- [ ] Tap "Orders" tab  
  **Expect:** Today's orders list shown
- [ ] Tap "Shift" tab  
  **Expect:** Session management screen

### 4.2 Desktop (≥ 768px)
- [ ] On desktop, confirm bottom nav is hidden  
  **Expect:** Only top header buttons visible for Orders and Shift

---

## 5. POS — Offline & PWA

### 5.1 Install as PWA
- [ ] On Chrome/Android, visit `/pos` — look for install prompt in browser bar  
  **Expect:** App installable; opens fullscreen without browser UI
- [ ] On iOS Safari, Share → Add to Home Screen  
  **Expect:** App icon added to home screen; opens standalone

### 5.2 Offline Order Queue
- [ ] Open POS with network connected
- [ ] Disconnect from internet (airplane mode / DevTools → offline)  
  **Expect:** Yellow banner: "No internet — orders will be saved locally until reconnected"
- [ ] Build an order and tap Charge → Confirm  
  **Expect:** "Saved Offline" screen — no receipt print, shows checklist of guarantees
- [ ] Reconnect to internet  
  **Expect:** Blue banner: "1 offline order waiting to sync" with "Sync now" button
- [ ] Wait a few seconds or tap "Sync now"  
  **Expect:** Banner disappears; order appears in today's orders list
- [ ] Verify in Back-Office → Orders that the synced order is recorded  
  **Expect:** Order visible with correct items, total, and payment method

### 5.3 Menu Offline Cache
- [ ] Open POS, disconnect internet, refresh the page  
  **Expect:** Menu items still load from service worker cache; POS usable

---

## 6. Back-Office — Dashboard

- [ ] Login as `prince@jireh.com`, navigate to `/admin`  
  **Expect:** Dashboard with KPI cards (Revenue Today, Orders, Average Order, Active Shift status)
- [ ] After placing test orders in POS, refresh dashboard  
  **Expect:** Revenue, order count updated correctly
- [ ] Check "Top Items" chart  
  **Expect:** Ordered items appear in ranking
- [ ] Check "Revenue Trend" chart  
  **Expect:** Line chart with daily data

---

## 7. Back-Office — Orders

- [ ] Navigate to Admin → Orders  
  **Expect:** Table showing all orders with order number, items, cashier, total, payment, status
- [ ] Filter by payment method "Cash"  
  **Expect:** Only cash orders shown
- [ ] Filter by status "Completed"  
  **Expect:** Correct filter applied
- [ ] Filter by **shift** (session dropdown)  
  **Expect:** Only orders from that POS session shown
- [ ] Click an order row  
  **Expect:** Detail modal with **As transacted** snapshot and **Timeline** sections
- [ ] Verify snapshot shows items/prices as at sale (immutable even if menu price changed later)  
  **Expect:** Snapshot section populated for new orders; older orders may show fallback message
- [ ] As OWNER: click "Void / Refund Order" in detail modal  
  **Expect:** Void modal with reason dropdown + inventory action (Restock / Waste / None)
- [ ] Void with reason "Customer cancelled" + **Restock**  
  **Expect:** Order `CANCELLED`; timeline shows VOIDED event; ingredients restocked
- [ ] Void with reason "Customer no-show" + **Waste**  
  **Expect:** WASTE inventory transactions logged; stock **not** restored
- [ ] Try void as CASHIER (should not have access to admin)  
  **Expect:** N/A — cashier blocked from admin entirely
- [ ] Verify timeline shows CREATED event on new POS orders  
  **Expect:** Actor = cashier name, timestamp correct

---

## 8. Back-Office — Menu Management

### 8.1 View Menu
- [ ] Navigate to Admin → Menu  
  **Expect:** Category sidebar + items list; correct categories (Food, Juices, Snacks)
- [ ] Click each category  
  **Expect:** Items update correctly; images shown where assigned

### 8.2 Add Category
- [ ] Click "Add Category", enter "Drinks"  
  **Expect:** Category appears in sidebar

### 8.3 Add Item
- [ ] Select Food category, click "Add Item"  
  **Expect:** Modal opens with Name, Price, Cost Price, Description, Available, Popular fields
- [ ] Fill form: Name="Test Item", Price=25, Description="A test"  
  **Expect:** Item appears in Food category list
- [ ] Toggle "Available" off on the item  
  **Expect:** Item immediately unavailable in POS (hidden from menu grid)

### 8.4 Edit Item
- [ ] Click edit (pencil) on any item  
  **Expect:** Modal pre-filled with item data
- [ ] Change price, save  
  **Expect:** New price reflected in POS immediately

### 8.5 Delete Item
- [ ] Delete the "Test Item" created above  
  **Expect:** Confirmation dialog; item removed from list

---

## 9. Back-Office — Inventory

- [ ] Navigate to Admin → Inventory  
  **Expect:** Table of ingredients with stock levels
- [ ] Click "Add Item", enter ingredient name, unit, quantity  
  **Expect:** Item added to inventory list
- [ ] Click "Adjust Stock" on an item, enter +50  
  **Expect:** Stock level increases; adjustment logged with reason
- [ ] Add item with low stock level (below reorder point)  
  **Expect:** Shows in low-stock badge count in sidebar

---

## 10. Back-Office — Purchasing

- [ ] Navigate to Admin → Purchasing  
  **Expect:** Purchase order list (empty initially)
- [ ] Click "New Purchase Order"  
  **Expect:** Form to select supplier, add items, quantities, unit cost
- [ ] Create a PO with at least 2 line items  
  **Expect:** PO created with status "PENDING"
- [ ] Click "Receive Goods" on the PO  
  **Expect:** Form to enter received quantities
- [ ] Submit received quantities  
  **Expect:** PO status changes to "RECEIVED"; inventory stock levels increase

---

## 11. Back-Office — Expenses

- [ ] Navigate to Admin → Expenses  
  **Expect:** Expense list for current month
- [ ] Click "Add Expense"  
  **Expect:** Form with: Category, Amount, Date, Description, Payment method
- [ ] Add expense: Category "Ingredients", Amount 500, Description "Market run"  
  **Expect:** Expense appears in list; total updated
- [ ] Change month filter  
  **Expect:** Shows expenses for selected period

---

## 12. Back-Office — Staff

- [ ] Navigate to Admin → Staff  
  **Expect:** Staff cards for all users (prince, nii, it)
- [ ] Click "Add Staff Member"  
  **Expect:** Form with Name, Email, Password, Role dropdown
- [ ] Create: Name="Ama Mensah", Email="ama@jireh.com", Role="CASHIER", Password="test1234"  
  **Expect:** Staff card created
- [ ] Login in a new incognito tab as `ama@jireh.com` / `test1234`  
  **Expect:** Redirected to `/pos` (CASHIER role)
- [ ] Back in admin, reset password for the test user  
  **Expect:** New password works for login
- [ ] Deactivate the test account  
  **Expect:** Cannot log in; middleware blocks access

---

## 13. Back-Office — Suppliers

- [ ] Navigate to Admin → Suppliers  
  **Expect:** Supplier list (empty initially)
- [ ] Add supplier: Name="Kumasi Farms", Phone="024 000 0000", Products="Yam, Plantain"  
  **Expect:** Supplier card created
- [ ] Edit supplier — change phone number  
  **Expect:** Updated phone saved
- [ ] Delete supplier  
  **Expect:** Removed from list (only if no active POs)

---

## 14. Back-Office — Payroll

- [ ] Navigate to Admin → Payroll  
  **Expect:** Payroll records for current month
- [ ] Add payroll record for a staff member  
  **Expect:** Record created with amount, period, payment method
- [ ] Export payroll for the month  
  **Expect:** CSV or PDF download with correct data

---

## 15. Back-Office — Reports

- [ ] Navigate to Admin → Reports  
  **Expect:** Tabs for Sales, P&L, Expenses, etc.
- [ ] Select "Sales Report" for today  
  **Expect:** Revenue breakdown by payment method and item
- [ ] Click "Export to CSV"  
  **Expect:** CSV downloaded with correct columns
- [ ] Click "Print Report"  
  **Expect:** Print dialog opens; report renders on white background (dark theme stripped)
- [ ] Switch to "P&L" tab  
  **Expect:** Revenue vs expenses vs gross profit calculated

---

## 16. Back-Office — Settings

- [ ] Navigate to Admin → Settings (OWNER only)  
  **Expect:** Form with business name, receipt footer, VAT toggle, etc.
- [ ] Change "Receipt Footer" to "Thank you! Come again soon."  
  **Expect:** Setting saved
- [ ] Place a new order in POS  
  **Expect:** Receipt shows updated footer text

---

## 17. Back-Office — Recipes (BOMs)

- [ ] Navigate to Admin → Recipes  
  **Expect:** Bill-of-materials list linked to menu items
- [ ] Add recipe for "Jollof Rice — Large": link 3 ingredients with quantities  
  **Expect:** Recipe saved and linked to menu item
- [ ] Place a Jollof Rice Large order in POS  
  **Expect:** Ingredient stock levels reduced by recipe quantities

---

## 18. Receipts & Print

- [ ] Place a cash order in POS  
  **Expect:** Browser print dialog opens automatically after ~600ms
- [ ] Verify print preview shows ONLY the receipt (80mm thermal format), not the success screen  
  **Expect:** `print:hidden` class hides all other UI; only `#receipt-print` renders
- [ ] Verify receipt contains:
  - [ ] Business name from settings
  - [ ] Order number
  - [ ] Cashier name ("Served by:")
  - [ ] Items with quantities and sub-totals
  - [ ] Total
  - [ ] Payment method and change (if cash)
  - [ ] Receipt footer from settings
  - [ ] "powered by aadam" credit at bottom
- [ ] Click "Print Receipt" button manually on the success screen  
  **Expect:** Print dialog reopens

---

## 19. Known Items / Edge Cases to Watch

| Item | Status | Notes |
|---|---|---|
| Banku items have image | ✅ Fixed | Photo stored at `/public/jireh/banku.jpg` — shows on POS cards |
| Brukina is not on public website | ✅ Kept intentionally | Real menu item added via admin |
| Snacks (Buns, Meat Pie) not on website | ✅ Kept | Real items added via admin |
| IT admin creates DEMO orders | ✅ By design | Not counted in revenue; shift bypass intended |
| Background sync not on Safari | ✅ Handled | Uses `window.online` event + IndexedDB (works on all browsers) |
| PWA icons are JPEG (not PNG) | ⚠️ OK for now | For best PWA install badge, replace `logo.jpg` with 192×192 and 512×512 PNG versions |

---

## 20. Critical Regression Checklist

Run these after any deployment:

- [ ] Unauthenticated `/pos` and `/admin` redirect to `/login`
- [ ] CASHIER cannot access `/admin`
- [ ] POS shift gate shows for all roles except IT admin
- [ ] IT admin gets DEMO badge and bypasses shift gate
- [ ] Order placed → appears in dashboard and orders list
- [ ] Cash payment: tendered + change calculated correctly
- [ ] MoMo payment: numpad for amount entry; amount recorded in session stats
- [ ] Bolt Food payment: reference captured; amount recorded in session stats
- [ ] Split payment: progress bar tracks total; "Confirm" blocked until full; receipt shows legs
- [ ] Session close: per-method reconciliation (Cash / MoMo / Bolt) with discrepancy warning
- [ ] Receipt prints on paper in 80mm thermal format (not full page)
- [ ] SPLIT receipt shows individual legs, not generic "Payment (SPLIT)"
- [ ] Admin Orders: Split orders show "Split" badge; customer page shows "Split" label
- [ ] Admin Orders: snapshot + timeline visible on order detail; shift filter works
- [ ] Admin Orders: void requires reason + inventory action; DELETE endpoint disabled
- [ ] Offline order saved → syncs automatically when reconnected
- [ ] Menu matches public website items and prices exactly
- [ ] Default delivery type is **Takeaway** (not Dine In)

---

*Test environment: [jirehnaturalfoods.vercel.app](https://jirehnaturalfoods.vercel.app)*  
*For issues: aadamsays@gmail.com | +233 263 039 818*
