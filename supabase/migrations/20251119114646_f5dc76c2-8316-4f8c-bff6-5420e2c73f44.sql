
-- Renumerar presupuestos de Reprotel según el nuevo formato PR-25-####
WITH numbered_quotes AS (
  SELECT 
    id,
    'PR-25-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0') as new_number
  FROM quotes
  WHERE user_id = '5a19026a-f9c0-46e6-925f-1fcc2094ef59'
)
UPDATE quotes q
SET quote_number = nq.new_number
FROM numbered_quotes nq
WHERE q.id = nq.id;

-- Renumerar pedidos de Reprotel según el nuevo formato SO-25-####
WITH numbered_orders AS (
  SELECT 
    id,
    'SO-25-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 4, '0') as new_number
  FROM sales_orders
  WHERE user_id = '5a19026a-f9c0-46e6-925f-1fcc2094ef59'
)
UPDATE sales_orders so
SET order_number = no.new_number
FROM numbered_orders no
WHERE so.id = no.id;
