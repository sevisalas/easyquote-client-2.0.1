-- Backfill labels for is_quantity settings that have NULL labels
-- b0b3e0a7 (Plegados/DIPTICO): B6 → "Cantidad ejemplares"
UPDATE product_prompt_settings 
SET label = 'Cantidad ejemplares'
WHERE easyquote_product_id = 'b0b3e0a7-d991-48ca-91c5-11dbfd82137a' 
AND is_quantity = true AND label IS NULL;

-- f913f7b3 (Sobres): B6 → "Cantidad ejemplares"
UPDATE product_prompt_settings 
SET label = 'Cantidad ejemplares'
WHERE easyquote_product_id = 'f913f7b3-5770-42a6-8c85-eff1fea29b9b' 
AND is_quantity = true AND label IS NULL;

-- a6467fc0 (CARTEL/Vinilos/Cartelas): A1 → "Cantidad"
UPDATE product_prompt_settings 
SET label = 'Cantidad'
WHERE easyquote_product_id = 'a6467fc0-ef09-4d86-b852-b9160ed221e6' 
AND is_quantity = true AND label IS NULL;

-- 9b0ea716 (Libros): B4 → "Ejemplares"
UPDATE product_prompt_settings 
SET label = 'Ejemplares'
WHERE easyquote_product_id = '9b0ea716-a0ec-4f9c-9612-891ab1f70f12' 
AND is_quantity = true AND label IS NULL;