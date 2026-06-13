import { NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { getSetting } from '@/src/lib/settings';

const RECEIPT_KEYS = [
  'business_name',
  'business_phone',
  'business_address',
  'receipt_header',
  'receipt_footer',
  'tax_rate',
] as const;

/** Cashier-safe receipt settings for POS printing. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const entries = await Promise.all(
    RECEIPT_KEYS.map(async (key) => [key, await getSetting(key, '')] as const),
  );
  return NextResponse.json(Object.fromEntries(entries));
}
