DROP POLICY IF EXISTS "Portal customer can view own organization" ON public.organizations;

CREATE OR REPLACE FUNCTION public.is_portal_customer_of_org(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers
    WHERE organization_id = _org_id
      AND portal_user_id = _user_id
      AND portal_enabled = true
  )
$$;

CREATE POLICY "Portal customer can view own organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_portal_customer_of_org(auth.uid(), id));