UPDATE sales_order_items 
SET description = (
  SELECT qi.description 
  FROM quote_items qi 
  JOIN sales_orders so ON so.quote_id = qi.quote_id 
  WHERE so.id = 'f28567b2-557f-465f-a42a-427300f3d716'
  AND qi.product_name = sales_order_items.product_name
  LIMIT 1
)
WHERE sales_order_id = 'f28567b2-557f-465f-a42a-427300f3d716'