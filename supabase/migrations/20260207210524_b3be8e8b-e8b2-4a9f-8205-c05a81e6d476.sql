-- Drop existing policies on product_prompt_settings
DROP POLICY IF EXISTS "Organization members can view prompt settings" ON public.product_prompt_settings;
DROP POLICY IF EXISTS "Organization members can insert prompt settings" ON public.product_prompt_settings;
DROP POLICY IF EXISTS "Organization members can update prompt settings" ON public.product_prompt_settings;
DROP POLICY IF EXISTS "Organization members can delete prompt settings" ON public.product_prompt_settings;

-- Create new policies that allow access based on api_user_id (shared across organization groups)
-- This ensures configuration is shared between organizations like Campillo/Anebri/Formación

-- SELECT: Allow viewing prompt settings for any organization that shares the same api_user_id
CREATE POLICY "View prompt settings by api_user_id"
ON public.product_prompt_settings
FOR SELECT
USING (
  api_user_id IN (
    -- Get api_user_id from organizations where user is a member
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    -- Get api_user_id from organizations where user is the owner
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

-- INSERT: Allow inserting prompt settings for organizations in user's api_user_id group
CREATE POLICY "Insert prompt settings by api_user_id"
ON public.product_prompt_settings
FOR INSERT
WITH CHECK (
  api_user_id IN (
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

-- UPDATE: Allow updating prompt settings for organizations in user's api_user_id group
CREATE POLICY "Update prompt settings by api_user_id"
ON public.product_prompt_settings
FOR UPDATE
USING (
  api_user_id IN (
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

-- DELETE: Allow deleting prompt settings for organizations in user's api_user_id group
CREATE POLICY "Delete prompt settings by api_user_id"
ON public.product_prompt_settings
FOR DELETE
USING (
  api_user_id IN (
    SELECT o.api_user_id 
    FROM organizations o
    INNER JOIN organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id
    FROM organizations o
    WHERE o.api_user_id = auth.uid()
  )
);