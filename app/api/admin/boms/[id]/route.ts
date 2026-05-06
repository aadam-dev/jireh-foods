import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['OWNER', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { notes, lines } = body;

  const bom = await prisma.bom.update({
    where: { id: params.id },
    data: {
      notes: notes ?? null,
      updatedAt: new Date(),
      lines: {
        deleteMany: {},
        create: lines.map((l: any) => ({
          inventoryItemId: l.inventoryItemId,
          quantity: parseFloat(l.quantity),
          unit: l.unit,
        })),
      },
    },
    include: {
      menuItem: { select: { id: true, name: true } },
      lines: { include: { inventoryItem: { select: { id: true, name: true, unit: true } } } },
    },
  });

  return NextResponse.json(bom);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['OWNER', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.bom.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
