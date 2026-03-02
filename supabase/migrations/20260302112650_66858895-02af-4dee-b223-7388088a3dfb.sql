
DROP POLICY IF EXISTS "Users can update accessible quotes" ON public.quotes;

CREATE POLICY "Users can update accessible quotes"
ON public.quotes
FOR UPDATE
USING (
  -- Creator can always update their own quotes
  auth.uid() = user_id
  OR
  -- Admin or Gestor in the same organization can update any quote
  EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.role IN ('admin', 'gestor')
      AND om.organization_id = quotes.organization_id
  )
);
