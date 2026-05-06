-- ============================================================
-- Jireh Natural Foods — Schema v2 Migration
-- Run this in Supabase SQL Editor (dashboard.supabase.com)
-- Project: oflraijzxczmzbkshfpe
-- ============================================================

-- 1. New enums
DO $$ BEGIN
  CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PoStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. POS Sessions
CREATE TABLE IF NOT EXISTS "PosSession" (
  "id"           TEXT NOT NULL,
  "openedBy"     TEXT NOT NULL,
  "closedBy"     TEXT,
  "openedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"     TIMESTAMP(3),
  "openingFloat" DECIMAL(10,2) NOT NULL,
  "closingCash"  DECIMAL(10,2),
  "status"       "SessionStatus" NOT NULL DEFAULT 'OPEN',
  "notes"        TEXT,
  CONSTRAINT "PosSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PosSession"
  ADD CONSTRAINT "PosSession_openedBy_fkey"
  FOREIGN KEY ("openedBy") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PosSession"
  ADD CONSTRAINT "PosSession_closedBy_fkey"
  FOREIGN KEY ("closedBy") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Extend Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sessionId"      TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paymentRef"     TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "taxAmount"      DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tenderedAmount" DECIMAL(10,2);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "changeAmount"   DECIMAL(10,2);

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "PosSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Extend InventoryItem
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "purchaseUnit"     TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "conversionFactor" DECIMAL(10,3) NOT NULL DEFAULT 1;

-- 5. BOM (Recipe Engine)
CREATE TABLE IF NOT EXISTS "Bom" (
  "id"         TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "notes"      TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Bom_menuItemId_key" ON "Bom"("menuItemId");

ALTER TABLE "Bom"
  ADD CONSTRAINT "Bom_menuItemId_fkey"
  FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "BomLine" (
  "id"              TEXT NOT NULL,
  "bomId"           TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "quantity"        DECIMAL(10,3) NOT NULL,
  "unit"            TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BomLine"
  ADD CONSTRAINT "BomLine_bomId_fkey"
  FOREIGN KEY ("bomId") REFERENCES "Bom"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BomLine"
  ADD CONSTRAINT "BomLine_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Suppliers
CREATE TABLE IF NOT EXISTS "Supplier" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "contactPerson" TEXT,
  "phone"         TEXT,
  "email"         TEXT,
  "address"       TEXT,
  "notes"         TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- 7. Purchase Orders
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id"           TEXT NOT NULL,
  "poNumber"     TEXT NOT NULL,
  "supplierId"   TEXT NOT NULL,
  "status"       "PoStatus" NOT NULL DEFAULT 'DRAFT',
  "expectedDate" TIMESTAMP(3),
  "totalAmount"  DECIMAL(10,2),
  "notes"        TEXT,
  "createdById"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. PO Lines
CREATE TABLE IF NOT EXISTS "PoLine" (
  "id"              TEXT NOT NULL,
  "poId"            TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "orderedQty"      DECIMAL(10,3) NOT NULL,
  "receivedQty"     DECIMAL(10,3) NOT NULL DEFAULT 0,
  "purchaseUnit"    TEXT NOT NULL,
  "unitPrice"       DECIMAL(10,2) NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PoLine"
  ADD CONSTRAINT "PoLine_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PoLine"
  ADD CONSTRAINT "PoLine_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. PO Receipts
CREATE TABLE IF NOT EXISTS "PoReceipt" (
  "id"           TEXT NOT NULL,
  "poId"         TEXT NOT NULL,
  "receivedById" TEXT NOT NULL,
  "receivedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes"        TEXT,
  CONSTRAINT "PoReceipt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PoReceipt"
  ADD CONSTRAINT "PoReceipt_poId_fkey"
  FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PoReceipt"
  ADD CONSTRAINT "PoReceipt_receivedById_fkey"
  FOREIGN KEY ("receivedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. PO Receipt Lines
CREATE TABLE IF NOT EXISTS "PoReceiptLine" (
  "id"              TEXT NOT NULL,
  "receiptId"       TEXT NOT NULL,
  "poLineId"        TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "qtyReceived"     DECIMAL(10,3) NOT NULL,
  "purchaseUnit"    TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoReceiptLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PoReceiptLine"
  ADD CONSTRAINT "PoReceiptLine_receiptId_fkey"
  FOREIGN KEY ("receiptId") REFERENCES "PoReceipt"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PoReceiptLine"
  ADD CONSTRAINT "PoReceiptLine_poLineId_fkey"
  FOREIGN KEY ("poLineId") REFERENCES "PoLine"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PoReceiptLine"
  ADD CONSTRAINT "PoReceiptLine_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
