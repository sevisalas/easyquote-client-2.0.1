UPDATE sales_order_items 
SET description = qi.description
FROM quote_items qi
JOIN sales_orders so ON so.quote_id = qi.quote_id
WHERE sales_order_items.sales_order_id = so.id
  AND sales_order_items.sales_order_id = 'f28567b2-557f-465f-a42a-427300f3d716'
  AND qi.description IS NOT NULL;