-- Order audit rollout (transaction snapshots + order timeline)
-- Run in Supabase Dashboard → SQL Editor (Jireh project, logged into correct account)
-- Safe to re-run: uses IF NOT EXISTS / conditional adds where possible

-- Enums
DO $$ BEGIN
  CREATE TYPE "OrderEventType" AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'VOIDED',
    'NOTE_ADDED',
    'PAYMENT_UPDATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VoidReason" AS ENUM (
    'CUSTOMER_CANCELLED',
    'NO_SHOW',
    'WRONG_ORDER',
    'DUPLICATE',
    'QUALITY_ISSUE',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VoidInventoryAction" AS ENUM (
    'RESTOCK',
    'WASTE',
    'NONE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Order columns
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "transactionSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "voidReason" "VoidReason",
  ADD COLUMN IF NOT EXISTS "voidInventoryAction" "VoidInventoryAction";

-- OrderEvent table
CREATE TABLE IF NOT EXISTS "OrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" "OrderEventType" NOT NULL,
  "actorUserId" TEXT,
  "reason" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderEvent_orderId_createdAt_idx"
  ON "OrderEvent"("orderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "OrderEvent"
    ADD CONSTRAINT "OrderEvent_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "OrderEvent"
    ADD CONSTRAINT "OrderEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
