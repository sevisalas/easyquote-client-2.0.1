
-- Drop and recreate the SELECT policy for quotes to use organization_members.role
DROP POLICY IF EXISTS "Users can view accessible quotes" ON public.quotes;

CREATE POLICY "Users can view accessible quotes"
ON public.quotes
FOR SELECT
USING (
  -- Owner always sees their own quotes
  auth.uid() = user_id
  OR
  -- Organization members with admin/gestor role see all org quotes
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = quotes.organization_id
      AND om.role IN ('admin', 'gestor')
  )
  OR
  -- Comercial sees all org quotes (but UI may filter further)
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = quotes.organization_id
      AND om.role = 'comercial'
  )
  OR
  -- Superadmin sees all
  public.is_superadmin()
);
