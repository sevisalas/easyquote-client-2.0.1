-- Eliminar la foreign key constraint que limita customer_id solo a la tabla customers
-- Esto permite que quotes pueda referenciar tanto clientes locales como contactos de Holded

ALTER TABLE public.quotes 
DROP CONSTRAINT IF EXISTS quotes_customer_id_fkey;