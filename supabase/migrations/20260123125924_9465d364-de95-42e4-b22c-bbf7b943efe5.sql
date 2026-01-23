-- Tabla para configurar agregación de outputs de componentes hacia el producto padre
CREATE TABLE public.composite_output_aggregations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  composite_product_id TEXT NOT NULL,
  organization_id UUID NOT NULL,
  -- Output del componente que se agrega
  source_output_name TEXT NOT NULL,
  -- Nombre del output agregado en el padre (puede ser diferente del source)
  target_output_name TEXT NOT NULL,
  -- Etiqueta visible del output agregado
  target_output_label TEXT NOT NULL,
  -- Tipo de agregación: 'sum' por ahora
  aggregation_type TEXT NOT NULL DEFAULT 'sum',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Evitar duplicados
  UNIQUE(composite_product_id, organization_id, source_output_name)
);

-- Enable RLS
ALTER TABLE public.composite_output_aggregations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own organization aggregations"
ON public.composite_output_aggregations
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert own organization aggregations"
ON public.composite_output_aggregations
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own organization aggregations"
ON public.composite_output_aggregations
FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own organization aggregations"
ON public.composite_output_aggregations
FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_composite_output_aggregations_updated_at
BEFORE UPDATE ON public.composite_output_aggregations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();