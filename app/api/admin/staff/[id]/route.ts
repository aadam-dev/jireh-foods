import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { requireAuth, requireRoles } from '@/src/lib/api-auth';
import { canAssignRole } from '@/src/lib/permissions';

const staffProfileSchema = z.object({
  phone: z.string().optional(),
  hireDate: z.string().optional(),
  salaryType: z.enum(['MONTHLY', 'DAILY', 'HOURLY']).optional(),
  salary: z.coerce.number().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
});

const patchUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['OWNER', 'MANAGER', 'ACCOUNTANT', 'CASHIER', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
  newPassword: z.string().min(6).optional(),
  staffProfile: staffProfileSchema.optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER, UserRole.MANAGER]);
  if (forbidden) return forbidden;

  const body = await req.json();
  const parsed = patchUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Load the *target* user first. Authorization must consider the target's
  // current role, not only the role being assigned — otherwise a MANAGER could
  // reset an OWNER's password / deactivate them by omitting `role` from the body
  // (account takeover / privilege escalation).
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // Only an OWNER may modify another OWNER account (password, email, role, status).
  if (target.role === UserRole.OWNER && authResult.user.role !== UserRole.OWNER) {
    return NextResponse.json({ error: 'Only an owner can modify an owner account' }, { status: 403 });
  }

  if (data.role && !canAssignRole(authResult.user.role, data.role as UserRole)) {
    return NextResponse.json({ error: 'You cannot assign that role' }, { status: 403 });
  }

  const userUpdate: Record<string, unknown> = {};
  if (data.name !== undefined) userUpdate.name = data.name;
  if (data.email !== undefined) userUpdate.email = data.email.toLowerCase();
  if (data.role !== undefined) userUpdate.role = data.role;
  if (data.isActive !== undefined) userUpdate.isActive = data.isActive;
  if (data.newPassword) {
    userUpdate.password = await bcrypt.hash(data.newPassword, 12);
    userUpdate.passwordResetRequired = true;
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...userUpdate,
      ...(data.staffProfile
        ? {
            staffProfile: {
              upsert: {
                create: data.staffProfile,
                update: data.staffProfile,
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
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;
  const forbidden = requireRoles(authResult.user.role, [UserRole.OWNER]);
  if (forbidden) return forbidden;

  await prisma.user.update({ where: { id: params.id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
