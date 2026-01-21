-- =============================================================
-- COMPOSITE PRODUCTS ARCHITECTURE
-- =============================================================

-- 1. Inputs generales del producto compuesto (definidos en la app)
CREATE TABLE public.composite_product_prompts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  easyquote_product_id text NOT NULL,
  name text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'number', -- 'number', 'text', 'select'
  default_value text,
  options jsonb, -- Para selects: [{value: "a4", label: "A4"}, ...]
  display_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, easyquote_product_id, name)
);

-- 2. Outputs generales del producto compuesto (definidos en la app)
CREATE TABLE public.composite_product_outputs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  easyquote_product_id text NOT NULL,
  name text NOT NULL,
  label text NOT NULL,
  type text NOT NULL DEFAULT 'price', -- 'price', 'text', 'number'
  formula text, -- Ej: 'SUM(components.price)' o NULL si es calculado automáticamente
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, easyquote_product_id, name)
);

-- 3. Asociación de componentes EasyQuote al producto compuesto
CREATE TABLE public.composite_product_components (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  composite_product_id text NOT NULL, -- ID del producto compuesto
  component_product_id text NOT NULL, -- ID del componente (producto EasyQuote con is_component=true)
  component_alias text NOT NULL, -- Nombre/alias en este compuesto (ej: "cubierta", "interior")
  display_order integer NOT NULL DEFAULT 0,
  is_optional boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, composite_product_id, component_product_id),
  UNIQUE(organization_id, composite_product_id, component_alias)
);

-- 4. Conexiones: mapeo de inputs generales a prompts de componentes
CREATE TABLE public.composite_prompt_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  composite_product_id text NOT NULL,
  source_prompt_name text NOT NULL, -- Nombre del prompt general (ej: "cantidad_ejemplares")
  target_component_id text NOT NULL, -- ID del componente destino
  target_prompt_name text NOT NULL, -- Nombre del prompt en el componente (ej: "Cantidad")
  transform_formula text, -- Opcional: transformación del valor
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, composite_product_id, target_component_id, target_prompt_name)
);

-- Enable RLS on all tables
ALTER TABLE public.composite_product_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composite_product_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composite_product_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composite_prompt_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for composite_product_prompts
CREATE POLICY "Organization members can view composite prompts"
  ON public.composite_product_prompts FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  ));

CREATE POLICY "Organization admins can manage composite prompts"
  ON public.composite_product_prompts FOR ALL
  USING (organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
    UNION
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for composite_product_outputs
CREATE POLICY "Organization members can view composite outputs"
  ON public.composite_product_outputs FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  ));

CREATE POLICY "Organization admins can manage composite outputs"
  ON public.composite_product_outputs FOR ALL
  USING (organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
    UNION
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for composite_product_components
CREATE POLICY "Organization members can view composite components"
  ON public.composite_product_components FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  ));

CREATE POLICY "Organization admins can manage composite components"
  ON public.composite_product_components FOR ALL
  USING (organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
    UNION
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- RLS Policies for composite_prompt_connections
CREATE POLICY "Organization members can view prompt connections"
  ON public.composite_prompt_connections FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    UNION
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  ));

CREATE POLICY "Organization admins can manage prompt connections"
  ON public.composite_prompt_connections FOR ALL
  USING (organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
    UNION
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role = 'admin'
  ));

-- Indexes for better performance
CREATE INDEX idx_composite_prompts_product ON public.composite_product_prompts(organization_id, easyquote_product_id);
CREATE INDEX idx_composite_outputs_product ON public.composite_product_outputs(organization_id, easyquote_product_id);
CREATE INDEX idx_composite_components_product ON public.composite_product_components(organization_id, composite_product_id);
CREATE INDEX idx_composite_connections_product ON public.composite_prompt_connections(organization_id, composite_product_id);