-- Create organization for test1@test1.com
DO $$
DECLARE
    test_user_id uuid;
    org_id uuid;
BEGIN
    -- Get test1 user id
    SELECT id INTO test_user_id FROM auth.users WHERE email = 'test1@test1.com';
    
    IF test_user_id IS NOT NULL THEN
        -- Check if organization already exists
        SELECT id INTO org_id FROM organizations WHERE api_user_id = test_user_id;
        
        IF org_id IS NULL THEN
            -- Create organization
            INSERT INTO organizations (name, api_user_id, subscription_plan)
            VALUES ('Organización Test1', test_user_id, 'api_base'::subscription_plan)
            RETURNING id INTO org_id;
            
            -- Add test1 as admin member of their organization
            INSERT INTO organization_members (organization_id, user_id, role)
            VALUES (org_id, test_user_id, 'admin'::organization_role);
        END IF;
    END IF;
END $$;