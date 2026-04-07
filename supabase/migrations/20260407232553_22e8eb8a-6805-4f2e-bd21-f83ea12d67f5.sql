
-- Create tariffs table (organization-level)
CREATE TABLE public.tariffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  percentage NUMERIC NOT NULL DEFAULT 0,
  is_discount BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add tariff_id to customers
ALTER TABLE public.customers
ADD COLUMN tariff_id UUID REFERENCES public.tariffs(id) ON DELETE SET NULL;

-- Migrate existing customer_discounts data into tariffs
INSERT INTO public.tariffs (organization_id, name, percentage, is_discount, is_active, created_at, updated_at)
SELECT DISTINCT organization_id, name, percentage, is_discount, is_active, created_at, updated_at
FROM public.customer_discounts;

-- Link customers to their migrated tariffs
UPDATE public.customers c
SET tariff_id = t.id
FROM public.customer_discounts cd
JOIN public.tariffs t ON t.name = cd.name AND t.organization_id = cd.organization_id AND t.percentage = cd.percentage
WHERE c.id = cd.customer_id;

-- Enable RLS
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

-- RLS: only org admins can manage tariffs
CREATE POLICY "Org admins can view tariffs"
ON public.tariffs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tariffs.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  )
);

CREATE POLICY "Org admins can insert tariffs"
ON public.tariffs FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tariffs.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  )
);

CREATE POLICY "Org admins can update tariffs"
ON public.tariffs FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tariffs.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  )
);

CREATE POLICY "Org admins can delete tariffs"
ON public.tariffs FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tariffs.organization_id
      AND om.user_id = auth.uid()
      AND om.role = 'admin'
  )
);

-- Also allow all org members to SELECT tariffs (needed for quote calculation)
CREATE POLICY "Org members can view tariffs"
ON public.tariffs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = tariffs.organization_id
      AND om.user_id = auth.uid()
  )
);
