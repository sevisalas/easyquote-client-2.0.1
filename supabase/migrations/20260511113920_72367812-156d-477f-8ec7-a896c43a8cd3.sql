
-- 1) Customers: prevent non-owners from escalating portal access
CREATE OR REPLACE FUNCTION public.guard_customer_portal_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner boolean;
  v_is_super boolean;
BEGIN
  IF NEW.portal_user_id IS DISTINCT FROM OLD.portal_user_id
     OR NEW.portal_enabled IS DISTINCT FROM OLD.portal_enabled
     OR NEW.portal_enabled_by IS DISTINCT FROM OLD.portal_enabled_by THEN
    v_is_super := public.is_superadmin();
    v_is_owner := EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = NEW.organization_id AND o.api_user_id = auth.uid()
    );
    IF NOT v_is_super AND NOT v_is_owner THEN
      RAISE EXCEPTION 'Only the organization owner can modify portal access fields';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_customer_portal_fields_trg ON public.customers;
CREATE TRIGGER guard_customer_portal_fields_trg
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.guard_customer_portal_fields();

-- 2) Sales orders: tighten the broad SELECT policy
DROP POLICY IF EXISTS "Users can view accessible sales orders" ON public.sales_orders;

CREATE POLICY "Users can view accessible sales orders"
ON public.sales_orders
FOR SELECT
USING (
  auth.uid() = user_id
  OR public.is_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.organizations org
    WHERE org.api_user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = org.id
          AND om.user_id = sales_orders.user_id
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.organization_members om1
    JOIN public.organization_members om2
      ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om1.role IN ('admin','gestor')
      AND om2.user_id = sales_orders.user_id
  )
);

-- 3) Storage: explicit UPDATE policy for document-attachments bucket
DROP POLICY IF EXISTS "Org members and owners can update attachments" ON storage.objects;
CREATE POLICY "Org members and owners can update attachments"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'document-attachments'
  AND (
    public.is_organization_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_organization_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'document-attachments'
  AND (
    public.is_organization_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_organization_owner(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
