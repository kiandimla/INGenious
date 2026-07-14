-- PhIMS normalized SQLite schema.
-- Money is stored as integer centavos. Dates use ISO-8601 text (YYYY-MM-DD).

CREATE TABLE products (
  item_id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL COLLATE NOCASE,
  price_centavos INTEGER NOT NULL CHECK (price_centavos >= 0),
  cost_centavos INTEGER NOT NULL CHECK (cost_centavos >= 0),
  previous_price_centavos INTEGER CHECK (previous_price_centavos IS NULL OR previous_price_centavos >= 0),
  previous_cost_centavos INTEGER CHECK (previous_cost_centavos IS NULL OR previous_cost_centavos >= 0),
  category_code TEXT,
  supplier_code TEXT,
  brand_code TEXT,
  department_code TEXT,
  group_code TEXT,
  division_code TEXT,
  unit_code TEXT,
  is_perishable INTEGER NOT NULL DEFAULT 0 CHECK (is_perishable IN (0, 1)),
  vat_rate_basis_points INTEGER NOT NULL DEFAULT 0 CHECK (vat_rate_basis_points >= 0),
  is_exempt INTEGER NOT NULL DEFAULT 0 CHECK (is_exempt IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX products_active_name ON products(is_active, item_name);

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  reset_key_hash TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE UNIQUE INDEX users_name_unique ON users(name COLLATE NOCASE);

CREATE TABLE stock_quantities (
  product_id TEXT PRIMARY KEY REFERENCES products(item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE sales (
  id INTEGER PRIMARY KEY,
  invoice_number TEXT NOT NULL COLLATE NOCASE,
  sale_date TEXT NOT NULL CHECK (sale_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  gross_total_centavos INTEGER NOT NULL CHECK (gross_total_centavos >= 0),
  discount_total_centavos INTEGER NOT NULL DEFAULT 0 CHECK (discount_total_centavos >= 0),
  net_total_centavos INTEGER NOT NULL CHECK (net_total_centavos >= 0),
  encoded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  encoded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE UNIQUE INDEX sales_invoice_unique ON sales(invoice_number COLLATE NOCASE);
CREATE INDEX sales_date_idx ON sales(sale_date);

CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  unit_price_centavos INTEGER NOT NULL CHECK (unit_price_centavos >= 0),
  unit_cost_centavos INTEGER NOT NULL CHECK (unit_cost_centavos >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  discount_percent_basis_points INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent_basis_points BETWEEN 0 AND 10000),
  is_discounted INTEGER NOT NULL DEFAULT 0 CHECK (is_discounted IN (0, 1)),
  discount_remarks TEXT,
  gross_subtotal_centavos INTEGER NOT NULL CHECK (gross_subtotal_centavos >= 0),
  discount_amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount_centavos >= 0),
  net_subtotal_centavos INTEGER NOT NULL CHECK (net_subtotal_centavos >= 0),
  UNIQUE (sale_id, product_id)
) STRICT;
CREATE INDEX sale_items_product_idx ON sale_items(product_id);

CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY,
  invoice_number TEXT NOT NULL COLLATE NOCASE,
  delivery_date TEXT NOT NULL CHECK (delivery_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  encoded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  encoded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (invoice_number, delivery_date)
) STRICT;
CREATE INDEX deliveries_date_idx ON deliveries(delivery_date);

CREATE TABLE delivery_pages (
  id INTEGER PRIMARY KEY,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number > 0),
  page_count INTEGER NOT NULL CHECK (page_count > 0 AND page_number <= page_count),
  page_total_centavos INTEGER NOT NULL CHECK (page_total_centavos >= 0),
  UNIQUE (delivery_id, page_number)
) STRICT;

CREATE TABLE delivery_items (
  id INTEGER PRIMARY KEY,
  delivery_page_id INTEGER NOT NULL REFERENCES delivery_pages(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,
  unit_cost_centavos INTEGER NOT NULL CHECK (unit_cost_centavos >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expiry_date TEXT CHECK (expiry_date IS NULL OR expiry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  subtotal_centavos INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  UNIQUE (delivery_page_id, product_id, expiry_date)
) STRICT;
CREATE INDEX delivery_items_product_idx ON delivery_items(product_id);

CREATE TABLE stock_movements (
  id INTEGER PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(item_id) ON UPDATE CASCADE ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('OPENING', 'SALE', 'DELIVERY', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'REVERSAL')),
  quantity_change INTEGER NOT NULL CHECK (quantity_change <> 0),
  stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  sale_item_id INTEGER REFERENCES sale_items(id) ON DELETE RESTRICT,
  delivery_item_id INTEGER REFERENCES delivery_items(id) ON DELETE RESTRICT,
  reason TEXT,
  created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (stock_after = stock_before + quantity_change),
  CHECK ((sale_item_id IS NULL) OR (delivery_item_id IS NULL))
) STRICT;
CREATE INDEX stock_movements_product_date ON stock_movements(product_id, created_at);

CREATE TRIGGER products_create_stock
AFTER INSERT ON products
BEGIN
  INSERT OR IGNORE INTO stock_quantities(product_id, quantity) VALUES (NEW.item_id, 0);
END;
