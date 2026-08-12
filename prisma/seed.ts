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
    { id: 'food-jollof-sm', name: 'Jollof Rice — Small', price: 40.0, costPrice: 16.0, description: 'With grilled or fried chicken.', image: '/jireh/food1.jpg', sortOrder: 10, tags: ['jollof', 'rice'] },
    { id: 'food-jollof-md', name: 'Jollof Rice — Medium', price: 55.0, costPrice: 22.0, description: 'With grilled or fried chicken.', image: '/jireh/food1.jpg', isPopular: true, sortOrder: 20, tags: ['jollof', 'rice'] },
    { id: 'food-jollof-lg', name: 'Jollof Rice — Large', price: 65.0, costPrice: 28.0, description: 'With grilled or fried chicken.', image: '/jireh/food1.jpg', isPopular: true, sortOrder: 30, tags: ['jollof', 'rice'] },
    { id: 'food-asian-sm', name: 'Asian Fried Rice — Small', price: 40.0, costPrice: 16.0, description: 'With grilled or fried chicken.', image: '/jireh/food2.jpg', sortOrder: 70, tags: ['rice', 'asian'] },
    { id: 'food-asian-md', name: 'Asian Fried Rice — Medium', price: 55.0, costPrice: 22.0, description: 'With grilled or fried chicken.', image: '/jireh/food2.jpg', sortOrder: 80, tags: ['rice', 'asian'] },
    { id: 'food-asian-lg', name: 'Asian Fried Rice — Large', price: 65.0, costPrice: 28.0, description: 'With grilled or fried chicken.', image: '/jireh/food2.jpg', sortOrder: 90, tags: ['rice', 'asian'] },
    { id: 'food-fries', name: 'Fries with Chicken', price: 60.0, costPrice: 24.0, description: 'Crispy potato fries with fried chicken.', sortOrder: 140, tags: ['chicken', 'fried'] },
    /* Plain plates + chicken sold separately, so the common combinations are
       two taps on the register instead of a dialog. Priced so that
       "rice only" + "chicken only" lands on the same total as the plate that
       already includes chicken. */
    { id: 'food-chicken-only', name: 'Chicken Only', price: 10.0, costPrice: 4.0, description: 'One piece of chicken — grilled or fried.', sortOrder: 130, tags: ['chicken', 'extra'] },
    { id: 'food-jollof-only-sm', name: 'Jollof Rice Only — Small', price: 30.0, costPrice: 12.0, description: 'Rice only, no chicken.', image: '/jireh/food1.jpg', sortOrder: 40, tags: ['jollof', 'rice'] },
    { id: 'food-jollof-only-md', name: 'Jollof Rice Only — Medium', price: 45.0, costPrice: 18.0, description: 'Rice only, no chicken.', image: '/jireh/food1.jpg', sortOrder: 50, tags: ['jollof', 'rice'] },
    { id: 'food-jollof-only-lg', name: 'Jollof Rice Only — Large', price: 55.0, costPrice: 24.0, description: 'Rice only, no chicken.', image: '/jireh/food1.jpg', sortOrder: 60, tags: ['jollof', 'rice'] },
    { id: 'food-asian-only-sm', name: 'Asian Fried Rice Only — Small', price: 30.0, costPrice: 12.0, description: 'Rice only, no chicken.', image: '/jireh/food2.jpg', sortOrder: 100, tags: ['rice', 'asian'] },
    { id: 'food-asian-only-md', name: 'Asian Fried Rice Only — Medium', price: 45.0, costPrice: 18.0, description: 'Rice only, no chicken.', image: '/jireh/food2.jpg', sortOrder: 110, tags: ['rice', 'asian'] },
    { id: 'food-asian-only-lg', name: 'Asian Fried Rice Only — Large', price: 55.0, costPrice: 24.0, description: 'Rice only, no chicken.', image: '/jireh/food2.jpg', sortOrder: 120, tags: ['rice', 'asian'] },
    { id: 'food-fufu-md', name: 'Fufu — Medium', price: 50.0, costPrice: 20.0, description: 'With meat / goat light soup.', image: '/jireh/fufu.jpg', sortOrder: 150, tags: ['fufu', 'traditional'] },
    { id: 'food-fufu-lg', name: 'Fufu — Large', price: 60.0, costPrice: 25.0, description: 'With meat / goat light soup.', image: '/jireh/fufu.jpg', isPopular: true, sortOrder: 160, tags: ['fufu', 'traditional'] },
    { id: 'food-banku-md', name: 'Banku — Medium', price: 40.0, costPrice: 15.0, description: 'With okro stew or groundnut soup.', image: '/jireh/banku.jpg', sortOrder: 170, tags: ['banku', 'traditional'] },
    { id: 'food-banku-lg', name: 'Banku — Large', price: 50.0, costPrice: 19.0, description: 'With okro stew or groundnut soup.', image: '/jireh/banku.jpg', sortOrder: 180, tags: ['banku', 'traditional'] },
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
    { name: 'Sobolo', price: 10.0, costPrice: 3.0, description: 'Hibiscus flower drink — deep ruby red, tart and sweet.', image: '/jireh/juice1.jpg', isPopular: true, tags: ['natural', 'herbal'] },
    { name: 'Millet Drink', price: 10.0, costPrice: 3.0, description: 'Smooth, lightly spiced millet drink. A Ghanaian classic.', tags: ['traditional', 'natural'] },
    { name: 'Pineapple Drink', price: 10.0, costPrice: 4.0, description: 'Freshly blended pineapple juice — sweet and tropical.', image: '/jireh/juice2.jpg', isPopular: true, tags: ['fresh', 'tropical', 'juice'] },
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

  // Settings — keys MUST match PUBLIC_KEYS in app/api/admin/settings/route.ts
  // (the Settings UI + POS receipt read these exact keys).
  const settings = [
    { key: 'business_name', value: 'Jireh Natural Foods' },
    { key: 'business_phone', value: '055 113 3481' },
    { key: 'business_address', value: 'Adenta Housing Down, Accra, Ghana' },
    { key: 'currency_symbol', value: 'GH₵' },
    { key: 'tax_rate', value: '0' },
    { key: 'gra_tin', value: '' },
    { key: 'low_stock_alert_threshold', value: '5' },
    { key: 'receipt_header', value: 'Fresh & Healthy — Always' },
    { key: 'receipt_footer', value: 'Thank you for dining with us!' },
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
