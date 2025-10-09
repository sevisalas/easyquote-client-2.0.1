-- Add holded_external_customers field to organizations table
ALTER TABLE public.organizations 
ADD COLUMN holded_external_customers boolean NOT NULL DEFAULT false;

-- Activate it only for Reprotel organization
UPDATE public.organizations 
SET holded_external_customers = true 
WHERE id = 'cae1d80f-fb8e-4101-bed8-d721d5bb8729';

-- Add comment to explain the field
COMMENT ON COLUMN public.organizations.holded_external_customers IS 'Enables external Holded customers in addition to local customers';