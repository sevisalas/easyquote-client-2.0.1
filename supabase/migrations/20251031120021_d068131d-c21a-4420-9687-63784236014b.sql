-- Agregar usuario comercial@reprotel.com a la organización Reprotel
INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES (
  'cae1d80f-fb8e-4101-bed8-d721d5bb8729',  -- Reprotel
  '45341534-3d9d-4330-8b4d-84c9914ae024',  -- comercial@reprotel.com
  'user'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;