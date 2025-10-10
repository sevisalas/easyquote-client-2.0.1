-- Drop the foreign key constraint that prevents saving Holded customers
ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey;