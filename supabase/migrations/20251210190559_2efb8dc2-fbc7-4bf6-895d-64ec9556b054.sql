-- Drop existing policies
DROP POLICY IF EXISTS "Users can view accessible quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update accessible quotes" ON public.quotes;

-- CREATE new SELECT policy: comercial can view ALL quotes in their organization
CREATE POLICY "Users can view accessible quotes" 
ON public.quotes 
FOR SELECT 
USING (
  -- Owner can always see their quotes
  (auth.uid() = user_id) OR
  -- Comercial can see ALL quotes in their organization (not just their own)
  (has_role(auth.uid(), 'comercial'::app_role) AND (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  )) OR
  -- Gestor can see all quotes in their organization
  (has_role(auth.uid(), 'gestor'::app_role) AND (EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = quotes.user_id
  ))) OR
  -- Admin can see all quotes in their organization
  (has_role(auth.uid(), 'admin'::app_role) AND (EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = quotes.user_id
  ))) OR
  -- Operador can see all quotes in their organization
  (has_role(auth.uid(), 'operador'::app_role) AND (EXISTS (
    SELECT 1 FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = quotes.user_id
  )))
);

-- CREATE new UPDATE policy: comercial can ONLY update their OWN quotes
CREATE POLICY "Users can update accessible quotes" 
ON public.quotes 
FOR UPDATE 
USING (
  -- Owner can always update their quotes
  (auth.uid() = user_id) OR
  -- Comercial can ONLY update their OWN quotes (not others)
  (has_role(auth.uid(), 'comercial'::app_role) AND (auth.uid() = user_id)) OR
  -- Admin can update all quotes in their organization
  (has_role(auth.uid(), 'admin'::app_role) AND (EXISTS (
    SELECT 1 FROM organization_members om1
    WHERE om1.user_id = auth.uid() AND om1.role = 'admin'
    AND EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.organization_id = om1.organization_id AND om2.user_id = quotes.user_id
    )
  )))
);