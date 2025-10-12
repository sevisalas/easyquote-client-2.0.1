-- Create pdf_templates table for storing both global and organization-specific templates
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  template_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  is_global BOOLEAN NOT NULL DEFAULT false,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  price NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure global templates don't have organization_id
  CONSTRAINT check_global_no_org CHECK (
    (is_global = true AND organization_id IS NULL) OR
    (is_global = false AND organization_id IS NOT NULL)
  ),
  
  -- Unique constraint: template_number must be unique per organization (or globally)
  CONSTRAINT unique_template_per_org UNIQUE (organization_id, template_number)
);

-- Enable RLS
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- Users can view global templates and their organization's custom templates
CREATE POLICY "Users can view available templates"
ON public.pdf_templates
FOR SELECT
USING (
  is_active = true AND (
    is_global = true OR 
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  )
);

-- Only superadmins can create global templates
CREATE POLICY "Superadmins can create global templates"
ON public.pdf_templates
FOR INSERT
WITH CHECK (
  is_global = true AND is_superadmin()
);

-- Organization owners can create custom templates for their organization
CREATE POLICY "Organization owners can create custom templates"
ON public.pdf_templates
FOR INSERT
WITH CHECK (
  is_global = false AND 
  organization_id IN (
    SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
  )
);

-- Superadmins can update any template
CREATE POLICY "Superadmins can update templates"
ON public.pdf_templates
FOR UPDATE
USING (is_superadmin());

-- Organization owners can update their custom templates
CREATE POLICY "Organization owners can update custom templates"
ON public.pdf_templates
FOR UPDATE
USING (
  is_global = false AND 
  organization_id IN (
    SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
  )
);

-- Superadmins can delete any template
CREATE POLICY "Superadmins can delete templates"
ON public.pdf_templates
FOR DELETE
USING (is_superadmin());

-- Organization owners can delete their custom templates
CREATE POLICY "Organization owners can delete custom templates"
ON public.pdf_templates
FOR DELETE
USING (
  is_global = false AND 
  organization_id IN (
    SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
  )
);

-- Insert default global templates (numbered 1-6)
INSERT INTO public.pdf_templates (template_number, name, description, thumbnail_url, is_global, is_custom)
VALUES
  (1, 'Clásico', 'Diseño clásico y profesional', '/assets/template1-preview.png', true, false),
  (2, 'Moderno', 'Diseño moderno con colores vibrantes', '/assets/template2-preview.png', true, false),
  (3, 'Minimalista', 'Diseño limpio y minimalista', '/assets/template3-preview.png', true, false),
  (4, 'Corporativo', 'Diseño corporativo elegante', '/assets/template4-preview.png', true, false),
  (5, 'Creativo', 'Diseño creativo y llamativo', '/assets/template5-preview.png', true, false),
  (6, 'Ejecutivo', 'Diseño ejecutivo premium', '/assets/template6-preview.png', true, false)
ON CONFLICT (organization_id, template_number) DO NOTHING;

-- Create trigger to update updated_at
CREATE TRIGGER update_pdf_templates_updated_at
BEFORE UPDATE ON public.pdf_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();