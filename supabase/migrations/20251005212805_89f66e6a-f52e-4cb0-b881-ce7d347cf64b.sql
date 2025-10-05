-- Eliminar campos de precio unitario y cantidad de quote_items
ALTER TABLE quote_items 
DROP COLUMN IF EXISTS unit_price,
DROP COLUMN IF EXISTS quantity,
DROP COLUMN IF EXISTS discount_percentage;

-- Renombrar subtotal a price para que sea más claro
ALTER TABLE quote_items 
RENAME COLUMN subtotal TO price;

-- Eliminar total_price ya que ahora solo hay price
ALTER TABLE quote_items 
DROP COLUMN IF EXISTS total_price;