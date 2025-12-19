-- Eliminar la restricción CHECK para permitir componentes libres
ALTER TABLE public.product_prompt_components 
DROP CONSTRAINT IF EXISTS product_prompt_components_component_check;