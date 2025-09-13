-- Add missing columns to additionals table
ALTER TABLE public.additionals 
ADD COLUMN type TEXT DEFAULT 'fixed',
ADD COLUMN default_value DECIMAL(10,2) DEFAULT 0;

-- Add missing column to integrations table  
ALTER TABLE public.integrations
ADD COLUMN configuration JSONB DEFAULT '{}';

-- Create product_category_mappings table
CREATE TABLE public.product_category_mappings (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  easyquote_product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.product_subcategories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, easyquote_product_id)
);

-- Enable RLS on product_category_mappings
ALTER TABLE public.product_category_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_category_mappings
CREATE POLICY "Users can view their own mappings" ON public.product_category_mappings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own mappings" ON public.product_category_mappings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own mappings" ON public.product_category_mappings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own mappings" ON public.product_category_mappings FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for timestamps
CREATE TRIGGER update_product_category_mappings_updated_at BEFORE UPDATE ON public.product_category_mappings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_product_category_mappings_user_id ON public.product_category_mappings(user_id);
CREATE INDEX idx_product_category_mappings_easyquote_product_id ON public.product_category_mappings(easyquote_product_id);