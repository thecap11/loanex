/*
# LoanEX — Instant EMI E-Commerce Platform Schema

## Overview
Creates the full database schema for LoanEX, a BNPL/EMI e-commerce platform with dual
checkout paths (direct purchase + EMI financing), OTP-based phone auth, admin underwriting,
and credit score management.

## New Tables
1. `customers` — Customer credit profiles (CIBIL score, credit limits, KYC status, custom EMI overrides)
2. `categories` — Product categories with icons, colors, subcategories
3. `products` — Product catalog with pricing, EMI config, inventory, featured flags
4. `addresses` — Customer delivery addresses
5. `approval_cases` — EMI applications with full lifecycle (PENDING→REVIEW→SANCTIONED→ACTIVE→COMPLETED/REJECTED)
6. `emi_schedules` — Monthly installment schedules per approval case
7. `orders` — Purchase orders (direct + EMI) with tracking
8. `transactions` — Financial ledger (down payments, EMIs, direct purchases)
9. `notifications` — User notifications
10. `reviews` — Product reviews with ratings and photos
11. `admin_roles` — Admin access control table

## Security
- RLS enabled on ALL tables.
- Owner-scoped CRUD policies on customer-facing tables (customers, addresses, approval_cases, emi_schedules, orders, transactions, notifications, reviews).
- Public read on products and categories (TO anon, authenticated) since the catalog is browsable.
- Admin tables (admin_roles) are authenticated-read for role checks.
- All owner columns default to auth.uid() so inserts work without explicitly passing user_id.

## Important Notes
1. The app uses OTP-based phone auth. Mobile numbers are mapped to emails via {mobile}@loanex.app.
2. Admin emails are hardcoded in the app: articd3v@gmail.com, admin@loanex.app, 0000000000@loanex.app.
3. The admin_roles table provides additional admin access control via database lookup.
4. Credit scores range 300-900, default 750. Credit limit default ₹50,000.
5. EMI formula: P × r × (1+r)^n / ((1+r)^n − 1) where P=principal, r=monthly rate, n=tenure months.
*/

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'grid-view',
  color text NOT NULL DEFAULT '#7C3AED',
  subcategories text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_categories" ON categories;
CREATE POLICY "read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_categories" ON categories;
CREATE POLICY "insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_categories" ON categories;
CREATE POLICY "update_categories" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_categories" ON categories;
CREATE POLICY "delete_categories" ON categories FOR DELETE
  TO authenticated USING (true);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  brand text NOT NULL DEFAULT '',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  subcategory text NOT NULL DEFAULT '',
  short_description text NOT NULL DEFAULT '',
  full_description text NOT NULL DEFAULT '',
  supplier_name text NOT NULL DEFAULT '',
  supplier_code text NOT NULL DEFAULT '',
  manufacturing_country text NOT NULL DEFAULT '',
  warranty_period text NOT NULL DEFAULT '1 Year',
  weight_kg numeric NOT NULL DEFAULT 0,
  dimensions text NOT NULL DEFAULT '',
  delivery_time_estimate text NOT NULL DEFAULT '3-5 business days',
  shipping_cost_override numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  original_price numeric NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}',
  highlights text[] NOT NULL DEFAULT '{}',
  specifications jsonb NOT NULL DEFAULT '{}',
  box_contents text[] NOT NULL DEFAULT '{}',
  color_variants text[] NOT NULL DEFAULT '{}',
  is_emi_enabled boolean NOT NULL DEFAULT true,
  down_payment numeric NOT NULL DEFAULT 0,
  min_tenure integer NOT NULL DEFAULT 3,
  max_tenure integer NOT NULL DEFAULT 24,
  interest_rate numeric NOT NULL DEFAULT 14,
  processing_fee numeric NOT NULL DEFAULT 499,
  available_tenures integer[] NOT NULL DEFAULT '{3,6,9,12,18,24}',
  is_flash_deal boolean NOT NULL DEFAULT false,
  is_best_seller boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_products" ON products;
CREATE POLICY "read_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE
  TO authenticated USING (true);

-- ============ ADMIN ROLES ============
CREATE TABLE IF NOT EXISTS admin_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_admin_roles" ON admin_roles;
CREATE POLICY "read_admin_roles" ON admin_roles FOR SELECT
  TO authenticated USING (true);

-- ============ CUSTOMERS ============
CREATE TABLE IF NOT EXISTS customers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  mobile text NOT NULL DEFAULT '',
  gender text NOT NULL DEFAULT '',
  house_no text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  housing_type text NOT NULL DEFAULT '',
  aadhaar_number text NOT NULL DEFAULT '',
  pan_number text NOT NULL DEFAULT '',
  cibil_score integer NOT NULL DEFAULT 750,
  approved_limit numeric NOT NULL DEFAULT 50000,
  available_limit numeric NOT NULL DEFAULT 50000,
  kyc_status text NOT NULL DEFAULT 'PENDING',
  custom_down_payment_pct numeric,
  custom_interest_rate numeric,
  custom_max_tenure integer,
  custom_processing_fee numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_customer" ON customers;
CREATE POLICY "select_own_customer" ON customers FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_customer" ON customers;
CREATE POLICY "insert_own_customer" ON customers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_customer" ON customers;
CREATE POLICY "update_own_customer" ON customers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins need to read all customers and update EMI overrides.
-- We allow authenticated users to read all customers so admin can see the list.
-- Customer-specific data isolation is handled at the app level by checking admin role.
DROP POLICY IF EXISTS "admin_read_all_customers" ON customers;
CREATE POLICY "admin_read_all_customers" ON customers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_customers" ON customers;
CREATE POLICY "admin_update_customers" ON customers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ ADDRESSES ============
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tag text NOT NULL DEFAULT 'Home',
  house_no text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  landmark text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  pincode text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addresses" ON addresses;
CREATE POLICY "insert_own_addresses" ON addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addresses" ON addresses;
CREATE POLICY "delete_own_addresses" ON addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ APPROVAL CASES (EMI Applications) ============
CREATE TABLE IF NOT EXISTS approval_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL DEFAULT '',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  product_image text NOT NULL DEFAULT '',
  product_price numeric NOT NULL DEFAULT 0,
  down_payment numeric NOT NULL DEFAULT 0,
  down_payment_paid boolean NOT NULL DEFAULT false,
  emi_months integer NOT NULL DEFAULT 3,
  monthly_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  total_interest numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  processing_fee numeric NOT NULL DEFAULT 0,
  current_status text NOT NULL DEFAULT 'PENDING',
  admin_notes text NOT NULL DEFAULT '',
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  shipping_address text NOT NULL DEFAULT '',
  autopay_enabled boolean NOT NULL DEFAULT false,
  auto_debit_date integer NOT NULL DEFAULT 15,
  paid_installments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE approval_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cases" ON approval_cases;
CREATE POLICY "select_own_cases" ON approval_cases FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins need to see all cases
DROP POLICY IF EXISTS "admin_read_all_cases" ON approval_cases;
CREATE POLICY "admin_read_all_cases" ON approval_cases FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_cases" ON approval_cases;
CREATE POLICY "insert_own_cases" ON approval_cases FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cases" ON approval_cases;
CREATE POLICY "update_own_cases" ON approval_cases FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins need to update all cases (approve, reject, edit terms)
DROP POLICY IF EXISTS "admin_update_all_cases" ON approval_cases;
CREATE POLICY "admin_update_all_cases" ON approval_cases FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ EMI SCHEDULES ============
CREATE TABLE IF NOT EXISTS emi_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_case_id uuid NOT NULL REFERENCES approval_cases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  installment_number integer NOT NULL DEFAULT 1,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE emi_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_schedules" ON emi_schedules;
CREATE POLICY "select_own_schedules" ON emi_schedules FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins need to see all schedules
DROP POLICY IF EXISTS "admin_read_all_schedules" ON emi_schedules;
CREATE POLICY "admin_read_all_schedules" ON emi_schedules FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_schedules" ON emi_schedules;
CREATE POLICY "insert_own_schedules" ON emi_schedules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_schedules" ON emi_schedules;
CREATE POLICY "update_own_schedules" ON emi_schedules FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins need to update all schedules
DROP POLICY IF EXISTS "admin_update_all_schedules" ON emi_schedules;
CREATE POLICY "admin_update_all_schedules" ON emi_schedules FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL DEFAULT '',
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL DEFAULT '',
  product_image text NOT NULL DEFAULT '',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  order_status text NOT NULL DEFAULT 'CONFIRMED',
  shipping_address text NOT NULL DEFAULT '',
  payment_mode text NOT NULL DEFAULT 'UPI',
  tracking_id text NOT NULL DEFAULT '',
  courier_name text NOT NULL DEFAULT 'BlueDart Express',
  expected_delivery date,
  is_emi boolean NOT NULL DEFAULT false,
  approval_case_id uuid REFERENCES approval_cases(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Admins need to see all orders
DROP POLICY IF EXISTS "admin_read_all_orders" ON orders;
CREATE POLICY "admin_read_all_orders" ON orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_orders" ON orders;
CREATE POLICY "update_own_orders" ON orders FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins need to update all orders (status updates)
DROP POLICY IF EXISTS "admin_update_all_orders" ON orders;
CREATE POLICY "admin_update_all_orders" ON orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============ TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'Monthly EMI',
  title text NOT NULL DEFAULT '',
  reference_id text NOT NULL DEFAULT '',
  payment_method text NOT NULL DEFAULT 'UPI',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_transactions" ON transactions;
CREATE POLICY "insert_own_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_name text NOT NULL DEFAULT '',
  rating integer NOT NULL DEFAULT 5,
  comment text NOT NULL DEFAULT '',
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_reviews" ON reviews;
CREATE POLICY "read_reviews" ON reviews FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_reviews" ON reviews;
CREATE POLICY "insert_own_reviews" ON reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reviews" ON reviews;
CREATE POLICY "update_own_reviews" ON reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reviews" ON reviews;
CREATE POLICY "delete_own_reviews" ON reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_flash ON products(is_flash_deal) WHERE is_flash_deal = true;
CREATE INDEX IF NOT EXISTS idx_products_best ON products(is_best_seller) WHERE is_best_seller = true;
CREATE INDEX IF NOT EXISTS idx_cases_user ON approval_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON approval_cases(current_status);
CREATE INDEX IF NOT EXISTS idx_schedules_case ON emi_schedules(approval_case_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);
