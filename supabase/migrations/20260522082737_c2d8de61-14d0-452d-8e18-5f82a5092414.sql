ALTER TABLE public.production_resources
ADD COLUMN phase_id UUID REFERENCES public.production_phases(id) ON DELETE SET NULL;

CREATE INDEX idx_production_resources_phase ON public.production_resources(phase_id);