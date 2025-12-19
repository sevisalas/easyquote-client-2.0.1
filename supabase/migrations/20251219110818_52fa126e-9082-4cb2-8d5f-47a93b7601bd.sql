-- Tabla para configuración de componentes del producto
CREATE TABLE public.product_component_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  easyquote_product_id TEXT NOT NULL,
  is_composite BOOLEAN NOT NULL DEFAULT false,
  enabled_components TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, easyquote_product_id)
);

-- Tabla para asignación de prompts/outputs a componentes
CREATE TABLE public.product_prompt_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  easyquote_product_id TEXT NOT NULL,
  prompt_name TEXT NOT NULL,
  component TEXT NOT NULL CHECK (component IN ('general', 'cubierta', 'interior_1', 'interior_2')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, easyquote_product_id, prompt_name)
);

-- Habilitar RLS
ALTER TABLE public.product_component_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prompt_components ENABLE ROW LEVEL SECURITY;

-- Políticas para product_component_settings
CREATE POLICY "Organization members can view component settings"
ON public.product_component_settings FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ) OR
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can insert component settings"
ON public.product_component_settings FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update component settings"
ON public.product_component_settings FOR UPDATE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can delete component settings"
ON public.product_component_settings FOR DELETE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

-- Políticas para product_prompt_components
CREATE POLICY "Organization members can view prompt components"
ON public.product_prompt_components FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ) OR
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can insert prompt components"
ON public.product_prompt_components FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update prompt components"
ON public.product_prompt_components FOR UPDATE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can delete prompt components"
ON public.product_prompt_components FOR DELETE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);