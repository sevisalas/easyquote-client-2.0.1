-- Insert WooCommerce integration if it doesn't exist
-- First check if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.integrations WHERE name = 'WooCommerce'
  ) THEN
    INSERT INTO public.integrations (name, integration_type, description, is_active)
    VALUES (
      'WooCommerce',
      'ecommerce',
      'Integración con WooCommerce para sincronizar productos y gestionar tiendas online',
      true
    );
  END IF;
END $$;