import { prisma } from './prisma';

// Simple in-process TTL cache — Settings rarely change, no Redis needed
const cache = new Map<string, { value: string; ts: number }>();
const TTL_MS = 60_000; // 1 minute

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < TTL_MS) return cached.value;

  try {
    const row = await prisma.settings.findUnique({ where: { key } });
    const value = row?.value ?? fallback;
    cache.set(key, { value, ts: Date.now() });
    return value;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: string) {
  cache.delete(key);
  return prisma.settings.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

// ── Typed helpers for known keys ──────────────────────────────────────────────

/** Ghana GRA VAT composite levy rate (0–1). Default 0 until registered. */
export async function getTaxRate(): Promise<number> {
  const raw = await getSetting('tax_rate', '0');
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : Math.min(Math.max(n, 0), 1);
}

/** Currency symbol shown in UI. Default GH₵. */
export async function getCurrencySymbol(): Promise<string> {
  return getSetting('currency_symbol', 'GH₵');
}

/** Business name for receipts/reports. */
export async function getBusinessName(): Promise<string> {
  return getSetting('business_name', 'Jireh Natural Foods');
}

/** GRA TIN for receipts (empty = not registered). */
export async function getGraTin(): Promise<string> {
  return getSetting('gra_tin', '');
}

/**
 * Whether POS sales deduct ingredient stock via BOMs.
 * Default OFF — this is an informal business that doesn't strictly track
 * ingredient usage yet. The OWNER turns this on in Settings once recipes
 * (BOMs) and stock counts are entered. When ON, the sale path still uses
 * allow-but-flag (a stale count never blocks a sale; negative shows as
 * "Oversold" in Inventory).
 */
export async function isInventoryTrackingEnabled(): Promise<boolean> {
  return (await getSetting('inventory_tracking', 'false')) === 'true';
}

/**
 * Whether tapping a dish on the register opens the options sheet (protein,
 * spice level, extras) instead of dropping it straight into the ticket.
 *
 * Default OFF. The shop sells a short, fixed menu at speed and rarely takes
 * special requests, so a sheet between every tap and the ticket is friction,
 * not service. With it off, a dish with a *required* group is still added
 * with that group's default choice, so the kitchen never receives a ticket
 * missing an answer it needs — and a one-off request is handled by the note
 * on the cart line.
 *
 * The OWNER turns this on in Settings once special requests are common
 * enough to be worth a tap on every sale.
 */
export async function arePosModifiersEnabled(): Promise<boolean> {
  return (await getSetting('pos_modifiers_enabled', 'false')) === 'true';
}
