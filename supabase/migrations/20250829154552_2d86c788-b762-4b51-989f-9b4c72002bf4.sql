-- Add holded_id column to customers table to store Holded contact IDs
ALTER TABLE public.customers 
ADD COLUMN holded_id TEXT;

-- Create index for performance on holded_id lookups
CREATE INDEX idx_customers_holded_id ON public.customers(holded_id);

-- Add unique constraint to prevent duplicate Holded contacts per user
ALTER TABLE public.customers 
ADD CONSTRAINT unique_holded_id_per_user UNIQUE (user_id, holded_id);