-- Add integration_id field to customers table for manual linking with external integrations
ALTER TABLE public.customers 
ADD COLUMN integration_id text;