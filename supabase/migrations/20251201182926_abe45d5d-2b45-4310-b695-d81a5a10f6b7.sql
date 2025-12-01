-- Crear tabla de variables de producción
CREATE TABLE public.production_variables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  variable_type TEXT NOT NULL DEFAULT 'alphanumeric',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Crear tabla de mapeos producto-variable
CREATE TABLE public.product_variable_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  easyquote_product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  prompt_or_output_name TEXT NOT NULL,
  production_variable_id UUID NOT NULL REFERENCES public.production_variables(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, easyquote_product_id, prompt_or_output_name)
);

-- RLS para production_variables
ALTER TABLE public.production_variables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view production variables"
ON public.production_variables FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
  OR organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can insert production variables"
ON public.production_variables FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update production variables"
ON public.production_variables FOR UPDATE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can delete production variables"
ON public.production_variables FOR DELETE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

-- RLS para product_variable_mappings
ALTER TABLE public.product_variable_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view mappings"
ON public.product_variable_mappings FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
  OR organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can insert mappings"
ON public.product_variable_mappings FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update mappings"
ON public.product_variable_mappings FOR UPDATE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can delete mappings"
ON public.product_variable_mappings FOR DELETE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_production_variables_updated_at
BEFORE UPDATE ON public.production_variables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_variable_mappings_updated_at
BEFORE UPDATE ON public.product_variable_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();