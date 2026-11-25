-- HG shared platform migration (schema: pos)
-- Source: live Drip & Brew project (mwjxvldnggqndbewjxoe), not its repo.
-- Objects the live database and the app's code use but no repo migration creates.
-- Reconstructed on 24 Nov 2026 from the live schema diagram and the app code:
--   settings:              stores/inventory.ts, server/api/settings/*, server/tasks/weekly-report.ts,
--                          server/api/checkout.post.ts, supabase/functions/checkout/index.ts
--   products.display_order: composables/useProducts.ts, server/api/settings/layout.post.ts
--   products.category:      composables/useProducts.ts (legacy single category, kept beside `categories`)
-- BEFORE APPLYING: replace this file with the exact definitions from
--   supabase db dump --db-url <Drip & Brew connection string> --schema public
-- The live diagram shows products.category as NOT NULL; it is nullable here until the
-- dump confirms its default, so inserts that omit it keep working.

SET search_path TO pos, extensions;

CREATE TABLE IF NOT EXISTS pos.settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pos.settings ENABLE ROW LEVEL SECURITY;

-- Same model as products ("Baristas manage products"): signed-in POS staff read and
-- write; server routes and the checkout function use the service role.
DROP POLICY IF EXISTS "Baristas manage settings" ON pos.settings;
CREATE POLICY "Baristas manage settings" ON pos.settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE pos.products ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE pos.products ADD COLUMN IF NOT EXISTS display_order integer;
