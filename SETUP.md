# Jireh Natural Foods — Back Office Setup

## What's been built

| Module | Route | Who can access |
|---|---|---|
| **Login** | `/login` | Everyone |
| **POS Register** | `/pos` | All staff |
| **Dashboard** | `/admin` | Owner, Manager, Accountant |
| **Orders** | `/admin/orders` | Owner, Manager, Cashier, Accountant |
| **Menu** | `/admin/menu` | Owner, Manager |
| **Inventory** | `/admin/inventory` | Owner, Manager |
| **Expenses** | `/admin/expenses` | Owner, Manager, Accountant |
| **Staff** | `/admin/staff` | Owner, Manager |
| **Payroll** | `/admin/payroll` | Owner, Accountant |
| **Reports** | `/admin/reports` | Owner, Manager, Accountant |
| **Settings** | `/admin/settings` | Owner |

---

## Step 1 — Free disk space then install

You're at ~99% disk usage. Before running `npm install`:
- Empty your Trash
- Clear Downloads folder
- Delete unused node_modules in other projects: `rm -rf ~/Documents/DevProjects/some-old-project/node_modules`

Then install:

```bash
cd /Users/aadam/Documents/DevProjects/website-leads/restaurant/jireh-natural-foods
npm install
```

---

## Step 2 — Set up Supabase database

1. Go to [supabase.com](https://supabase.com) → New project
2. Copy the **Connection string** (Transaction mode, port 6543) → `DATABASE_URL`
3. Copy the **Direct connection** (port 5432) → `DIRECT_URL`

---

## Step 3 — Create `.env.local`

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
DATABASE_URL="postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[pw]@aws-0-[region].pooler.supabase.com:5432/postgres"
AUTH_SECRET="run: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"
```

---

## Step 4 — Push database schema + seed

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to Supabase
npm run db:seed       # Seed menu, categories, default users
```

Seed creates:
- **Owner:** `admin@jireh.com` / `jireh2024!`
- **Cashier:** `cashier@jireh.com` / `cashier123`
- All 8 food items + 4 juices
- 9 expense categories

---

## Step 5 — Run dev server

```bash
npm run dev
```

Open:
- Public website: http://localhost:3000
- Login: http://localhost:3000/login
- Admin: http://localhost:3000/admin
- POS: http://localhost:3000/pos

---

## Roles explained

| Role | What they can do |
|---|---|
| **Owner** | Everything — full access |
| **Manager** | Orders, Menu, Inventory, Expenses, Staff, Reports |
| **Accountant** | Orders, Expenses, Payroll, Reports |
| **Cashier** | POS register only |
| **Staff** | POS register only |

---

## POS Workflow

1. Cashier logs in → automatically lands on `/pos`
2. Tap menu items to add to cart
3. Select Dine In / Takeaway / Delivery
4. Enter customer name (optional)
5. Select payment method (Cash, MoMo, Card, Bank)
6. Tap **Charge** → order is saved instantly
7. View today's orders via "Today's Orders" tab

---

## Tech Stack

- **Next.js 14** (App Router)
- **Prisma** + **Supabase Postgres**
- **NextAuth v5** (JWT, credentials)
- **Tailwind CSS** (Jireh dark green branding)
- **Recharts** (financial charts)
- **React Hook Form** + **Zod** (forms & validation)
- **date-fns** (date formatting)
