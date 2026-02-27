UPDATE organization_integration_access 
SET configuration = jsonb_set(COALESCE(configuration, '{}'::jsonb), '{export_mode}', '"estimates_on_approval"')
WHERE id IN ('5bf677d4-e5be-4c61-8869-2e61f6667829', 'f5ab13f7-3f18-4ad2-8936-05b1f28ebfe6');