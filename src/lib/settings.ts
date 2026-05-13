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
