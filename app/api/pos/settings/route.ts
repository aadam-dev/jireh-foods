import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { arePosModifiersEnabled, getSetting } from '@/src/lib/settings';

const RECEIPT_KEYS = [
  'business_name',
  'business_phone',
  'business_address',
  'receipt_header',
  'receipt_footer',
  'tax_rate',
] as const;

/** Cashier-safe receipt + register-behaviour settings for the POS. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entries = await Promise.all(
    RECEIPT_KEYS.map(async (key) => [key, await getSetting(key, '')] as const),
  );
  return NextResponse.json({
    ...Object.fromEntries(entries),
    // Sent as a real boolean so the register never has to parse a string to
    // decide whether a tap opens a sheet.
    pos_modifiers_enabled: await arePosModifiersEnabled(),
  });
}
