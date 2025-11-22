-- Fix infinite recursion in organization_members RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view organization memberships" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Organization owners can delete members" ON public.organization_members;

-- Create security definer function to check if user is organization owner
CREATE OR REPLACE FUNCTION public.is_organization_owner(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = _org_id
      AND api_user_id = _user_id
  )
$$;

-- Create new RLS policies using security definer functions
CREATE POLICY "Members can view organization memberships"
ON public.organization_members
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_organization_owner(auth.uid(), organization_id)
  OR public.is_organization_member(auth.uid(), organization_id)
);

CREATE POLICY "Organization owners can manage members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_organization_owner(auth.uid(), organization_id)
);

CREATE POLICY "Organization owners can update members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (
  public.is_organization_owner(auth.uid(), organization_id)
);

CREATE POLICY "Organization owners can delete members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (
  public.is_organization_owner(auth.uid(), organization_id)
);