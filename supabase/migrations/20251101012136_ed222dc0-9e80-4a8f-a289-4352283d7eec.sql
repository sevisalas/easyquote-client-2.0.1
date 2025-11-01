-- Drop existing sales_orders policies
DROP POLICY IF EXISTS "Organization members can update sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Organization members can create sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can view organization sales orders" ON public.sales_orders;
DROP POLICY IF EXISTS "Users can delete their own sales orders" ON public.sales_orders;

-- Comercial can only VIEW sales orders (read-only, cannot edit or change status)
CREATE POLICY "Comercial can view sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'comercial') AND
  auth.uid() = user_id
);

-- Comercial can CREATE sales orders from quotes
CREATE POLICY "Comercial can create sales orders"
ON public.sales_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'comercial') AND
  auth.uid() = user_id
);

-- Admin can do everything with sales orders
CREATE POLICY "Admin can manage sales orders"
ON public.sales_orders
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Operador can only VIEW sales orders (read-only, for production)
CREATE POLICY "Operador can view sales orders"
ON public.sales_orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'operador') AND
  (auth.uid() = user_id OR EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = sales_orders.user_id
  ))
);

-- Update quotes policies
DROP POLICY IF EXISTS "Organization members can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Organization members can create quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can view organization quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON public.quotes;

-- Comercial can manage ONLY THEIR OWN quotes
CREATE POLICY "Comercial can manage own quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'comercial') AND
  auth.uid() = user_id
)
WITH CHECK (
  public.has_role(auth.uid(), 'comercial') AND
  auth.uid() = user_id
);

-- Admin can manage all quotes
CREATE POLICY "Admin can manage all quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') AND
  (auth.uid() = user_id OR EXISTS (
    SELECT 1
    FROM organization_members om1
    JOIN organization_members om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid() AND om2.user_id = quotes.user_id
  ))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
);