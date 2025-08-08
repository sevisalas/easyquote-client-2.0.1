-- Enable RLS on customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- SELECT policy
DO $$
BEGIN
  CREATE POLICY "Users can view their own customers"
  ON public.customers
  FOR SELECT
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- INSERT policy
DO $$
BEGIN
  CREATE POLICY "Users can insert their own customers"
  ON public.customers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE policy
DO $$
BEGIN
  CREATE POLICY "Users can update their own customers"
  ON public.customers
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- DELETE policy
DO $$
BEGIN
  CREATE POLICY "Users can delete their own customers"
  ON public.customers
  FOR DELETE
  USING (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;