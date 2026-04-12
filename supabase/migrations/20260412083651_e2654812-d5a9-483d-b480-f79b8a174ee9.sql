-- Add resource_group_id to organizations
ALTER TABLE public.organizations
ADD COLUMN resource_group_id UUID DEFAULT NULL;

-- Pre-populate: group organizations that share the same api_user_id
WITH shared_groups AS (
  SELECT api_user_id, gen_random_uuid() AS group_id
  FROM public.organizations
  WHERE api_user_id IS NOT NULL
  GROUP BY api_user_id
  HAVING COUNT(*) > 1
)
UPDATE public.organizations o
SET resource_group_id = sg.group_id
FROM shared_groups sg
WHERE o.api_user_id = sg.api_user_id;

-- Add index for grouping queries
CREATE INDEX idx_organizations_resource_group ON public.organizations(resource_group_id) WHERE resource_group_id IS NOT NULL;