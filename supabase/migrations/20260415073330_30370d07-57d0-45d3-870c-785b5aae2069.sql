-- Delete legacy customers (organization_id IS NULL) that already have a copy with organization_id set
DELETE FROM customers
WHERE organization_id IS NULL
  AND holded_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM customers c2
    WHERE c2.holded_id = customers.holded_id
      AND c2.organization_id IS NOT NULL
  );

-- Also delete any remaining legacy customers without organization_id that have a holded source
-- These are orphaned records from before multi-tenant was enforced
-- (Only those that have no quotes or sales_orders referencing them)
DELETE FROM customers
WHERE organization_id IS NULL
  AND source = 'holded'
  AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.customer_id = customers.id)
  AND NOT EXISTS (SELECT 1 FROM sales_orders so WHERE so.customer_id = customers.id);