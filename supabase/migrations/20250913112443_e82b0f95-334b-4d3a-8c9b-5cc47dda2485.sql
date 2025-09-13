-- Add missing columns to quotes table to fix errors
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS quote_additionals JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS product_name TEXT;

-- Create quote_additionals table if it doesn't exist (for proper relational structure)
CREATE TABLE IF NOT EXISTS public.quote_additionals (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  additional_id UUID REFERENCES public.additionals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed',
  value DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quote_additionals
ALTER TABLE public.quote_additionals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for quote_additionals
CREATE POLICY "Users can view their own quote additionals" ON public.quote_additionals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_additionals.quote_id AND quotes.user_id = auth.uid())
);
CREATE POLICY "Users can create quote additionals for their quotes" ON public.quote_additionals FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_additionals.quote_id AND quotes.user_id = auth.uid())
);
CREATE POLICY "Users can update their own quote additionals" ON public.quote_additionals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_additionals.quote_id AND quotes.user_id = auth.uid())
);
CREATE POLICY "Users can delete their own quote additionals" ON public.quote_additionals FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = quote_additionals.quote_id AND quotes.user_id = auth.uid())
);

-- Add trigger for timestamps
CREATE TRIGGER update_quote_additionals_updated_at BEFORE UPDATE ON public.quote_additionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_quote_additionals_quote_id ON public.quote_additionals(quote_id);
CREATE INDEX idx_quote_additionals_additional_id ON public.quote_additionals(additional_id);