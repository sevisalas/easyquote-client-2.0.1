ALTER TABLE public.excel_files
ADD COLUMN IF NOT EXISTS associated_master_file_id uuid REFERENCES public.excel_files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_excel_files_associated_master ON public.excel_files(associated_master_file_id);