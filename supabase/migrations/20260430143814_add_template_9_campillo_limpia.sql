-- Plantilla 9 "Campillo Limpia": exclusiva de Campillo Nevado
INSERT INTO public.pdf_templates (template_number, name, description, organization_id, is_global, is_active, is_custom, thumbnail_url, price)
VALUES (
  9,
  'Campillo Limpia',
  'Diseño limpio sin fondo, estilo factura Holded',
  '108bcc37-fc60-4bc0-a81f-c30641d0ebc9',
  false,
  true,
  true,
  '/assets/template7-preview.png',
  0
)
ON CONFLICT DO NOTHING;
