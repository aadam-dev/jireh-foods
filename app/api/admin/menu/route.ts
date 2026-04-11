import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { slugify } from '@/src/lib/utils';

const categorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

const itemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  costPrice: z.number().optional(),
  image: z.string().optional(),
  isAvailable: z.boolean().default(true),
  isPopular: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  sortOrder: z.number().default(0),
  type: z.literal('item'),
});

const createCategorySchema = z.object({
  type: z.literal('category'),
  name: z.string().min(1),
  sortOrder: z.number().default(0),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categories = await prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  if (body.type === 'category') {
    const data = createCategorySchema.parse(body);
    const cat = await prisma.menuCategory.create({
      data: { name: data.name, slug: slugify(data.name), sortOrder: data.sortOrder },
    });
    return NextResponse.json(cat);
  }

  // item
  const data = itemSchema.parse(body);
  const item = await prisma.menuItem.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      price: data.price,
      costPrice: data.costPrice,
      image: data.image,
      isAvailable: data.isAvailable,
      isPopular: data.isPopular,
      tags: data.tags,
      sortOrder: data.sortOrder,
    },
  });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id, type, ...updates } = body;

  if (type === 'category') {
    const cat = await prisma.menuCategory.update({
      where: { id },
      data: { ...updates, ...(updates.name ? { slug: slugify(updates.name) } : {}) },
    });
    return NextResponse.json(cat);
  }

  const item = await prisma.menuItem.update({ where: { id }, data: updates });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  if (type === 'category') {
    await prisma.menuCategory.delete({ where: { id } });
  } else {
    await prisma.menuItem.delete({ where: { id } });
  }
  return NextResponse.json({ success: true });
}
