-- Añadir registro de integración Holded para Reprotel
INSERT INTO organization_integration_access (
  organization_id,
  integration_id,
  is_active,
  generate_pdfs
) VALUES (
  'cae1d80f-fb8e-4101-bed8-d721d5bb8729', -- Reprotel
  '057530ab-4982-40c1-bc92-b2a4ff7af8a8', -- Holded
  true,
  true
)
ON CONFLICT (organization_id, integration_id) DO UPDATE 
SET is_active = true;