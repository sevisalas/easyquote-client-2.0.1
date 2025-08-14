-- Create organization for test1@test1.com
INSERT INTO organizations (name, api_user_id, subscription_plan)
SELECT 
  'Organización Test1',
  auth.users.id,
  'api_base'::subscription_plan
FROM auth.users 
WHERE email = 'test1@test1.com'
ON CONFLICT (api_user_id) DO NOTHING;

-- Add test1 as member of their own organization
INSERT INTO organization_members (organization_id, user_id, role)
SELECT 
  o.id,
  o.api_user_id,
  'admin'::organization_role
FROM organizations o
JOIN auth.users u ON u.id = o.api_user_id
WHERE u.email = 'test1@test1.com'
ON CONFLICT (organization_id, user_id) DO NOTHING;