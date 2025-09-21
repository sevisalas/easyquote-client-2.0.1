-- Create images table for storing image metadata
CREATE TABLE public.images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  storage_path TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own images" 
ON public.images 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own images" 
ON public.images 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own images" 
ON public.images 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own images" 
ON public.images 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create storage bucket for images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Create storage policies
CREATE POLICY "Users can view product images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Users can upload their own product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create trigger for updated_at
CREATE TRIGGER update_images_updated_at
BEFORE UPDATE ON public.images
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();