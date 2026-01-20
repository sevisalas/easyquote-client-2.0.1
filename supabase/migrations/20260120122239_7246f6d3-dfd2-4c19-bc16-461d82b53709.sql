-- Add organization_id to images table for multi-tenant support
ALTER TABLE public.images 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Create index for better performance
CREATE INDEX idx_images_organization_id ON public.images(organization_id);

-- Update existing images to get organization_id from user's membership
UPDATE public.images i
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om 
  WHERE om.user_id = i.user_id 
  LIMIT 1
)
WHERE i.organization_id IS NULL;

-- Update RLS policies to use organization_id
DROP POLICY IF EXISTS "Users can view their own images" ON public.images;
DROP POLICY IF EXISTS "Users can insert their own images" ON public.images;
DROP POLICY IF EXISTS "Users can update their own images" ON public.images;
DROP POLICY IF EXISTS "Users can delete their own images" ON public.images;

-- New policies based on organization membership
CREATE POLICY "Organization members can view images" 
ON public.images FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert images" 
ON public.images FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update images" 
ON public.images FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can delete images" 
ON public.images FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Also update image_categories for organization-level sharing
ALTER TABLE public.image_categories 
ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX idx_image_categories_organization_id ON public.image_categories(organization_id);

-- Update existing categories
UPDATE public.image_categories c
SET organization_id = (
  SELECT om.organization_id 
  FROM public.organization_members om 
  WHERE om.user_id = c.user_id 
  LIMIT 1
)
WHERE c.organization_id IS NULL;

-- Update RLS policies for categories
DROP POLICY IF EXISTS "Users can view their own categories" ON public.image_categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.image_categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.image_categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.image_categories;

CREATE POLICY "Organization members can view categories" 
ON public.image_categories FOR SELECT 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can insert categories" 
ON public.image_categories FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can update categories" 
ON public.image_categories FOR UPDATE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Organization members can delete categories" 
ON public.image_categories FOR DELETE 
USING (
  organization_id IN (
    SELECT organization_id FROM public.organization_members 
    WHERE user_id = auth.uid()
  )
);