-- Eliminar planes incorrectos que creé
DELETE FROM plan_configurations WHERE plan_id IN ('api', 'client');

-- Reactivar planes Base
UPDATE plan_configurations 
SET is_active = true, available_modules = ARRAY['API']
WHERE plan_id = 'api_base';

UPDATE plan_configurations
SET is_active = true, available_modules = ARRAY['API', 'Client']
WHERE plan_id = 'client_base';

-- Crear API Pro
INSERT INTO plan_configurations (name, plan_id, available_modules, excel_limit, client_user_limit, is_active)
VALUES ('API Pro', 'api_pro', ARRAY['API'], 25, 1, true)
ON CONFLICT (plan_id) DO UPDATE 
SET name = 'API Pro', available_modules = ARRAY['API'], excel_limit = 25, client_user_limit = 1, is_active = true;

-- Crear Client Pro
INSERT INTO plan_configurations (name, plan_id, available_modules, excel_limit, client_user_limit, is_active)
VALUES ('Client Pro', 'client_pro', ARRAY['API', 'Client'], 25, 5, true)
ON CONFLICT (plan_id) DO UPDATE 
SET name = 'Client Pro', available_modules = ARRAY['API', 'Client'], excel_limit = 25, client_user_limit = 5, is_active = true;

-- Actualizar ERP con los 3 módulos correctos
UPDATE plan_configurations
SET available_modules = ARRAY['API', 'Client', 'Production']
WHERE plan_id = 'erp';

-- Actualizar Custom
UPDATE plan_configurations
SET available_modules = ARRAY['API', 'Client', 'Production']
WHERE plan_id = 'custom';