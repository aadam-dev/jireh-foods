import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { requireResource } from '@/src/lib/api-auth';

export async function GET(req: NextRequest) {
  const authResult = await requireResource('orders');
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const source = searchParams.get('source');
  const sessionId = searchParams.get('sessionId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '30');

  const where: any = { isDemo: false }; // never surface IT demo orders in admin
  if (status && status !== 'ALL') where.status = status;
  if (source && source !== 'ALL') where.source = source;
  if (sessionId && sessionId !== 'ALL') where.sessionId = sessionId;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        staff: { select: { name: true } },
        session: {
          select: {
            id: true,
            openedAt: true,
            closedAt: true,
            status: true,
            openedByUser: { select: { name: true } },
          },
        },
        items: {
          include: { menuItem: { select: { name: true } } },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ orders, total, page, limit });
}
