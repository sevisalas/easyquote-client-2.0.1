-- Fix RLS policies so organization owners (and superadmins) can manage product output order

ALTER TABLE public.product_output_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization members can view output order" ON public.product_output_order;
DROP POLICY IF EXISTS "Organization members can insert output order" ON public.product_output_order;
DROP POLICY IF EXISTS "Organization members can update output order" ON public.product_output_order;

CREATE POLICY "Organization members can view output order"
ON public.product_output_order
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = product_output_order.organization_id
      AND om.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = product_output_order.organization_id
      AND o.api_user_id = auth.uid()
  )
  OR public.is_superadmin()
);

CREATE POLICY "Organization members can insert output order"
ON public.product_output_order
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = product_output_order.organization_id
      AND om.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = product_output_order.organization_id
      AND o.api_user_id = auth.uid()
  )
  OR public.is_superadmin()
);

CREATE POLICY "Organization members can update output order"
ON public.product_output_order
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = product_output_order.organization_id
      AND om.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = product_output_order.organization_id
      AND o.api_user_id = auth.uid()
  )
  OR public.is_superadmin()
);