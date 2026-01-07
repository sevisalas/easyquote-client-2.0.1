
-- Añadir Antonio a Anebri con rol gestor (mismo rol que tiene en Campillo)
INSERT INTO organization_members (organization_id, user_id, role)
VALUES (
  '95abc5cd-77dd-4f55-8380-f9de4dd85cac', -- Anebri
  '2e123dbf-1e7f-458c-bfa6-f7167cc476d9', -- antonio@campillonevado.es
  'gestor'
)
ON CONFLICT (organization_id, user_id) DO NOTHING;
