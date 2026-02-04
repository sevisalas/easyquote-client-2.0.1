-- Primero eliminar duplicados manteniendo solo el registro más antiguo por api_user_id + easyquote_product_id
-- Identificar y eliminar duplicados en product_component_settings
DELETE FROM public.product_component_settings
WHERE id IN (
  SELECT id FROM (
    SELECT 
      pcs.id,
      ROW_NUMBER() OVER (
        PARTITION BY o.api_user_id, pcs.easyquote_product_id 
        ORDER BY pcs.created_at ASC
      ) as rn
    FROM public.product_component_settings pcs
    JOIN public.organizations o ON o.id = pcs.organization_id
  ) sub
  WHERE rn > 1
);

-- Eliminar duplicados en product_prompt_components
DELETE FROM public.product_prompt_components
WHERE id IN (
  SELECT id FROM (
    SELECT 
      ppc.id,
      ROW_NUMBER() OVER (
        PARTITION BY o.api_user_id, ppc.easyquote_product_id, ppc.prompt_name 
        ORDER BY ppc.created_at ASC
      ) as rn
    FROM public.product_prompt_components ppc
    JOIN public.organizations o ON o.id = ppc.organization_id
  ) sub
  WHERE rn > 1
);

-- Ahora añadir columna api_user_id
ALTER TABLE public.product_component_settings 
ADD COLUMN api_user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.product_prompt_components 
ADD COLUMN api_user_id UUID REFERENCES auth.users(id);

-- Migrar datos existentes
UPDATE public.product_component_settings pcs
SET api_user_id = o.api_user_id
FROM public.organizations o
WHERE pcs.organization_id = o.id;

UPDATE public.product_prompt_components ppc
SET api_user_id = o.api_user_id
FROM public.organizations o
WHERE ppc.organization_id = o.id;

-- Hacer api_user_id NOT NULL
ALTER TABLE public.product_component_settings 
ALTER COLUMN api_user_id SET NOT NULL;

ALTER TABLE public.product_prompt_components 
ALTER COLUMN api_user_id SET NOT NULL;

-- Crear índices
CREATE INDEX idx_product_component_settings_api_user 
ON public.product_component_settings(api_user_id, easyquote_product_id);

CREATE INDEX idx_product_prompt_components_api_user 
ON public.product_prompt_components(api_user_id, easyquote_product_id);

-- Eliminar constraints antiguos y crear nuevos
ALTER TABLE public.product_component_settings 
DROP CONSTRAINT IF EXISTS product_component_settings_organization_id_easyquote_product_key;

ALTER TABLE public.product_component_settings 
ADD CONSTRAINT product_component_settings_api_user_product_key 
UNIQUE (api_user_id, easyquote_product_id);

ALTER TABLE public.product_prompt_components 
DROP CONSTRAINT IF EXISTS product_prompt_components_organization_id_easyquote_produc_key;

ALTER TABLE public.product_prompt_components 
ADD CONSTRAINT product_prompt_components_api_user_product_prompt_key 
UNIQUE (api_user_id, easyquote_product_id, prompt_name);

-- Actualizar RLS policies
DROP POLICY IF EXISTS "Users can view their organization product settings" ON public.product_component_settings;
DROP POLICY IF EXISTS "Users can manage their organization product settings" ON public.product_component_settings;

CREATE POLICY "Users can view shared API product settings" 
ON public.product_component_settings 
FOR SELECT 
USING (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage shared API product settings" 
ON public.product_component_settings 
FOR ALL 
USING (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view their organization prompt components" ON public.product_prompt_components;
DROP POLICY IF EXISTS "Users can manage their organization prompt components" ON public.product_prompt_components;

CREATE POLICY "Users can view shared API prompt components" 
ON public.product_prompt_components 
FOR SELECT 
USING (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage shared API prompt components" 
ON public.product_prompt_components 
FOR ALL 
USING (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = auth.uid()
    UNION
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
  )
);