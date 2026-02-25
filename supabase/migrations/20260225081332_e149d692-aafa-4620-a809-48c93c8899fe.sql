-- Make PDF configuration readable by all organization members (shared company template)

-- Replace overly restrictive SELECT policy
DROP POLICY IF EXISTS "Organization owners can view PDF configurations" ON public.pdf_configurations;

CREATE POLICY "Organization members can view PDF configurations"
ON public.pdf_configurations
FOR SELECT
TO authenticated
USING (
  public.is_superadmin()
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = pdf_configurations.organization_id
      AND o.api_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = pdf_configurations.organization_id
      AND om.user_id = auth.uid()
  )
);