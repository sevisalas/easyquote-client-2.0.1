-- Fix RLS policies for woocommerce_product_links and plan_configurations

-- 1. Fix woocommerce_product_links - restrict to organization members only
DROP POLICY IF EXISTS "System can manage product links" ON public.woocommerce_product_links;

-- Allow organization members to view their own organization's product links
CREATE POLICY "Organization members can view own product links" 
ON public.woocommerce_product_links 
FOR SELECT 
USING (
  public.is_organization_member(auth.uid(), organization_id) OR
  public.is_organization_owner(auth.uid(), organization_id)
);

-- Allow organization owners to manage product links
CREATE POLICY "Organization owners can manage product links" 
ON public.woocommerce_product_links 
FOR ALL 
USING (
  public.is_organization_owner(auth.uid(), organization_id)
)
WITH CHECK (
  public.is_organization_owner(auth.uid(), organization_id)
);

-- 2. Fix plan_configurations - restrict to authenticated users only
DROP POLICY IF EXISTS "Everyone can view active plans" ON public.plan_configurations;

-- Allow only authenticated users to view active plans (not public)
CREATE POLICY "Authenticated users can view active plans" 
ON public.plan_configurations 
FOR SELECT 
TO authenticated
USING (is_active = true);