-- Add assignment_type column to additionals table
ALTER TABLE public.additionals
ADD COLUMN assignment_type TEXT DEFAULT 'article' CHECK (assignment_type IN ('article', 'quote', 'global'));

-- Create excel_files table
CREATE TABLE public.excel_files (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_id TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on excel_files
ALTER TABLE public.excel_files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for excel_files
CREATE POLICY "Users can view their own excel files" ON public.excel_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own excel files" ON public.excel_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own excel files" ON public.excel_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own excel files" ON public.excel_files FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for timestamps
CREATE TRIGGER update_excel_files_updated_at BEFORE UPDATE ON public.excel_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_excel_files_user_id ON public.excel_files(user_id);
CREATE INDEX idx_excel_files_file_id ON public.excel_files(file_id);
CREATE INDEX idx_excel_files_processed ON public.excel_files(processed);
CREATE INDEX idx_excel_files_upload_date ON public.excel_files(upload_date);