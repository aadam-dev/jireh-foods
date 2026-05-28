# Jireh Natural Foods — Staff POS & Back-Office Training Guide

> Last updated: May 2026 | System by Aadamsays (aadamsays@gmail.com)

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
2. Choose **Delivery Type**: Dine In / Takeaway / Delivery
3. Optionally add customer name, phone, order notes
4. Press **Charge →** to go to the payment screen
5. Select payment method: **Cash**, **MoMo**, or **Bolt Food**
   - **Cash**: enter tendered amount — change is calculated automatically
   - **MoMo**: enter the transaction reference number
   - **Bolt Food**: order reference auto-captured; payment collected by Bolt
6. Press **Confirm & Print** — receipt prints automatically

---

## 5. Closing Your Shift

1. Tap the **"Shift Open"** pill in the top-right corner of the register
2. Physically count all cash in the drawer
3. Enter the **Closing Cash** amount
4. Press **Close Shift**
5. The system shows a summary: revenue, cash expected, cash counted, discrepancy
6. Hand over the cash to the manager

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
- **Void orders** (Owner/Manager only) via Admin → Orders → View → "Void / Refund Order". Always provide a reason — it is audit-logged.
- **Bolt Food orders**: mark as Bolt Food payment method. Revenue is reconciled separately from Bolt's monthly statement.

---

*For technical support contact: aadamsays@gmail.com | +233 263 039 818*
