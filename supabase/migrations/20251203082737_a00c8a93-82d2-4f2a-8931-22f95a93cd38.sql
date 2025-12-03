-- Create unique constraint for holded_id + organization_id to enable upsert
CREATE UNIQUE INDEX IF NOT EXISTS customers_holded_id_organization_id_unique 
ON public.customers (holded_id, organization_id) 
WHERE holded_id IS NOT NULL;