-- Fix RLS policies for quotes to work with 'user' role members

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Comercial can manage own quotes" ON quotes;

-- Create new policy for regular organization members
CREATE POLICY "Members can manage own quotes"
ON quotes
FOR ALL
TO authenticated
USING (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- Also ensure members can view quotes from other members in their organization
CREATE POLICY "Members can view organization quotes"
ON quotes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = quotes.user_id
  )
);