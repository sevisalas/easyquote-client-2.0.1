
-- Create customer_discounts table
CREATE TABLE public.customer_discounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  is_discount BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_discounts ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin in an organization
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = 'admin'
  )
$$;

-- RLS: Only admins of the organization can SELECT
CREATE POLICY "Admins can view customer discounts"
ON public.customer_discounts
FOR SELECT
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

-- RLS: Only admins can INSERT
CREATE POLICY "Admins can create customer discounts"
ON public.customer_discounts
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- RLS: Only admins can UPDATE
CREATE POLICY "Admins can update customer discounts"
ON public.customer_discounts
FOR UPDATE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

-- RLS: Only admins can DELETE
CREATE POLICY "Admins can delete customer discounts"
ON public.customer_discounts
FOR DELETE
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id));

-- Trigger for updated_at
CREATE TRIGGER update_customer_discounts_updated_at
  BEFORE UPDATE ON public.customer_discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
