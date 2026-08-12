import { NextRequest, NextResponse } from 'next/server';
import { getSetting, setSetting } from '@/src/lib/settings';
import { logAudit } from '@/src/lib/audit';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles } from '@/src/lib/api-auth';

// All settings keys the UI is allowed to read/write
const PUBLIC_KEYS = [
  'business_name',
  'business_phone',
  'business_address',
  'currency_symbol',
  'gra_tin',
  'tax_rate',
  'low_stock_alert_threshold', // GH₵ amount below which alerts fire
  'receipt_header',   // tagline printed under business name on receipt
  'receipt_footer',
  'inventory_tracking', // 'true' | 'false' — gate BOM stock deduction on POS sales
  'pos_modifiers_enabled', // 'true' | 'false' — open the options sheet on tile tap
] as const;

/** Keys whose value must be exactly 'true' or 'false'. */
const BOOLEAN_KEYS: ReadonlySet<string> = new Set([
  'inventory_tracking',
  'pos_modifiers_enabled',
]);

const upsertSchema = z.object({
  key: z.enum(PUBLIC_KEYS),
  value: z.string().max(500),
});

// GET /api/admin/settings — returns all public keys as { key: value } map
export async function GET() {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER]);
  if (forbidden) return forbidden;

  try {
    const entries = await Promise.all(
      PUBLIC_KEYS.map(async (key) => [key, await getSetting(key, '')] as const),
    );
    return NextResponse.json(Object.fromEntries(entries));
  } catch (err) {
    console.error('[settings GET]', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

// PATCH /api/admin/settings — upsert a single key (OWNER only)
export async function PATCH(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER]);
  if (forbidden) return forbidden;
  const session = authResult;

  try {
    const body = await req.json();
    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { key, value } = parsed.data;

    // Validate tax_rate is a valid number in range
    if (key === 'tax_rate') {
      const n = parseFloat(value);
      if (isNaN(n) || n < 0 || n > 1) {
        return NextResponse.json({ error: 'tax_rate must be a number between 0 and 1 (e.g. 0.15 for 15%)' }, { status: 400 });
      }
    }

    // Boolean-valued settings must be exactly 'true' or 'false'
    if (BOOLEAN_KEYS.has(key) && value !== 'true' && value !== 'false') {
      return NextResponse.json({ error: `${key} must be 'true' or 'false'` }, { status: 400 });
    }

    const setting = await setSetting(key, value);

    await logAudit({
      userId: authResult.user.id,
      action: 'UPDATE',
      entity: 'Settings',
      entityId: key,
      details: { key, value },
      req,
    });

    return NextResponse.json(setting);
  } catch (err) {
    console.error('[settings PATCH]', err);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
