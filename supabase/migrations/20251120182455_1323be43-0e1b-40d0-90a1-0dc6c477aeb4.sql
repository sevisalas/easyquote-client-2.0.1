-- Añadir columna para colores personalizados en profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS custom_colors jsonb DEFAULT NULL;