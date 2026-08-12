import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';
import { z } from 'zod';
import { slugify } from '@/src/lib/utils';
import { requireResource } from '@/src/lib/api-auth';
import { plateEconomics } from '@/src/lib/plate-economics';

const categorySchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

const itemSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().positive('Price must be greater than zero'),
  // Nullable, not just optional: the form clears a photo or a cost estimate by
  // sending null, and a dish added without a photo sends null for it.
  costPrice: z.number().nonnegative().nullable().optional(),
  image: z.string().nullable().optional(),
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

/* Update payloads are partial — the availability toggle sends one field, the
   edit form sends the lot. Everything is still named explicitly: an unchecked
   spread into prisma.update() lets any caller with a MANAGER token write any
   column, and turns a typo into a 500 instead of a 400. */
const updateItemSchema = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive('Price must be greater than zero').optional(),
  costPrice: z.number().nonnegative().nullable().optional(),
  image: z.string().nullable().optional(),
  isAvailable: z.boolean().optional(),
  isPopular: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

function badRequest(error: z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? 'Invalid input', details: error.flatten() },
    { status: 400 },
  );
}

export async function GET() {
  const authResult = await requireResource('menu');
  if (authResult instanceof NextResponse) return authResult;

  const categories = await prisma.menuCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          // Recipe lines priced at current ingredient cost — the trustworthy
          // input to plate cost. Falls back to costPrice when absent.
          bom: {
            where: { isActive: true },
            include: { lines: { include: { inventoryItem: { select: { costPerUnit: true } } } } },
          },
        },
      },
    },
  });

  // Decimals serialize as strings; coerce and attach plate economics so the
  // menu manager and the register agree on the same numbers.
  const serialized = categories.map(cat => ({
    ...cat,
    items: cat.items.map(item => {
      const economics = plateEconomics({
        price: item.price,
        costPrice: item.costPrice,
        bomLines: item.bom?.lines ?? null,
      });
      const { bom, ...rest } = item;
      return {
        ...rest,
        price: Number(item.price),
        costPrice: item.costPrice != null ? Number(item.costPrice) : null,
        hasRecipe: !!bom,
        economics,
      };
    }),
  }));

  return NextResponse.json(serialized);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();

  try {
    if (body.type === 'category') {
      const parsed = createCategorySchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error);
      const data = parsed.data;
      const cat = await prisma.menuCategory.create({
        data: { name: data.name, slug: slugify(data.name), sortOrder: data.sortOrder },
      });
      return NextResponse.json(cat);
    }

    // item
    const parsed = itemSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    const data = parsed.data;
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
  } catch (err) {
    console.error('[admin/menu POST]', err);
    return NextResponse.json({ error: 'Could not save that. Please try again.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = (session.user as any).role;
  if (!['OWNER', 'MANAGER'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { id, type, ...updates } = body;
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'ID required' }, { status: 400 });
  }

  try {
    if (type === 'category') {
      const parsed = updateCategorySchema.safeParse(updates);
      if (!parsed.success) return badRequest(parsed.error);
      const cat = await prisma.menuCategory.update({
        where: { id },
        data: { ...parsed.data, ...(parsed.data.name ? { slug: slugify(parsed.data.name) } : {}) },
      });
      return NextResponse.json(cat);
    }

    const parsed = updateItemSchema.safeParse(updates);
    if (!parsed.success) return badRequest(parsed.error);
    const item = await prisma.menuItem.update({ where: { id }, data: parsed.data });
    return NextResponse.json(item);
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'That item no longer exists — refresh the page.' }, { status: 404 });
    }
    console.error('[admin/menu PATCH]', err);
    return NextResponse.json({ error: 'Could not save that change. Please try again.' }, { status: 500 });
  }
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

  try {
    if (type === 'category') {
      await prisma.menuCategory.delete({ where: { id } });
    } else {
      await prisma.menuItem.delete({ where: { id } });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Already deleted — refresh the page.' }, { status: 404 });
    }
    /* Sold dishes are referenced by past order lines and cannot be removed
       without rewriting history, which would silently change old receipts and
       reports. Taking it off the menu is what the owner actually wants here. */
    if (err?.code === 'P2003' || err?.code === 'P2014') {
      return NextResponse.json(
        {
          error: type === 'category'
            ? 'This category still has items in it. Move or delete those first.'
            : 'This dish appears on past orders, so it cannot be deleted without changing your sales history. Switch it off instead — it disappears from the register and the website but keeps its price and photo for when you sell it again.',
        },
        { status: 409 },
      );
    }
    console.error('[admin/menu DELETE]', err);
    return NextResponse.json({ error: 'Could not delete that. Please try again.' }, { status: 500 });
  }
}
