
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS portal_user_id uuid,
  ADD COLUMN IF NOT EXISTS portal_invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_last_login_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS customers_portal_user_id_key
  ON public.customers (portal_user_id)
  WHERE portal_user_id IS NOT NULL;

-- Allow the portal-authenticated customer to read their own customer row
CREATE POLICY "Portal customer can view own customer row"
ON public.customers
FOR SELECT
TO authenticated
USING (portal_user_id = auth.uid() AND portal_enabled = true);

-- Allow the portal-authenticated customer to read their own quotes
CREATE POLICY "Portal customer can view own quotes"
ON public.quotes
FOR SELECT
TO authenticated
USING (
  customer_id IN (
    SELECT id FROM public.customers
    WHERE portal_user_id = auth.uid() AND portal_enabled = true
  )
);

-- Allow the portal-authenticated customer to read items of their own quotes
CREATE POLICY "Portal customer can view own quote items"
ON public.quote_items
FOR SELECT
TO authenticated
USING (
  quote_id IN (
    SELECT q.id FROM public.quotes q
    JOIN public.customers c ON c.id = q.customer_id
    WHERE c.portal_user_id = auth.uid() AND c.portal_enabled = true
  )
);

-- Allow the portal-authenticated customer to read additionals of their own quotes
CREATE POLICY "Portal customer can view own quote additionals"
ON public.quote_additionals
FOR SELECT
TO authenticated
USING (
  quote_id IN (
    SELECT q.id FROM public.quotes q
    JOIN public.customers c ON c.id = q.customer_id
    WHERE c.portal_user_id = auth.uid() AND c.portal_enabled = true
  )
);
