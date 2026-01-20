-- Create image_categories table for organizing images
CREATE TABLE public.image_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1', -- For visual distinction
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Add category_id to images table
ALTER TABLE public.images 
ADD COLUMN category_id UUID REFERENCES public.image_categories(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.image_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for image_categories
CREATE POLICY "Users can view their own categories" 
ON public.image_categories FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own categories" 
ON public.image_categories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories" 
ON public.image_categories FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categories" 
ON public.image_categories FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_images_category_id ON public.images(category_id);
CREATE INDEX idx_image_categories_user_id ON public.image_categories(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_image_categories_updated_at
BEFORE UPDATE ON public.image_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();