-- Add missing columns to fix TypeScript errors

-- Add missing columns to integrations table
ALTER TABLE public.integrations 
ADD COLUMN IF NOT EXISTS integration_type TEXT,
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add missing selections column to quotes table (for compatibility)
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS selections JSONB DEFAULT '{}';

-- Update quotes table to ensure all required columns exist
ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS product_id TEXT,
ADD COLUMN IF NOT EXISTS prompts JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS outputs JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS multi INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS item_additionals JSONB DEFAULT '[]';