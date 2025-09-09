-- Create product categories table
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product subcategories table
CREATE TABLE public.product_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

-- Create policies for product_categories
CREATE POLICY "Users can view their own categories" 
ON public.product_categories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories" 
ON public.product_categories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
ON public.product_categories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
ON public.product_categories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for product_subcategories
CREATE POLICY "Users can view their own subcategories" 
ON public.product_subcategories 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subcategories" 
ON public.product_subcategories 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subcategories" 
ON public.product_subcategories 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subcategories" 
ON public.product_subcategories 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add category and subcategory columns to existing products-related tables if needed
-- (This would depend on your current product structure)

-- Create indexes for better performance
CREATE INDEX idx_product_categories_user_id ON public.product_categories(user_id);
CREATE INDEX idx_product_categories_name ON public.product_categories(name);
CREATE INDEX idx_product_subcategories_user_id ON public.product_subcategories(user_id);
CREATE INDEX idx_product_subcategories_category_id ON public.product_subcategories(category_id);

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_product_categories_updated_at
BEFORE UPDATE ON public.product_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_subcategories_updated_at
BEFORE UPDATE ON public.product_subcategories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();