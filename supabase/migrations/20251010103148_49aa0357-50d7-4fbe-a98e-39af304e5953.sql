-- Fix the API key for the organization
UPDATE organization_integration_access 
SET access_token_encrypted = '88610992d47b9783e7703c488a8c01cf'::bytea
WHERE organization_id = 'cae1d80f-fb8e-4101-bed8-d721d5bb8729'
AND integration_id IN (SELECT id FROM integrations WHERE name = 'Holded');