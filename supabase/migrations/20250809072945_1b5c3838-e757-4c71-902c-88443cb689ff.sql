-- Create or replace timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure quotes table has required columns and RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- Add updated_at if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quotes' AND column_name='updated_at'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
  END IF;
END $$;

-- Fix misnamed customer column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quotes' AND column_name='customer_iduu'
  ) THEN
    EXECUTE 'ALTER TABLE public.quotes RENAME COLUMN customer_iduu TO customer_id';
  END IF;
END $$;

-- Make user_id required and set default
ALTER TABLE public.quotes ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.quotes ALTER COLUMN user_id SET NOT NULL;

-- Ensure customer_id column exists and is uuid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='quotes' AND column_name='customer_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN customer_id uuid;
  END IF;
END $$;

-- Drop any wrong default on customer_id and set NOT NULL if possible
ALTER TABLE public.quotes ALTER COLUMN customer_id DROP DEFAULT;
ALTER TABLE public.quotes ALTER COLUMN customer_id SET NOT NULL;

-- Add FK to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_customer_id_fkey'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_customer_id_fkey FOREIGN KEY (customer_id)
      REFERENCES public.customers(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Ensure status default and valid values constraint
ALTER TABLE public.quotes ALTER COLUMN status SET DEFAULT 'draft';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotes_status_valid_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_status_valid_check CHECK (status IN ('draft','sent','accepted','rejected'));
  END IF;
END $$;

-- Add trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_quotes_updated_at'
  ) THEN
    CREATE TRIGGER update_quotes_updated_at
    BEFORE UPDATE ON public.quotes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Basic indices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='quotes' AND indexname='idx_quotes_user_id'
  ) THEN
    CREATE INDEX idx_quotes_user_id ON public.quotes(user_id);
  END IF;
END $$;

-- RLS policies for quotes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Users can view their own quotes'
  ) THEN
    CREATE POLICY "Users can view their own quotes" ON public.quotes
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Users can insert their own quotes'
  ) THEN
    CREATE POLICY "Users can insert their own quotes" ON public.quotes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Users can update their own quotes'
  ) THEN
    CREATE POLICY "Users can update their own quotes" ON public.quotes
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Users can delete their own quotes'
  ) THEN
    CREATE POLICY "Users can delete their own quotes" ON public.quotes
    FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create quote_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='quote_items'
  ) THEN
    CREATE TABLE public.quote_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
      name text,
      product_id text,
      prompts jsonb NOT NULL DEFAULT '{}'::jsonb,
      outputs jsonb NOT NULL DEFAULT '[]'::jsonb,
      multi jsonb,
      quantity numeric,
      unit_price numeric,
      total_price numeric,
      position int DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  END IF;
END $$;

-- RLS for quote_items
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_items' AND policyname='Item select by owner'
  ) THEN
    CREATE POLICY "Item select by owner" ON public.quote_items
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_items' AND policyname='Item insert by owner'
  ) THEN
    CREATE POLICY "Item insert by owner" ON public.quote_items
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_items' AND policyname='Item update by owner'
  ) THEN
    CREATE POLICY "Item update by owner" ON public.quote_items
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid()
      )
    ) WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid()
      )
    );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quote_items' AND policyname='Item delete by owner'
  ) THEN
    CREATE POLICY "Item delete by owner" ON public.quote_items
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id AND q.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Triggers and indexes for quote_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_quote_items_updated_at'
  ) THEN
    CREATE TRIGGER update_quote_items_updated_at
    BEFORE UPDATE ON public.quote_items
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='quote_items' AND indexname='idx_quote_items_quote_id'
  ) THEN
    CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);
  END IF;
END $$;