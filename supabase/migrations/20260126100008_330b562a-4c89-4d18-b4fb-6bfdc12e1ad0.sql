-- Drop the overly permissive RLS policy that allows any authenticated user to manage product links
DROP POLICY IF EXISTS "System can manage product links" ON public.woocommerce_product_links;

-- The existing organization-scoped policies are sufficient:
-- "Organization owners can manage product links" (already exists)
-- "Organization members can view own product links" (already exists)