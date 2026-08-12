/**
 * Adds the quick-sale menu lines — chicken on its own, and the plain
 * no-chicken plates — to an existing database.
 *
 *   npx tsx prisma/add-quick-sale-items.ts
 *
 * Deliberately narrower than `prisma/seed.ts`: that script upserts every menu
 * item and would overwrite prices edited since in the admin panel. This one
 * only ever *creates*. An item that already exists is left exactly as it is,
 * so the script is safe to run twice, and safe to run on production.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* Each plain plate is the same dish as one that already exists, minus the
   chicken, so it should wear the same photograph. `inheritFrom` points at that
   parent: on a real till that resolves to the owner's own uploaded photo,
   which no path hardcoded here could ever match. `fallbackImage` is only
   reached when the parent has no photo either — a fresh test database.

   Chicken Only deliberately has neither. The repo's food photos are all full
   plates, and a whole-plate picture on a single-piece line item is worse than
   no picture. It stays blank until someone uploads a real one in
   Admin → Menu. */
const ITEMS: {
  id: string; name: string; price: number; costPrice: number;
  description: string; tags: string[]; sortOrder: number;
  inheritFrom?: string; fallbackImage?: string;
}[] = [
  { id: 'food-chicken-only', name: 'Chicken Only', price: 10.0, costPrice: 4.0, description: 'One piece of chicken — grilled or fried.', sortOrder: 130, tags: ['chicken', 'extra'] },
  { id: 'food-jollof-only-sm', name: 'Jollof Rice Only — Small', price: 30.0, costPrice: 12.0, description: 'Rice only, no chicken.', sortOrder: 40, tags: ['jollof', 'rice'], inheritFrom: 'food-jollof-sm', fallbackImage: '/jireh/food1.jpg' },
  { id: 'food-jollof-only-md', name: 'Jollof Rice Only — Medium', price: 45.0, costPrice: 18.0, description: 'Rice only, no chicken.', sortOrder: 50, tags: ['jollof', 'rice'], inheritFrom: 'food-jollof-md', fallbackImage: '/jireh/food1.jpg' },
  { id: 'food-jollof-only-lg', name: 'Jollof Rice Only — Large', price: 55.0, costPrice: 24.0, description: 'Rice only, no chicken.', sortOrder: 60, tags: ['jollof', 'rice'], inheritFrom: 'food-jollof-lg', fallbackImage: '/jireh/food1.jpg' },
  { id: 'food-asian-only-sm', name: 'Asian Fried Rice Only — Small', price: 30.0, costPrice: 12.0, description: 'Rice only, no chicken.', sortOrder: 100, tags: ['rice', 'asian'], inheritFrom: 'food-asian-sm', fallbackImage: '/jireh/food2.jpg' },
  { id: 'food-asian-only-md', name: 'Asian Fried Rice Only — Medium', price: 45.0, costPrice: 18.0, description: 'Rice only, no chicken.', sortOrder: 110, tags: ['rice', 'asian'], inheritFrom: 'food-asian-md', fallbackImage: '/jireh/food2.jpg' },
  { id: 'food-asian-only-lg', name: 'Asian Fried Rice Only — Large', price: 55.0, costPrice: 24.0, description: 'Rice only, no chicken.', sortOrder: 120, tags: ['rice', 'asian'], inheritFrom: 'food-asian-lg', fallbackImage: '/jireh/food2.jpg' },
];

async function main() {
  const foodCat = await prisma.menuCategory.findUnique({ where: { slug: 'food' } });
  if (!foodCat) {
    throw new Error("No 'food' category found — run `npm run db:seed` on a fresh database first.");
  }

  let created = 0;
  let skipped = 0;

  for (const item of ITEMS) {
    const { inheritFrom, fallbackImage, ...fields } = item;

    const existing = await prisma.menuItem.findUnique({ where: { id: item.id } });
    if (existing) {
      console.log(`↷ ${item.name} — already there, left untouched`);
      skipped++;
      continue;
    }

    // Take the parent dish's photo where there is one, so the new line looks
    // like the rest of the menu instead of a gap in it.
    let image: string | null = null;
    let source = 'no photo';
    if (inheritFrom) {
      const parent = await prisma.menuItem.findUnique({
        where: { id: inheritFrom },
        select: { image: true },
      });
      if (parent?.image) {
        image = parent.image;
        source = `photo from ${inheritFrom}`;
      } else if (fallbackImage) {
        image = fallbackImage;
        source = 'bundled photo';
      }
    }

    await prisma.menuItem.create({
      data: { ...fields, image, categoryId: foodCat.id },
    });
    console.log(`✅ ${item.name} — GH₵${item.price.toFixed(2)} · ${source}`);
    created++;
  }

  console.log(`\n${created} added, ${skipped} already present.`);
  if (created > 0) {
    console.log('\nChicken Only has no photo — add one in Admin → Menu.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
