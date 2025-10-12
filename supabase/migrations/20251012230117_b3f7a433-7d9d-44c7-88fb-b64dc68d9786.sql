-- Create table for PDF configuration per user/organization
CREATE TABLE public.pdf_configurations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  organization_id uuid NULL,
  company_name text NULL,
  logo_url text NULL,
  brand_color text NULL DEFAULT '#3B82F6',
  footer_text text NULL,
  selected_template integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.pdf_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own PDF configuration"
  ON public.pdf_configurations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own PDF configuration"
  ON public.pdf_configurations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own PDF configuration"
  ON public.pdf_configurations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own PDF configuration"
  ON public.pdf_configurations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_pdf_configurations_updated_at
  BEFORE UPDATE ON public.pdf_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();