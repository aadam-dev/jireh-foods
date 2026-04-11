// Seeds the database via Supabase Management API (bypasses direct DB port restrictions)
import bcrypt from 'bcryptjs';

const PROJECT_REF = 'oflraijzxczmzbkshfpe';
const PAT = 'REDACTED';

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json();
  if (data.message) throw new Error(data.message);
  return data;
}

function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

async function main() {
  console.log('🌱 Seeding Jireh Natural Foods via Supabase API...\n');

  // ── Users ──────────────────────────────────────────────────────
  const ownerHash = await bcrypt.hash('jireh2024!', 12);
  const cashierHash = await bcrypt.hash('cashier123', 12);

  await sql(`
    INSERT INTO "User" (id, name, email, password, role, "isActive", "passwordResetRequired", "createdAt", "updatedAt")
    VALUES
      ('user_owner_jireh', 'Jireh Admin', 'admin@jireh.com', ${esc(ownerHash)}, 'OWNER', true, false, NOW(), NOW()),
      ('user_cashier_ama', 'Ama Asante', 'cashier@jireh.com', ${esc(cashierHash)}, 'CASHIER', true, false, NOW(), NOW())
    ON CONFLICT (email) DO NOTHING;
  `);
  console.log('✅ Users seeded');
  console.log('   admin@jireh.com / jireh2024!');
  console.log('   cashier@jireh.com / cashier123');

  // ── Menu Categories ────────────────────────────────────────────
  await sql(`
    INSERT INTO "MenuCategory" (id, name, slug, "sortOrder", "isActive", "createdAt", "updatedAt")
    VALUES
      ('cat_food', 'Food', 'food', 1, true, NOW(), NOW()),
      ('cat_juices', 'Juices', 'juices', 2, true, NOW(), NOW())
    ON CONFLICT (slug) DO NOTHING;
  `);
  console.log('✅ Menu categories seeded');

  // ── Food Items ─────────────────────────────────────────────────
  const foodItems = [
    { id: 'item_asian_fried_rice',   name: 'Asian Fried Rice with Grilled Chicken',  price: 80.00,  cost: 35.00, desc: 'Aromatic fried rice topped with perfectly grilled chicken. A crowd favourite.', popular: true,  tags: ['rice','chicken','popular'] },
    { id: 'item_seafood_fried_rice', name: 'Sea Food Fried Rice',                    price: 120.00, cost: 55.00, desc: 'Loaded with fresh seafood — shrimp, fish, and calamari over fragrant fried rice.', popular: true,  tags: ['rice','seafood'] },
    { id: 'item_jollof_chicken',     name: 'Jollof Rice with Grilled Chicken',       price: 65.00,  cost: 28.00, desc: 'Our signature smoky Jollof rice paired with juicy grilled chicken.', popular: true,  tags: ['rice','chicken','local'] },
    { id: 'item_yam_palava',         name: 'Boiled Yam with Palava Sauce',           price: 49.00,  cost: 18.00, desc: 'Tender boiled yam served with rich, hearty palava sauce.', popular: false, tags: ['yam','vegetarian','local'] },
    { id: 'item_japanese_chicken',   name: 'Japanese Fried Chicken',                 price: 60.00,  cost: 25.00, desc: 'Crispy, seasoned fried chicken with a Japanese-inspired marinade.', popular: true,  tags: ['chicken','fried'] },
    { id: 'item_coriander_coleslaw', name: 'Coriander Coleslaw',                     price: 60.00,  cost: 20.00, desc: 'Fresh, crunchy coleslaw tossed with aromatic coriander dressing.', popular: false, tags: ['salad','vegetarian','fresh'] },
    { id: 'item_banku_okro',         name: 'Banku with Okro Stew or Groundnut Soup', price: 40.00,  cost: 15.00, desc: 'Traditional Ghanaian banku with your choice of okro stew or groundnut soup.', popular: false, tags: ['local','traditional'] },
    { id: 'item_fufu_goat',          name: 'Fufu with Meat, Goat Light Soup',        price: 60.00,  cost: 25.00, desc: 'Hand-pounded fufu in a light, flavourful goat soup with tender meat pieces.', popular: false, tags: ['local','traditional','goat'] },
  ];

  const foodValues = foodItems.map((item, i) =>
    `(${esc(item.id)}, 'cat_food', ${esc(item.name)}, ${esc(item.desc)}, ${item.price}, ${item.cost}, true, ${item.popular}, ARRAY[${item.tags.map(t => esc(t)).join(',')}], ${i}, NOW(), NOW())`
  ).join(',\n');

  await sql(`
    INSERT INTO "MenuItem" (id, "categoryId", name, description, price, "costPrice", "isAvailable", "isPopular", tags, "sortOrder", "createdAt", "updatedAt")
    VALUES ${foodValues}
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✅ Food menu items seeded (8 items)');

  // ── Juice Items ────────────────────────────────────────────────
  const juiceItems = [
    { id: 'item_brukina',   name: 'Brukina',        price: 15.00, cost: 5.00,  desc: 'Traditional Ghanaian fermented millet drink. Refreshing and nutritious.', popular: false, tags: ['traditional','dairy-free'] },
    { id: 'item_sobolo',    name: 'Sobolo',          price: 10.00, cost: 3.00,  desc: 'Hibiscus flower drink — deep ruby red, tart and sweet.', popular: true,  tags: ['natural','herbal'] },
    { id: 'item_millet',    name: 'Millet Drink',    price: 10.00, cost: 3.00,  desc: 'Smooth, lightly spiced millet drink. A Ghanaian classic.', popular: false, tags: ['traditional','natural'] },
    { id: 'item_pineapple', name: 'Pineapple Drink', price: 10.00, cost: 4.00,  desc: 'Freshly blended pineapple juice — sweet and tropical.', popular: true,  tags: ['fresh','tropical','juice'] },
  ];

  const juiceValues = juiceItems.map((item, i) =>
    `(${esc(item.id)}, 'cat_juices', ${esc(item.name)}, ${esc(item.desc)}, ${item.price}, ${item.cost}, true, ${item.popular}, ARRAY[${item.tags.map(t => esc(t)).join(',')}], ${i}, NOW(), NOW())`
  ).join(',\n');

  await sql(`
    INSERT INTO "MenuItem" (id, "categoryId", name, description, price, "costPrice", "isAvailable", "isPopular", tags, "sortOrder", "createdAt", "updatedAt")
    VALUES ${juiceValues}
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✅ Juices menu items seeded (4 items)');

  // ── Expense Categories ─────────────────────────────────────────
  const expCats = [
    ['ecat_ingredients',  'Ingredients & Food Supplies'],
    ['ecat_utilities',    'Utilities (Water, Electricity, Gas)'],
    ['ecat_wages',        'Staff Wages'],
    ['ecat_packaging',    'Packaging & Disposables'],
    ['ecat_cleaning',     'Cleaning Supplies'],
    ['ecat_equipment',    'Equipment & Maintenance'],
    ['ecat_marketing',    'Marketing & Advertising'],
    ['ecat_rent',         'Rent'],
    ['ecat_misc',         'Miscellaneous'],
  ];

  const expCatValues = expCats.map(([id, name]) =>
    `(${esc(id)}, ${esc(name)}, true, NOW())`
  ).join(',\n');

  await sql(`
    INSERT INTO "ExpenseCategory" (id, name, "isActive", "createdAt")
    VALUES ${expCatValues}
    ON CONFLICT (id) DO NOTHING;
  `);
  console.log('✅ Expense categories seeded (9 categories)');

  // ── Settings ───────────────────────────────────────────────────
  const settings = [
    ['restaurant_name',    'Jireh Natural Foods'],
    ['restaurant_phone',   '055 113 3481'],
    ['restaurant_email',   'jirehnaturalfoodsgh@gmail.com'],
    ['restaurant_address', 'Adenta Housing Down, Accra, Ghana'],
    ['currency',           'GH₵'],
    ['opening_time',       '09:00'],
    ['closing_time',       '20:30'],
  ];

  const settingValues = settings.map(([key, value]) =>
    `(gen_random_uuid()::text, ${esc(key)}, ${esc(value)}, NOW())`
  ).join(',\n');

  await sql(`
    INSERT INTO "Settings" (id, key, value, "updatedAt")
    VALUES ${settingValues}
    ON CONFLICT (key) DO NOTHING;
  `);
  console.log('✅ Settings seeded');

  // ── Verify ─────────────────────────────────────────────────────
  const counts = await sql(`
    SELECT
      (SELECT COUNT(*) FROM "User") AS users,
      (SELECT COUNT(*) FROM "MenuCategory") AS categories,
      (SELECT COUNT(*) FROM "MenuItem") AS items,
      (SELECT COUNT(*) FROM "ExpenseCategory") AS expense_cats,
      (SELECT COUNT(*) FROM "Settings") AS settings;
  `);

  console.log('\n📊 Database verification:');
  const row = counts[0];
  console.log(`   Users: ${row.users}`);
  console.log(`   Menu categories: ${row.categories}`);
  console.log(`   Menu items: ${row.items}`);
  console.log(`   Expense categories: ${row.expense_cats}`);
  console.log(`   Settings: ${row.settings}`);

  console.log('\n🎉 Supabase fully seeded and ready!');
  console.log('   🔑 admin@jireh.com / jireh2024!');
  console.log('   🔑 cashier@jireh.com / cashier123');
}

main().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
