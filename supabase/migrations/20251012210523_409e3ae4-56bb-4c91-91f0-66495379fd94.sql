-- Add API user to organization_members so they can use the app
-- This ensures the organization owner can also use the application as a regular user

INSERT INTO public.organization_members (
  user_id,
  organization_id,
  role
)
SELECT 
  o.api_user_id,
  o.id,
  'admin'
FROM public.organizations o
WHERE o.api_user_id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;