-- 1. Añadir columna api_user_id a product_prompt_settings
ALTER TABLE public.product_prompt_settings 
ADD COLUMN IF NOT EXISTS api_user_id uuid;

-- 2. Poblar api_user_id desde la tabla organizations
UPDATE public.product_prompt_settings pps
SET api_user_id = o.api_user_id
FROM public.organizations o
WHERE pps.organization_id = o.id
AND pps.api_user_id IS NULL;

-- 3. Eliminar duplicados manteniendo el registro más reciente por grupo
-- Primero identificamos los registros a mantener (el más reciente de cada grupo)
DELETE FROM public.product_prompt_settings
WHERE id NOT IN (
  SELECT DISTINCT ON (api_user_id, easyquote_product_id, prompt_name) id
  FROM public.product_prompt_settings
  WHERE api_user_id IS NOT NULL
  ORDER BY api_user_id, easyquote_product_id, prompt_name, updated_at DESC
);

-- 4. Hacer api_user_id NOT NULL (después de poblar los datos)
ALTER TABLE public.product_prompt_settings 
ALTER COLUMN api_user_id SET NOT NULL;

-- 5. Eliminar el constraint único antiguo (si existe)
ALTER TABLE public.product_prompt_settings 
DROP CONSTRAINT IF EXISTS product_prompt_settings_org_product_prompt_key;

ALTER TABLE public.product_prompt_settings 
DROP CONSTRAINT IF EXISTS product_prompt_settings_organization_id_easyquote_product_id_key;

-- 6. Crear nuevo constraint único por api_user_id + producto + prompt
ALTER TABLE public.product_prompt_settings 
ADD CONSTRAINT product_prompt_settings_api_user_product_prompt_key 
UNIQUE (api_user_id, easyquote_product_id, prompt_name);

-- 7. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_product_prompt_settings_api_user 
ON public.product_prompt_settings(api_user_id, easyquote_product_id);

-- 8. Actualizar RLS policies para usar api_user_id
DROP POLICY IF EXISTS "Users can view prompt settings for their organization" ON public.product_prompt_settings;
DROP POLICY IF EXISTS "Users can insert prompt settings for their organization" ON public.product_prompt_settings;
DROP POLICY IF EXISTS "Users can update prompt settings for their organization" ON public.product_prompt_settings;
DROP POLICY IF EXISTS "Users can delete prompt settings for their organization" ON public.product_prompt_settings;

-- Nueva política: usuarios pueden ver/editar configuraciones de productos de su grupo (api_user_id)
CREATE POLICY "Users can view prompt settings for their api_user group"
ON public.product_prompt_settings FOR SELECT
USING (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = o.id AND om.user_id = auth.uid()
    )
  )
  OR public.is_superadmin()
);

CREATE POLICY "Users can insert prompt settings for their api_user group"
ON public.product_prompt_settings FOR INSERT
WITH CHECK (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
  )
  OR public.is_superadmin()
);

CREATE POLICY "Users can update prompt settings for their api_user group"
ON public.product_prompt_settings FOR UPDATE
USING (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
  )
  OR public.is_superadmin()
);

CREATE POLICY "Users can delete prompt settings for their api_user group"
ON public.product_prompt_settings FOR DELETE
USING (
  api_user_id IN (
    SELECT o.api_user_id FROM public.organizations o
    WHERE o.api_user_id = auth.uid()
  )
  OR public.is_superadmin()
);