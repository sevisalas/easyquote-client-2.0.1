-- Fix RLS policies for quotes to work with all organization members

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Comercial can manage own quotes" ON quotes;
DROP POLICY IF EXISTS "Members can manage own quotes" ON quotes;
DROP POLICY IF EXISTS "Members can view organization quotes" ON quotes;

-- Create unified policy for all members
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