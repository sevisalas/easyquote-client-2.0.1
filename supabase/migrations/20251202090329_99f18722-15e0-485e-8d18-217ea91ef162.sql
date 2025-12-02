-- Create default_production_tasks table
CREATE TABLE IF NOT EXISTS public.default_production_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_name TEXT NOT NULL,
  phase_id UUID NOT NULL REFERENCES public.production_phases(id) ON DELETE RESTRICT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for organization_id
CREATE INDEX idx_default_production_tasks_organization_id 
ON public.default_production_tasks(organization_id);

-- Create index for phase_id
CREATE INDEX idx_default_production_tasks_phase_id 
ON public.default_production_tasks(phase_id);

-- Enable RLS
ALTER TABLE public.default_production_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Organization members can view default tasks"
ON public.default_production_tasks
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
  OR
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can insert default tasks"
ON public.default_production_tasks
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can update default tasks"
ON public.default_production_tasks
FOR UPDATE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

CREATE POLICY "Organization owners can delete default tasks"
ON public.default_production_tasks
FOR DELETE
USING (
  organization_id IN (
    SELECT id FROM organizations WHERE api_user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_default_production_tasks_updated_at
BEFORE UPDATE ON public.default_production_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();