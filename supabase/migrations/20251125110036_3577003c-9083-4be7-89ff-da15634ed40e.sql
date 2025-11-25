-- Create production_phases table (catalog of production phases)
CREATE TABLE IF NOT EXISTS public.production_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create production_tasks table (production tasks for items)
CREATE TABLE IF NOT EXISTS public.production_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_item_id UUID NOT NULL REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
  phase_id UUID NOT NULL REFERENCES public.production_phases(id),
  task_name TEXT NOT NULL,
  operator_id UUID NOT NULL,
  status TEXT DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_time_seconds INTEGER DEFAULT 0,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add production_status to sales_order_items
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS production_status TEXT DEFAULT 'pending';

-- Add production_progress to sales_orders
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS production_progress JSONB DEFAULT '{}';

-- Enable RLS on production tables
ALTER TABLE public.production_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for production_phases (public read for authenticated users)
CREATE POLICY "Authenticated users can view production phases"
ON public.production_phases
FOR SELECT
TO authenticated
USING (true);

-- Only superadmins can manage phases
CREATE POLICY "Superadmins can manage production phases"
ON public.production_phases
FOR ALL
TO authenticated
USING (is_superadmin())
WITH CHECK (is_superadmin());

-- RLS Policies for production_tasks (organization-based access)
CREATE POLICY "Users can view organization production tasks"
ON public.production_tasks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales_order_items soi
    JOIN public.sales_orders so ON so.id = soi.sales_order_id
    WHERE soi.id = production_tasks.sales_order_item_id
      AND (
        so.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.organization_members om1
          JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
          WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
        )
      )
  )
);

CREATE POLICY "Users can create organization production tasks"
ON public.production_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.sales_order_items soi
    JOIN public.sales_orders so ON so.id = soi.sales_order_id
    WHERE soi.id = production_tasks.sales_order_item_id
      AND (
        so.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.organization_members om1
          JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
          WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
        )
      )
  )
);

CREATE POLICY "Users can update organization production tasks"
ON public.production_tasks
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales_order_items soi
    JOIN public.sales_orders so ON so.id = soi.sales_order_id
    WHERE soi.id = production_tasks.sales_order_item_id
      AND (
        so.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.organization_members om1
          JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
          WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
        )
      )
  )
);

CREATE POLICY "Users can delete organization production tasks"
ON public.production_tasks
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sales_order_items soi
    JOIN public.sales_orders so ON so.id = soi.sales_order_id
    WHERE soi.id = production_tasks.sales_order_item_id
      AND (
        so.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.organization_members om1
          JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
          WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
        )
      )
  )
);

-- Insert initial production phases
INSERT INTO public.production_phases (name, display_name, display_order, color) VALUES
  ('preimpresion', 'Preimpresión', 1, '#8B5CF6'),
  ('impresion', 'Impresión', 2, '#3B82F6'),
  ('acabados', 'Acabados', 3, '#10B981'),
  ('externo', 'Externo', 4, '#F59E0B'),
  ('envio', 'Envío', 5, '#EF4444')
ON CONFLICT (name) DO NOTHING;