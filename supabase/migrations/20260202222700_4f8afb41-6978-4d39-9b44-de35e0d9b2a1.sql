-- Actualizar los registros que tienen holded_id pero no tienen holded_estimate_number
-- Basándome en los logs, la exportación más reciente fue P_15078 para 698122df9bb5702edb0279ad
-- Y P_15077 para 69811f91a9bb7065f801a810 (basándome en la secuencia)

-- Nota: Esto es un arreglo puntual. El código de exportación debe estar guardando correctamente ahora.
UPDATE public.quotes 
SET holded_estimate_number = 'P_15078' 
WHERE holded_id = '698122df9bb5702edb0279ad' AND holded_estimate_number IS NULL;

UPDATE public.quotes 
SET holded_estimate_number = 'P_15077' 
WHERE holded_id = '69811f91a9bb7065f801a810' AND holded_estimate_number IS NULL;