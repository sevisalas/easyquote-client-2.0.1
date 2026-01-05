-- Create components table for modular product composition
CREATE TABLE public.components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  component_type TEXT NOT NULL DEFAULT 'otro',
  easyquote_product_id TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view components from their organization"
ON public.components FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert components in their organization"
ON public.components FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update components in their organization"
ON public.components FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete components in their organization"
ON public.components FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Index for performance
CREATE INDEX idx_components_organization_id ON public.components(organization_id);
CREATE INDEX idx_components_type ON public.components(component_type);

-- Trigger for updated_at
CREATE TRIGGER update_components_updated_at
BEFORE UPDATE ON public.components
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();