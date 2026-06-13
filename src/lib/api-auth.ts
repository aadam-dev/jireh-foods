import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';
import { UserRole, Prisma } from '@prisma/client';
import { auth } from '@/src/lib/auth';
import { rolesForResource } from '@/src/lib/permissions';

export async function requireAuth(): Promise<
  { session: Session; user: Session['user'] & { id: string; role: UserRole } } | NextResponse
> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = session.user as Session['user'] & { id?: string; role?: UserRole };
  if (!user.id || !user.role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return { session, user: user as Session['user'] & { id: string; role: UserRole } };
}

export function requireRoles(
  userRole: UserRole,
  allowed: UserRole[],
): NextResponse | null {
  if (!allowed.includes(userRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function requireResource(
  resource: string,
): Promise<
  { session: Session; user: Session['user'] & { id: string; role: UserRole } } | NextResponse
> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, rolesForResource(resource));
  if (forbidden) return forbidden;
  return authResult;
}

/** Apply a signed quantity delta and reject if stock would go negative. */
export async function applyInventoryDelta(
  tx: Prisma.TransactionClient,
  itemId: string,
  delta: number,
): Promise<void> {
  const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error('Item not found');
  const nextQty = Number(item.quantity) + delta;
  if (nextQty < 0) {
    throw Object.assign(new Error(`Insufficient stock for ${item.name}`), { status: 409 });
  }
  await tx.inventoryItem.update({
    where: { id: itemId },
    data: { quantity: { increment: delta } },
  });
}
