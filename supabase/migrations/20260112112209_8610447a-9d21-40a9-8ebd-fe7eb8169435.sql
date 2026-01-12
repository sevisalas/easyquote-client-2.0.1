-- Añadir rol admin para Daniel en user_roles
INSERT INTO public.user_roles (user_id, role)
VALUES ('a21eb8c8-e9fa-4afb-812f-b0fa48aea3e4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;