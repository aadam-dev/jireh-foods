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

const ITEMS = [
  { id: 'food-chicken-only', name: 'Chicken Only', price: 10.0, costPrice: 4.0, description: 'One piece of chicken — grilled or fried.', tags: ['chicken', 'extra'] },
  { id: 'food-jollof-only-sm', name: 'Jollof Rice Only — Small', price: 30.0, costPrice: 12.0, description: 'Rice only, no chicken.', tags: ['jollof', 'rice'] },
  { id: 'food-jollof-only-md', name: 'Jollof Rice Only — Medium', price: 45.0, costPrice: 18.0, description: 'Rice only, no chicken.', tags: ['jollof', 'rice'] },
  { id: 'food-jollof-only-lg', name: 'Jollof Rice Only — Large', price: 55.0, costPrice: 24.0, description: 'Rice only, no chicken.', tags: ['jollof', 'rice'] },
  { id: 'food-asian-only-sm', name: 'Asian Fried Rice Only — Small', price: 30.0, costPrice: 12.0, description: 'Rice only, no chicken.', tags: ['rice', 'asian'] },
  { id: 'food-asian-only-md', name: 'Asian Fried Rice Only — Medium', price: 45.0, costPrice: 18.0, description: 'Rice only, no chicken.', tags: ['rice', 'asian'] },
  { id: 'food-asian-only-lg', name: 'Asian Fried Rice Only — Large', price: 55.0, costPrice: 24.0, description: 'Rice only, no chicken.', tags: ['rice', 'asian'] },
];

async function main() {
  const foodCat = await prisma.menuCategory.findUnique({ where: { slug: 'food' } });
  if (!foodCat) {
    throw new Error("No 'food' category found — run `npm run db:seed` on a fresh database first.");
  }

  let created = 0;
  let skipped = 0;

  for (const item of ITEMS) {
    const existing = await prisma.menuItem.findUnique({ where: { id: item.id } });
    if (existing) {
      console.log(`↷ ${item.name} — already there, left untouched`);
      skipped++;
      continue;
    }
    await prisma.menuItem.create({
      data: { ...item, categoryId: foodCat.id },
    });
    console.log(`✅ ${item.name} — GH₵${item.price.toFixed(2)}`);
    created++;
  }

  console.log(`\n${created} added, ${skipped} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
