-- Create table for plan configurations
CREATE TABLE public.plan_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  excel_limit INTEGER NOT NULL DEFAULT 0,
  client_user_limit INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_configurations ENABLE ROW LEVEL SECURITY;

-- Only superadmins can manage plan configurations
CREATE POLICY "Only superadmins can manage plan configurations" 
ON public.plan_configurations 
FOR ALL 
USING (is_superadmin())
WITH CHECK (is_superadmin());

-- Insert default plan configurations
INSERT INTO public.plan_configurations (plan_id, name, excel_limit, client_user_limit) VALUES
('api_base', 'API Base', 100, 1),
('api_pro', 'API Pro', 500, 1),
('client_base', 'Cliente Base', 100, 2),
('client_pro', 'Cliente Pro', 500, 5),
('custom', 'Personalizado', 1000, 10);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_plan_configurations_updated_at
BEFORE UPDATE ON public.plan_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();