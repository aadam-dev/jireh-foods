import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Jireh Natural Foods database...');

  // Owner account
  const hashedPassword = await bcrypt.hash('jireh2024!', 12);
  const owner = await prisma.user.upsert({
    where: { email: 'admin@jireh.com' },
    update: {},
    create: {
      name: 'Jireh Admin',
      email: 'admin@jireh.com',
      password: hashedPassword,
      role: UserRole.OWNER,
      isActive: true,
    },
  });
  console.log('✅ Owner account:', owner.email);

  // Cashier account
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@jireh.com' },
    update: {},
    create: {
      name: 'Ama Asante',
      email: 'cashier@jireh.com',
      password: await bcrypt.hash('cashier123', 12),
      role: UserRole.CASHIER,
      isActive: true,
    },
  });
  console.log('✅ Cashier account:', cashier.email);

  // Menu categories
  const foodCat = await prisma.menuCategory.upsert({
    where: { slug: 'food' },
    update: {},
    create: { name: 'Food', slug: 'food', sortOrder: 1 },
  });

  const juiceCat = await prisma.menuCategory.upsert({
    where: { slug: 'juices' },
    update: {},
    create: { name: 'Juices', slug: 'juices', sortOrder: 2 },
  });
  console.log('✅ Categories created');

  // Food — one POS line per size (matches public menu)
  const foodItems = [
    { id: 'food-jollof-sm', name: 'Jollof Rice — Small', price: 40.0, costPrice: 16.0, description: 'With grilled or fried chicken.', tags: ['jollof', 'rice'] },
    { id: 'food-jollof-md', name: 'Jollof Rice — Medium', price: 55.0, costPrice: 22.0, description: 'With grilled or fried chicken.', isPopular: true, tags: ['jollof', 'rice'] },
    { id: 'food-jollof-lg', name: 'Jollof Rice — Large', price: 65.0, costPrice: 28.0, description: 'With grilled or fried chicken.', isPopular: true, tags: ['jollof', 'rice'] },
    { id: 'food-asian-sm', name: 'Asian Fried Rice — Small', price: 40.0, costPrice: 16.0, description: 'With grilled or fried chicken.', tags: ['rice', 'asian'] },
    { id: 'food-asian-md', name: 'Asian Fried Rice — Medium', price: 55.0, costPrice: 22.0, description: 'With grilled or fried chicken.', tags: ['rice', 'asian'] },
    { id: 'food-asian-lg', name: 'Asian Fried Rice — Large', price: 65.0, costPrice: 28.0, description: 'With grilled or fried chicken.', tags: ['rice', 'asian'] },
    { id: 'food-fries', name: 'Fries with Chicken', price: 60.0, costPrice: 24.0, description: 'Crispy potato fries with fried chicken.', tags: ['chicken', 'fried'] },
    { id: 'food-fufu-md', name: 'Fufu — Medium', price: 50.0, costPrice: 20.0, description: 'With meat / goat light soup.', tags: ['fufu', 'traditional'] },
    { id: 'food-fufu-lg', name: 'Fufu — Large', price: 60.0, costPrice: 25.0, description: 'With meat / goat light soup.', isPopular: true, tags: ['fufu', 'traditional'] },
    { id: 'food-banku-md', name: 'Banku — Medium', price: 40.0, costPrice: 15.0, description: 'With okro stew or groundnut soup.', tags: ['banku', 'traditional'] },
    { id: 'food-banku-lg', name: 'Banku — Large', price: 50.0, costPrice: 19.0, description: 'With okro stew or groundnut soup.', tags: ['banku', 'traditional'] },
  ];

  for (const item of foodItems) {
    const { id, isPopular, ...rest } = item;
    await prisma.menuItem.upsert({
      where: { id },
      update: { ...rest, isPopular: isPopular ?? false },
      create: {
        id,
        categoryId: foodCat.id,
        ...rest,
        isPopular: isPopular ?? false,
      },
    });
  }

  // Juice items
  const juiceItems = [
    { name: 'Sobolo', price: 10.0, costPrice: 3.0, description: 'Hibiscus flower drink — deep ruby red, tart and sweet.', isPopular: true, tags: ['natural', 'herbal'] },
    { name: 'Millet Drink', price: 10.0, costPrice: 3.0, description: 'Smooth, lightly spiced millet drink. A Ghanaian classic.', tags: ['traditional', 'natural'] },
    { name: 'Pineapple Drink', price: 10.0, costPrice: 4.0, description: 'Freshly blended pineapple juice — sweet and tropical.', isPopular: true, tags: ['fresh', 'tropical', 'juice'] },
  ];

  for (const item of juiceItems) {
    await prisma.menuItem.upsert({
      where: { id: `juice-${item.name.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}` },
      update: {},
      create: {
        id: `juice-${item.name.toLowerCase().replace(/\s+/g, '-').slice(0, 20)}`,
        categoryId: juiceCat.id,
        ...item,
        price: item.price,
        costPrice: item.costPrice,
      },
    });
  }
  console.log('✅ Menu items seeded');

  // Expense categories
  const expenseCategories = [
    'Ingredients & Food Supplies',
    'Utilities (Water, Electricity, Gas)',
    'Staff Wages',
    'Packaging & Disposables',
    'Cleaning Supplies',
    'Equipment & Maintenance',
    'Marketing & Advertising',
    'Rent',
    'Miscellaneous',
  ];
  for (const name of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { id: `cat-${name.slice(0, 20).toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `cat-${name.slice(0, 20).toLowerCase().replace(/\s+/g, '-')}`,
        name,
      },
    });
  }
  console.log('✅ Expense categories seeded');

  // Settings
  const settings = [
    { key: 'restaurant_name', value: 'Jireh Natural Foods' },
    { key: 'restaurant_phone', value: '055 113 3481' },
    { key: 'restaurant_email', value: 'jirehnaturalfoodsgh@gmail.com' },
    { key: 'restaurant_address', value: 'Adenta Housing Down, Accra, Ghana' },
    { key: 'currency', value: 'GH₵' },
    { key: 'opening_time', value: '11:00' },
    { key: 'closing_time', value: '20:00' },
  ];
  for (const s of settings) {
    await prisma.settings.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }
  console.log('✅ Settings seeded');

  console.log('\n🎉 Database seeded successfully!');
  console.log('   Login: admin@jireh.com / jireh2024!');
  console.log('   Cashier: cashier@jireh.com / cashier123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
