-- Sincronizar holded_id a holded_estimate_id para presupuestos que solo tienen holded_id
UPDATE public.quotes 
SET holded_estimate_id = holded_id 
WHERE holded_id IS NOT NULL AND holded_estimate_id IS NULL;

-- También copiar holded_estimate_id a holded_id para los que solo tienen el antiguo campo
UPDATE public.quotes 
SET holded_id = holded_estimate_id 
WHERE holded_estimate_id IS NOT NULL AND holded_id IS NULL;