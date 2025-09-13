-- Create plan_configurations table
CREATE TABLE public.plan_configurations (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  excel_limit INTEGER NOT NULL DEFAULT 0,
  client_user_limit INTEGER NOT NULL DEFAULT 0,
  available_modules TEXT[] DEFAULT '{}',
  price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on plan_configurations
ALTER TABLE public.plan_configurations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for plan_configurations (read-only for most users)
CREATE POLICY "Everyone can view active plans" ON public.plan_configurations FOR SELECT USING (is_active = true);

-- Add trigger for timestamps
CREATE TRIGGER update_plan_configurations_updated_at BEFORE UPDATE ON public.plan_configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default plan configurations
INSERT INTO public.plan_configurations (plan_id, name, description, excel_limit, client_user_limit, available_modules, price) VALUES
('api_base', 'API Base', 'Plan básico para integraciones API', 10, 0, ARRAY['api', 'excel', 'productos'], 29.99),
('api_pro', 'API Pro', 'Plan profesional para integraciones API', 50, 0, ARRAY['api', 'excel', 'productos', 'categorias'], 79.99),
('client_base', 'Client Base', 'Plan básico para clientes', 5, 5, ARRAY['clientes', 'presupuestos'], 19.99),
('client_pro', 'Client Pro', 'Plan profesional para clientes', 20, 15, ARRAY['clientes', 'presupuestos', 'excel'], 49.99),
('custom', 'Custom', 'Plan personalizado', 100, 50, ARRAY['api', 'excel', 'productos', 'categorias', 'clientes', 'presupuestos'], 199.99);

-- Create indexes for better performance
CREATE INDEX idx_plan_configurations_plan_id ON public.plan_configurations(plan_id);
CREATE INDEX idx_plan_configurations_is_active ON public.plan_configurations(is_active);