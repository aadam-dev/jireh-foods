import { prisma } from './prisma';

/**
 * Write an audit log entry. Never throws — audit must not crash the main operation.
 */
export async function logAudit({
  userId,
  action,
  entity,
  entityId,
  details,
  req,
}: {
  userId?: string | null;
  action: string;           // e.g. 'CREATE', 'UPDATE', 'DELETE', 'VOID'
  entity: string;           // e.g. 'Order', 'Expense', 'User'
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  req?: { headers: { get(name: string): string | null } };
}) {
  try {
    const ipAddress = req
      ? (req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? undefined)
      : undefined;

    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        details: details ? (details as any) : undefined,
        ipAddress,
      },
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}
