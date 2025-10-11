-- Add is_discount field to additionals table
ALTER TABLE additionals 
ADD COLUMN is_discount boolean NOT NULL DEFAULT false;

-- Add is_discount field to quote_additionals table (for runtime tracking)
ALTER TABLE quote_additionals
ADD COLUMN is_discount boolean NOT NULL DEFAULT false;