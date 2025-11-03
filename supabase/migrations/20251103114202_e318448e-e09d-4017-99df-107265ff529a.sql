-- Add missing fields to sales_orders to match quotes structure
ALTER TABLE sales_orders
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
ADD COLUMN IF NOT EXISTS valid_until DATE;

-- Create sales_order_additionals table (copy of quote_additionals structure)
CREATE TABLE IF NOT EXISTS sales_order_additionals (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  sales_order_id UUID NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
  additional_id UUID REFERENCES additionals(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed',
  value NUMERIC NOT NULL DEFAULT 0,
  is_discount BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sales_order_additionals
ALTER TABLE sales_order_additionals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sales_order_additionals (same logic as sales_order_items)
CREATE POLICY "Users can view organization sales order additionals"
ON sales_order_additionals FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_additionals.sales_order_id
    AND (
      so.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
      )
    )
  )
);

CREATE POLICY "Users can create sales order additionals for organization orders"
ON sales_order_additionals FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_additionals.sales_order_id
    AND (
      so.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
      )
    )
  )
);

CREATE POLICY "Users can update organization sales order additionals"
ON sales_order_additionals FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_additionals.sales_order_id
    AND (
      so.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
      )
    )
  )
);

CREATE POLICY "Users can delete sales order additionals from organization orders"
ON sales_order_additionals FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM sales_orders so
    WHERE so.id = sales_order_additionals.sales_order_id
    AND (
      so.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members om1
        JOIN organization_members om2 ON om1.organization_id = om2.organization_id
        WHERE om1.user_id = auth.uid() AND om2.user_id = so.user_id
      )
    )
  )
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_sales_order_additionals_order_id 
ON sales_order_additionals(sales_order_id);

-- Add trigger for updated_at
CREATE TRIGGER update_sales_order_additionals_updated_at
  BEFORE UPDATE ON sales_order_additionals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();