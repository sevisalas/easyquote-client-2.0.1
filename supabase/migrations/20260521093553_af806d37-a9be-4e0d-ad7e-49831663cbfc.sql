ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS default_delivery_business_days integer DEFAULT 5;

COMMENT ON COLUMN public.organizations.default_delivery_business_days IS 'Default business (working) days from order creation date to expected delivery date';