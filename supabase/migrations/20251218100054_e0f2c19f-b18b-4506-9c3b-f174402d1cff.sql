-- Create table to store custom output order per product per organization
CREATE TABLE public.product_output_order (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  easyquote_product_id TEXT NOT NULL,
  output_order TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, easyquote_product_id)
);

-- Enable RLS
ALTER TABLE public.product_output_order ENABLE ROW LEVEL SECURITY;

-- Policy for organization members to view
CREATE POLICY "Organization members can view output order"
ON public.product_output_order
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = product_output_order.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Policy for organization members to insert
CREATE POLICY "Organization members can insert output order"
ON public.product_output_order
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = product_output_order.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Policy for organization members to update
CREATE POLICY "Organization members can update output order"
ON public.product_output_order
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = product_output_order.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_product_output_order_updated_at
BEFORE UPDATE ON public.product_output_order
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();