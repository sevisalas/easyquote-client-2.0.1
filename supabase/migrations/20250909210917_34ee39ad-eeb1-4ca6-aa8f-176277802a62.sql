-- Create product category mappings table to connect EasyQuote products with our categories
CREATE TABLE public.product_category_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  easyquote_product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.product_subcategories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure unique mapping per user and product
  UNIQUE(user_id, easyquote_product_id)
);

-- Enable RLS
ALTER TABLE public.product_category_mappings ENABLE ROW LEVEL SECURITY;

-- Create policies for product_category_mappings
CREATE POLICY "Users can view their own product mappings" 
ON public.product_category_mappings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own product mappings" 
ON public.product_category_mappings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own product mappings" 
ON public.product_category_mappings 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product mappings" 
ON public.product_category_mappings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_product_category_mappings_user_id ON public.product_category_mappings(user_id);
CREATE INDEX idx_product_category_mappings_product_id ON public.product_category_mappings(easyquote_product_id);
CREATE INDEX idx_product_category_mappings_category_id ON public.product_category_mappings(category_id);
CREATE INDEX idx_product_category_mappings_subcategory_id ON public.product_category_mappings(subcategory_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_product_category_mappings_updated_at
BEFORE UPDATE ON public.product_category_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();