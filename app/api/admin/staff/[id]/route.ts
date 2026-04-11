import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import bcrypt from 'bcryptjs';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { staffProfile, newPassword, ...userFields } = body;

  const updates: any = { ...userFields };
  if (newPassword) {
    updates.password = await bcrypt.hash(newPassword, 12);
    updates.passwordResetRequired = true;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...updates,
      ...(staffProfile
        ? {
            staffProfile: {
              upsert: {
                create: staffProfile,
                update: staffProfile,
              },
            },
          }
        : {}),
    },
    include: { staffProfile: true },
  });

  return NextResponse.json({ ...user, password: undefined });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (role !== 'OWNER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Soft delete — deactivate instead
  await prisma.user.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
