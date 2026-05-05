CREATE POLICY "Portal customer can view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.organization_id = organizations.id
      AND c.portal_user_id = auth.uid()
      AND c.portal_enabled = true
  )
);