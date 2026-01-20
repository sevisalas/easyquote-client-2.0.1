-- Create subcategories table for images
CREATE TABLE public.image_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.image_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(category_id, name)
);

-- Enable RLS
ALTER TABLE public.image_subcategories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org subcategories"
  ON public.image_subcategories FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their org subcategories"
  ON public.image_subcategories FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their org subcategories"
  ON public.image_subcategories FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their org subcategories"
  ON public.image_subcategories FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));

-- Add subcategory to assignments table
ALTER TABLE public.image_category_assignments 
ADD COLUMN subcategory_id UUID REFERENCES public.image_subcategories(id) ON DELETE SET NULL;