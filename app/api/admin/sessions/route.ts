import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { requireResource } from '@/src/lib/api-auth';

// GET /api/admin/sessions — recent POS shifts for order filtering
export async function GET(req: NextRequest) {
  const authResult = await requireResource('orders');
  if (authResult instanceof NextResponse) return authResult;

  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '30'), 100);

  const sessions = await prisma.posSession.findMany({
    orderBy: { openedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      openedAt: true,
      closedAt: true,
      status: true,
      openingFloat: true,
      openedByUser: { select: { name: true } },
      _count: { select: { orders: true } },
    },
  });

  return NextResponse.json({ sessions });
}
