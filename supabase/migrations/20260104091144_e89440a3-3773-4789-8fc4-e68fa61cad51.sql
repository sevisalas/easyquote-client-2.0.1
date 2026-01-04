
-- Borrar todas las copias creadas para Tradsis
DELETE FROM product_prompt_components 
WHERE organization_id = 'f95d535e-5a8f-4fef-9dda-75071d5b0e9e';

DELETE FROM product_output_order 
WHERE organization_id = 'f95d535e-5a8f-4fef-9dda-75071d5b0e9e';

DELETE FROM product_component_settings 
WHERE organization_id = 'f95d535e-5a8f-4fef-9dda-75071d5b0e9e';
