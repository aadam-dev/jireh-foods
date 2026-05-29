# Jireh Natural Foods — Staff POS & Back-Office Training Guide

> Last updated: May 2026 (split payments, MoMo amount entry, per-method shift reconciliation) | System by Aadamsays (aadamsays@gmail.com)

---

## 1. Roles & Access

| Role | POS Access | Back-Office Access | Shift Required |
|---|---|---|---|
| **Owner** | ✅ Full | ✅ Full | ✅ Yes |
| **Manager** | ✅ Full | ✅ Full | ✅ Yes |
| **Accountant** | ❌ | ✅ Finance only | — |
| **Cashier** | ✅ Full | ❌ Blocked | ✅ Yes |
| **Staff** | ✅ Full | ❌ Blocked | ✅ Yes |
| **IT Admin** | ✅ Demo only | ✅ Full | ❌ No — demo mode |

---

## 2. What Is a Shift?

A **shift** (also called a session) is the accounting record for a single working period.

- **Opening Float** — the cash already in the drawer when you start
- **All orders taken** during the shift are linked to it
- **Closing Cash** — what you physically count in the drawer at end of shift
- The system computes: `Expected Cash = Float + Cash Sales`
- Any difference between expected and counted is flagged as a **discrepancy**

> ⚠️ A shift is **not** the same as logging in. You can be logged in without a shift open — but you cannot take orders until a shift is opened.

---

## 3. Starting Your Day (Cashier / Owner / Manager)

1. Go to **jirehnaturalfoods.vercel.app/pos** and log in
2. You will see the **"Open Today's Shift"** screen
3. Count the cash in the drawer and enter the amount as the **Opening Float**
4. Press **"Open Shift & Start Selling"**
5. The register is now active — take orders as normal

---

## 4. Taking an Order

1. Select items from the menu grid (tap to add, +/− to adjust quantity)
2. Choose **Delivery Type**: the system defaults to **Takeaway** — change to Dine In or Delivery if needed
3. Optionally add customer name, phone, order notes
4. Press **Charge →** to go to the payment screen
5. Select payment method: **Cash**, **MoMo**, **Bolt Food**, or **Split Payment**
   - **Cash**: enter the note/coin amount tendered — change is calculated automatically
   - **MoMo**: use the numpad to enter the amount received via MoMo, then optionally add the transaction reference number
   - **Bolt Food**: enter the Bolt order reference; payment is collected by Bolt
   - **Split Payment**: see section below
6. Press **Confirm & Print** — receipt prints automatically

---

## 4a. Split Payments (Partial Cash + Partial MoMo)

Use this when a customer pays partly in cash and partly via MoMo (or any combination).

1. On the payment screen, tap **"⊕ Split"**
2. The screen switches to split mode with tabs: **Cash · MoMo · Bolt Food**
3. Tap **Cash**, enter the cash amount received using the numpad
4. Tap **MoMo**, enter the MoMo amount (tap "Fill Remaining" to auto-fill the balance)
5. The progress bar at the bottom shows how much is covered vs the total
6. The **"Confirm Payment"** button activates only when the full order total is reached
7. Tap **"Confirm Payment"** — the receipt will show each payment leg separately

> **Example:** Order is GH₵ 100. Customer pays GH₵ 60 cash + GH₵ 40 MoMo. Enter 60 on Cash tab, then tap "Fill Remaining" on MoMo tab → done.

---

## 5. Closing Your Shift

1. Tap the **"Shift Open"** pill in the top-right corner (or "Shift" tab on mobile)
2. The session screen shows total revenue broken down by payment method (Cash / MoMo / Bolt Food)
3. **For each method that has revenue, you enter the actual amount received:**
   - **Cash** — physically count the drawer and enter the total (including the opening float). The system shows expected vs counted in real time.
   - **MoMo** _(if any MoMo orders)_ — enter the total MoMo received during the shift
   - **Bolt Food** _(if any Bolt orders)_ — enter the total Bolt collected
4. A live discrepancy label under each section shows if the numbers match
5. Press **Close Session**
   - If all amounts match: session closes immediately and the summary screen is shown
   - If there is a discrepancy: an alert appears showing the gap. You can either **go back and recount**, or **confirm and close anyway** (discrepancy will be logged)
6. The summary screen shows per-method cards: expected, actual entered, and any discrepancy
7. Hand over the cash to the manager

> **Tip:** A discrepancy of GH₵ 0.00 is the goal. Small rounding differences (GH₵ 0.01) are normal and safe to close without concern.

---

## 6. IT Admin — Demo Mode

The IT Admin account (`it@jireh.com`) operates in **demo mode only**:

- No shift is needed — the shift gate is bypassed entirely
- All orders placed are flagged **DEMO** and do not:
  - Appear in revenue reports or the dashboard
  - Deduct from inventory
  - Create accounting entries
- IT Admin has **full back-office access** for setup, testing, and configuration

---

## 7. Back-Office Quick Reference

| Section | Who | What |
|---|---|---|
| Dashboard | Owner, Manager, Accountant | Revenue today, top items, chart |
| Orders | Owner, Manager, Cashier, Accountant | View, update, void orders |
| Menu | Owner, Manager | Add/edit/price menu items |
| Inventory | Owner, Manager | Stock levels, adjustments |
| Recipes (BOMs) | Owner, Manager | Link ingredients to menu items |
| Suppliers | Owner, Manager | Supplier contacts |
| Purchasing | Owner, Manager | Purchase orders, goods receipt |
| Expenses | Owner, Manager, Accountant | Log business expenses |
| Staff | Owner, Manager | Add staff, set roles, reset passwords |
| Payroll | Owner, Accountant | Payroll records |
| Reports | Owner, Manager, Accountant | P&L, sales, exports |
| Customers | Owner, Manager, Accountant | Look up customer order history |
| Settings | Owner only | VAT, receipt footer, business name |

---

## 8. Switching Between POS and Back-Office

- **From POS → Admin:** tap **"Admin Panel"** in the POS header (visible to Owner, Manager, Accountant)
- **From Admin → POS:** click **"Open POS Register"** at the top of the sidebar

---

## 9. Important Rules

- **Never share login credentials.** Each staff member has their own account.
- **Always open a shift before selling.** Orders without a shift cannot be tracked for accounting.
- **Count cash carefully** when closing a shift. Discrepancies are logged automatically.
- **MoMo payments**: always enter the exact amount received via MoMo — this is used for end-of-day reconciliation.
- **Split payments**: only confirm when the progress bar reaches 100% (full order total covered). The system will not allow confirmation until then.
- **Void orders** (Owner/Manager only) via Admin → Orders → View → "Void / Refund Order". Always provide a reason — it is audit-logged.
- **Bolt Food orders**: mark as Bolt Food payment method. Revenue is reconciled separately from Bolt's monthly statement.
- **Default delivery type is Takeaway** — remember to switch to Dine In if the customer is eating in.

---

*For technical support contact: aadamsays@gmail.com | +233 263 039 818*
