#!/bin/bash
# Requires: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF (see .env.example)
set -euo pipefail

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" || -z "${SUPABASE_PROJECT_REF:-}" ]]; then
  echo "❌ Set SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (e.g. source .env or export them)." >&2
  exit 1
fi

REF="$SUPABASE_PROJECT_REF"
API="https://api.supabase.com/v1/projects/$REF/database/query"

run_sql() {
  local result
  result=$(curl -s -X POST "$API" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$(printf '%s' "$1" | jq -Rsc '{query: .}')")
  if echo "$result" | jq -e '.message' > /dev/null 2>&1; then
    echo "ERROR: $(echo "$result" | jq -r '.message')" >&2
    exit 1
  fi
  echo "$result"
}

echo "🌱 Seeding Jireh Natural Foods via Supabase API..."
echo ""

# ── Users ──────────────────────────────────────────────────────────────
OWNER_HASH='$2a$12$s.rglgRFRlp4y0Or9eKNb.7ZQluUIuqme3ZAU.NBo/g4354zZeETC'
CASHIER_HASH='$2a$12$VltzYYzWhZM5k30WswF7X.80uL9SdW5Bw2g3vXVzpl7OKoWMERr1q'

run_sql "INSERT INTO \"User\" (id, name, email, password, role, \"isActive\", \"passwordResetRequired\", \"createdAt\", \"updatedAt\")
VALUES
  ('user_owner_jireh', 'Jireh Admin', 'admin@jireh.com', '${OWNER_HASH}', 'OWNER', true, false, NOW(), NOW()),
  ('user_cashier_ama', 'Ama Asante', 'cashier@jireh.com', '${CASHIER_HASH}', 'CASHIER', true, false, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;" > /dev/null
echo "✅ Users seeded (admin@jireh.com / jireh2024!, cashier@jireh.com / cashier123)"

# ── Menu Categories ────────────────────────────────────────────────────
run_sql "INSERT INTO \"MenuCategory\" (id, name, slug, \"sortOrder\", \"isActive\", \"createdAt\", \"updatedAt\")
VALUES
  ('cat_food', 'Food', 'food', 1, true, NOW(), NOW()),
  ('cat_juices', 'Juices', 'juices', 2, true, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;" > /dev/null
echo "✅ Menu categories seeded"

# ── Food Items ─────────────────────────────────────────────────────────
run_sql "INSERT INTO \"MenuItem\" (id, \"categoryId\", name, description, price, \"costPrice\", \"isAvailable\", \"isPopular\", tags, \"sortOrder\", \"createdAt\", \"updatedAt\")
VALUES
  ('item_asian_fried_rice',   'cat_food', 'Asian Fried Rice with Grilled Chicken',  'Aromatic fried rice topped with perfectly grilled chicken. A crowd favourite.', 80.00,  35.00, true, true,  ARRAY['rice','chicken','popular'], 0, NOW(), NOW()),
  ('item_seafood_fried_rice', 'cat_food', 'Sea Food Fried Rice',                    'Loaded with fresh seafood — shrimp, fish, and calamari over fragrant fried rice.', 120.00, 55.00, true, true,  ARRAY['rice','seafood'], 1, NOW(), NOW()),
  ('item_jollof_chicken',     'cat_food', 'Jollof Rice with Grilled Chicken',       'Our signature smoky Jollof rice paired with juicy grilled chicken.', 65.00,  28.00, true, true,  ARRAY['rice','chicken','local'], 2, NOW(), NOW()),
  ('item_yam_palava',         'cat_food', 'Boiled Yam with Palava Sauce',           'Tender boiled yam served with rich, hearty palava sauce.', 49.00,  18.00, true, false, ARRAY['yam','vegetarian','local'], 3, NOW(), NOW()),
  ('item_japanese_chicken',   'cat_food', 'Japanese Fried Chicken',                 'Crispy, seasoned fried chicken with a Japanese-inspired marinade.', 60.00,  25.00, true, true,  ARRAY['chicken','fried'], 4, NOW(), NOW()),
  ('item_coriander_coleslaw', 'cat_food', 'Coriander Coleslaw',                     'Fresh, crunchy coleslaw tossed with aromatic coriander dressing.', 60.00,  20.00, true, false, ARRAY['salad','vegetarian','fresh'], 5, NOW(), NOW()),
  ('item_banku_okro',         'cat_food', 'Banku with Okro Stew or Groundnut Soup', 'Traditional Ghanaian banku with your choice of okro stew or groundnut soup.', 40.00, 15.00, true, false, ARRAY['local','traditional'], 6, NOW(), NOW()),
  ('item_fufu_goat',          'cat_food', 'Fufu with Meat, Goat Light Soup',        'Hand-pounded fufu in a light, flavourful goat soup with tender meat pieces.', 60.00,  25.00, true, false, ARRAY['local','traditional','goat'], 7, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;" > /dev/null
echo "✅ Food items seeded (8 items)"

# ── Juice Items ────────────────────────────────────────────────────────
run_sql "INSERT INTO \"MenuItem\" (id, \"categoryId\", name, description, price, \"costPrice\", \"isAvailable\", \"isPopular\", tags, \"sortOrder\", \"createdAt\", \"updatedAt\")
VALUES
  ('item_brukina',   'cat_juices', 'Brukina',        'Traditional Ghanaian fermented millet drink. Refreshing and nutritious.', 15.00, 5.00, true, false, ARRAY['traditional','dairy-free'], 0, NOW(), NOW()),
  ('item_sobolo',    'cat_juices', 'Sobolo',          'Hibiscus flower drink — deep ruby red, tart and sweet.', 10.00, 3.00, true, true,  ARRAY['natural','herbal'], 1, NOW(), NOW()),
  ('item_millet',    'cat_juices', 'Millet Drink',    'Smooth, lightly spiced millet drink. A Ghanaian classic.', 10.00, 3.00, true, false, ARRAY['traditional','natural'], 2, NOW(), NOW()),
  ('item_pineapple', 'cat_juices', 'Pineapple Drink', 'Freshly blended pineapple juice — sweet and tropical.', 10.00, 4.00, true, true,  ARRAY['fresh','tropical','juice'], 3, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;" > /dev/null
echo "✅ Juices seeded (4 items)"

# ── Expense Categories ─────────────────────────────────────────────────
run_sql "INSERT INTO \"ExpenseCategory\" (id, name, \"isActive\", \"createdAt\")
VALUES
  ('ecat_ingredients', 'Ingredients & Food Supplies',        true, NOW()),
  ('ecat_utilities',   'Utilities (Water, Electricity, Gas)', true, NOW()),
  ('ecat_wages',       'Staff Wages',                        true, NOW()),
  ('ecat_packaging',   'Packaging & Disposables',            true, NOW()),
  ('ecat_cleaning',    'Cleaning Supplies',                  true, NOW()),
  ('ecat_equipment',   'Equipment & Maintenance',            true, NOW()),
  ('ecat_marketing',   'Marketing & Advertising',            true, NOW()),
  ('ecat_rent',        'Rent',                               true, NOW()),
  ('ecat_misc',        'Miscellaneous',                      true, NOW())
ON CONFLICT (id) DO NOTHING;" > /dev/null
echo "✅ Expense categories seeded (9 categories)"

# ── Settings ───────────────────────────────────────────────────────────
run_sql "INSERT INTO \"Settings\" (id, key, value, \"updatedAt\")
VALUES
  (gen_random_uuid()::text, 'restaurant_name',    'Jireh Natural Foods',               NOW()),
  (gen_random_uuid()::text, 'restaurant_phone',   '055 113 3481',                      NOW()),
  (gen_random_uuid()::text, 'restaurant_email',   'jirehnaturalfoodsgh@gmail.com',     NOW()),
  (gen_random_uuid()::text, 'restaurant_address', 'Adenta Housing Down, Accra, Ghana', NOW()),
  (gen_random_uuid()::text, 'currency',           'GH₵',                              NOW()),
  (gen_random_uuid()::text, 'opening_time',       '09:00',                             NOW()),
  (gen_random_uuid()::text, 'closing_time',       '20:30',                             NOW())
ON CONFLICT (key) DO NOTHING;" > /dev/null
echo "✅ Settings seeded"

# ── Verify ─────────────────────────────────────────────────────────────
echo ""
echo "📊 Verifying database..."
COUNTS=$(run_sql "SELECT
  (SELECT COUNT(*) FROM \"User\")            AS users,
  (SELECT COUNT(*) FROM \"MenuCategory\")    AS categories,
  (SELECT COUNT(*) FROM \"MenuItem\")        AS items,
  (SELECT COUNT(*) FROM \"ExpenseCategory\") AS expense_cats,
  (SELECT COUNT(*) FROM \"Settings\")        AS settings;")

echo "   Users:             $(echo "$COUNTS" | jq -r '.[0].users')"
echo "   Menu categories:   $(echo "$COUNTS" | jq -r '.[0].categories')"
echo "   Menu items:        $(echo "$COUNTS" | jq -r '.[0].items')"
echo "   Expense categories:$(echo "$COUNTS" | jq -r '.[0].expense_cats')"
echo "   Settings:          $(echo "$COUNTS" | jq -r '.[0].settings')"

echo ""
echo "🎉 Supabase backend fully seeded and ready!"
echo "   🔑 admin@jireh.com  /  jireh2024!"
echo "   🔑 cashier@jireh.com  /  cashier123"
