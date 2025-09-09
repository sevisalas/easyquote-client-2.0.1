-- Create table for Excel files metadata
CREATE TABLE public.excel_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL, -- ID del archivo en la API externa
  file_name TEXT NOT NULL,
  is_master BOOLEAN NOT NULL DEFAULT false,
  file_url TEXT, -- URL completa del archivo cuando es master
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, file_id)
);

-- Enable Row Level Security
ALTER TABLE public.excel_files ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own Excel files" 
ON public.excel_files 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Excel files" 
ON public.excel_files 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Excel files" 
ON public.excel_files 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Excel files" 
ON public.excel_files 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_excel_files_updated_at
BEFORE UPDATE ON public.excel_files
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();