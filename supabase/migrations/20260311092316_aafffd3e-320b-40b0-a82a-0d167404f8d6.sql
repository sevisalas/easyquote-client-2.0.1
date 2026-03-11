-- Fix empty integration_id to NULL for orphaned customers
UPDATE customers
SET integration_id = NULL
WHERE integration_id = ''
  AND organization_id IS NULL;

-- Assign Campillo Formación org to user 2e123dbf's orphaned customers only
UPDATE customers
SET organization_id = '294133c5-ab2a-445c-9270-85a179a0bde6'
WHERE user_id = '2e123dbf-1e7f-458c-bfa6-f7167cc476d9'
  AND organization_id IS NULL;