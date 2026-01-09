-- Create development_sprints table
CREATE TABLE IF NOT EXISTS public.development_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed')),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create development_tasks table
CREATE TABLE IF NOT EXISTS public.development_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID REFERENCES public.development_sprints(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('integration', 'feature', 'improvement', 'bugfix', 'infrastructure')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in_progress', 'testing', 'done')),
  estimated_hours INTEGER,
  actual_hours INTEGER,
  notes TEXT,
  related_version TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.development_sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for development_sprints using is_superadmin() function
CREATE POLICY "SuperAdmins can view all sprints"
ON public.development_sprints FOR SELECT
USING (public.is_superadmin());

CREATE POLICY "SuperAdmins can insert sprints"
ON public.development_sprints FOR INSERT
WITH CHECK (public.is_superadmin());

CREATE POLICY "SuperAdmins can update sprints"
ON public.development_sprints FOR UPDATE
USING (public.is_superadmin());

CREATE POLICY "SuperAdmins can delete sprints"
ON public.development_sprints FOR DELETE
USING (public.is_superadmin());

-- RLS policies for development_tasks using is_superadmin() function
CREATE POLICY "SuperAdmins can view all tasks"
ON public.development_tasks FOR SELECT
USING (public.is_superadmin());

CREATE POLICY "SuperAdmins can insert tasks"
ON public.development_tasks FOR INSERT
WITH CHECK (public.is_superadmin());

CREATE POLICY "SuperAdmins can update tasks"
ON public.development_tasks FOR UPDATE
USING (public.is_superadmin());

CREATE POLICY "SuperAdmins can delete tasks"
ON public.development_tasks FOR DELETE
USING (public.is_superadmin());

-- Trigger for updated_at on sprints
CREATE TRIGGER update_development_sprints_updated_at
BEFORE UPDATE ON public.development_sprints
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on tasks
CREATE TRIGGER update_development_tasks_updated_at
BEFORE UPDATE ON public.development_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_development_tasks_sprint_id ON public.development_tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_development_tasks_status ON public.development_tasks(status);
CREATE INDEX IF NOT EXISTS idx_development_tasks_category ON public.development_tasks(category);
CREATE INDEX IF NOT EXISTS idx_development_sprints_status ON public.development_sprints(status);