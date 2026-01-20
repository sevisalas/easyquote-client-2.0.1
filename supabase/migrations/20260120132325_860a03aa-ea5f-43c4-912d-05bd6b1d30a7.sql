-- Create mapping table for EasyQuote images to local categories
CREATE TABLE public.image_category_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  easyquote_image_id TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.image_categories(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(easyquote_image_id, organization_id)
);

-- Enable RLS
ALTER TABLE public.image_category_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org assignments"
  ON public.image_category_assignments FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their org assignments"
  ON public.image_category_assignments FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their org assignments"
  ON public.image_category_assignments FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their org assignments"
  ON public.image_category_assignments FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  ));