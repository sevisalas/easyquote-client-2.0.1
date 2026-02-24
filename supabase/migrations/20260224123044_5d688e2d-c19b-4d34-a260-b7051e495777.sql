ALTER TABLE public.organizations
ADD COLUMN hide_all_prompts_in_documents BOOLEAN NOT NULL DEFAULT false;