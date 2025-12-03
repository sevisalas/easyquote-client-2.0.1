-- Drop the partial index that doesn't work with ON CONFLICT
DROP INDEX IF EXISTS customers_holded_id_organization_id_unique;

-- Create a proper unique constraint without WHERE clause
-- NULL values are treated as distinct in PostgreSQL, so multiple NULLs are allowed
ALTER TABLE public.customers 
ADD CONSTRAINT customers_holded_id_organization_id_key 
UNIQUE (holded_id, organization_id);