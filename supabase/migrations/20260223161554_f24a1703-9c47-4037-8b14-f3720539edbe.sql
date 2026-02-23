
-- Add terms_page_text column to pdf_configurations
ALTER TABLE public.pdf_configurations ADD COLUMN IF NOT EXISTS terms_page_text text;

-- Insert Template 7 for Campillo Nevado only
INSERT INTO public.pdf_templates (template_number, name, description, is_global, is_custom, is_active, organization_id, thumbnail_url)
VALUES (7, 'Campillo', 'Plantilla corporativa exclusiva de Campillo Nevado S.A. con condiciones de venta', false, true, true, '108bcc37-fc60-4bc0-a81f-c30641d0ebc9', '/assets/template7-preview.png')
ON CONFLICT DO NOTHING;
