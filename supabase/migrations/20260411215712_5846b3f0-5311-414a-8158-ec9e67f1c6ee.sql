-- Add feature flags directly to organizations table
ALTER TABLE public.organizations
  ADD COLUMN generate_pdfs BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN client_portal BOOLEAN NOT NULL DEFAULT false;

-- Backfill from organization_integration_access (take TRUE if any row has it)
UPDATE public.organizations o
SET generate_pdfs = COALESCE((
  SELECT bool_or(oia.generate_pdfs)
  FROM public.organization_integration_access oia
  WHERE oia.organization_id = o.id
), false),
client_portal = COALESCE((
  SELECT bool_or(oia.client_portal)
  FROM public.organization_integration_access oia
  WHERE oia.organization_id = o.id
), false);

-- Remove columns from organization_integration_access
ALTER TABLE public.organization_integration_access
  DROP COLUMN generate_pdfs,
  DROP COLUMN client_portal;