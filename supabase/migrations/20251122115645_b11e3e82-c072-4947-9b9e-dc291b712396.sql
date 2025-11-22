-- Insert comercial role for comercial@reprotel.com user
INSERT INTO user_roles (user_id, role) 
VALUES ('45341534-3d9d-4330-8b4d-84c9914ae024', 'comercial')
ON CONFLICT (user_id, role) DO NOTHING;