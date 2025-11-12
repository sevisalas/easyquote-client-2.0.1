-- Update RLS policies for sales_orders to restrict draft visibility

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view sales orders in their organization" ON sales_orders;
DROP POLICY IF EXISTS "Users can create sales orders" ON sales_orders;
DROP POLICY IF EXISTS "Users can update sales orders in their organization" ON sales_orders;
DROP POLICY IF EXISTS "Users can delete sales orders in their organization" ON sales_orders;

-- Create new policies with draft restriction
-- View policy: Users can only see drafts they created, but all non-draft orders in their org
CREATE POLICY "Users can view sales orders with draft restriction"
ON sales_orders
FOR SELECT
USING (
  -- User can see their own orders (including drafts)
  user_id = auth.uid()
  OR
  -- User can see non-draft orders in their organization
  (
    status != 'draft'
    AND
    user_id IN (
      SELECT om1.user_id
      FROM organization_members om1
      WHERE om1.organization_id IN (
        SELECT om2.organization_id
        FROM organization_members om2
        WHERE om2.user_id = auth.uid()
      )
    )
  )
);

-- Create policy: Users can create their own orders
CREATE POLICY "Users can create their own sales orders"
ON sales_orders
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Update policy: Users can update orders in their organization
CREATE POLICY "Users can update sales orders in their organization"
ON sales_orders
FOR UPDATE
USING (
  user_id IN (
    SELECT om1.user_id
    FROM organization_members om1
    WHERE om1.organization_id IN (
      SELECT om2.organization_id
      FROM organization_members om2
      WHERE om2.user_id = auth.uid()
    )
  )
);

-- Delete policy: Users can delete orders in their organization
CREATE POLICY "Users can delete sales orders in their organization"
ON sales_orders
FOR DELETE
USING (
  user_id IN (
    SELECT om1.user_id
    FROM organization_members om1
    WHERE om1.organization_id IN (
      SELECT om2.organization_id
      FROM organization_members om2
      WHERE om2.user_id = auth.uid()
    )
  )
);

-- Update RLS policies for sales_order_items to match parent order visibility
DROP POLICY IF EXISTS "Users can view sales order items" ON sales_order_items;

CREATE POLICY "Users can view sales order items with draft restriction"
ON sales_order_items
FOR SELECT
USING (
  sales_order_id IN (
    SELECT id FROM sales_orders
    WHERE 
      -- User can see their own order items (including drafts)
      user_id = auth.uid()
      OR
      -- User can see non-draft order items in their organization
      (
        status != 'draft'
        AND
        user_id IN (
          SELECT om1.user_id
          FROM organization_members om1
          WHERE om1.organization_id IN (
            SELECT om2.organization_id
            FROM organization_members om2
            WHERE om2.user_id = auth.uid()
          )
        )
      )
  )
);