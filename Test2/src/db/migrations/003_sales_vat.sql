ALTER TABLE sales ADD COLUMN vat_total_centavos INTEGER NOT NULL DEFAULT 0 CHECK (vat_total_centavos >= 0);
ALTER TABLE sale_items ADD COLUMN vat_amount_centavos INTEGER NOT NULL DEFAULT 0 CHECK (vat_amount_centavos >= 0);
