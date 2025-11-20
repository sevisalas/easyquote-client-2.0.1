-- Cambiar el valor por defecto de selected_theme a NULL
ALTER TABLE profiles ALTER COLUMN selected_theme SET DEFAULT NULL;

-- Actualizar todos los registros que tienen 'default' a NULL para usar el diseño original
UPDATE profiles SET selected_theme = NULL WHERE selected_theme = 'default';