-- Create additionals table for configurable extras
CREATE TABLE public.additionals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('net_amount', 'quantity_multiplier')),
  default_value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.additionals ENABLE ROW LEVEL SECURITY;

-- Create policies for additionals
CREATE POLICY "Users can view their own additionals" 
ON public.additionals 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own additionals" 
ON public.additionals 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own additionals" 
ON public.additionals 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own additionals" 
ON public.additionals 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for timestamps
CREATE TRIGGER update_additionals_updated_at
BEFORE UPDATE ON public.additionals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add quote_additionals column to quotes table for quote-level additionals
ALTER TABLE public.quotes 
ADD COLUMN quote_additionals JSONB DEFAULT '[]'::jsonb;

-- Add item_additionals column to quote_items table for item-level additionals
ALTER TABLE public.quote_items 
ADD COLUMN item_additionals JSONB DEFAULT '[]'::jsonb;