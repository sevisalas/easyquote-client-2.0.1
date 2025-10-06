-- Restaurar campos que no debían eliminarse
ALTER TABLE quote_items 
ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0;