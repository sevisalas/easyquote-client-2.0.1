-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can manage product links" ON public.woocommerce_product_links;

-- Add organization-scoped policies
CREATE POLICY "Org members can view product links"
ON public.woocommerce_product_links
FOR SELECT
USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = organization_id AND o.api_user_id = auth.uid()
  )
);

CREATE POLICY "Org owners can manage product links"
ON public.woocommerce_product_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = organization_id AND o.api_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = organization_id AND o.api_user_id = auth.uid()
  )
);