-- Junction table: objectives can belong to multiple sprints
CREATE TABLE public.development_task_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.development_tasks(id) ON DELETE CASCADE,
  sprint_id uuid NOT NULL REFERENCES public.development_sprints(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (task_id, sprint_id)
);

-- Enable RLS
ALTER TABLE public.development_task_sprints ENABLE ROW LEVEL SECURITY;

-- Same superadmin-only policies
CREATE POLICY "SuperAdmins can view task sprints"
  ON public.development_task_sprints FOR SELECT
  TO authenticated
  USING (is_superadmin());

CREATE POLICY "SuperAdmins can insert task sprints"
  ON public.development_task_sprints FOR INSERT
  TO authenticated
  WITH CHECK (is_superadmin());

CREATE POLICY "SuperAdmins can delete task sprints"
  ON public.development_task_sprints FOR DELETE
  TO authenticated
  USING (is_superadmin());

-- Migrate existing sprint_id data
INSERT INTO public.development_task_sprints (task_id, sprint_id)
SELECT id, sprint_id FROM public.development_tasks
WHERE sprint_id IS NOT NULL;

-- Drop the old column
ALTER TABLE public.development_tasks DROP COLUMN sprint_id;