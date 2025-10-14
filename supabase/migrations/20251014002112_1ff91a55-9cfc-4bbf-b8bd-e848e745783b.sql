-- Create table to store WooCommerce product links synced from WordPress
CREATE TABLE IF NOT EXISTS public.woocommerce_product_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  easyquote_product_id TEXT NOT NULL,
  easyquote_product_name TEXT NOT NULL,
  woo_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_linked BOOLEAN NOT NULL DEFAULT false,
  product_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, easyquote_product_id)
);

-- Enable RLS
ALTER TABLE public.woocommerce_product_links ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their organization's product links
CREATE POLICY "Users can view their organization's product links"
ON public.woocommerce_product_links
FOR SELECT
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
  )
  OR
  organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  )
);

-- Policy: System can insert/update product links (for the edge function)
CREATE POLICY "System can manage product links"
ON public.woocommerce_product_links
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_woocommerce_links_org_product ON public.woocommerce_product_links(organization_id, easyquote_product_id);
CREATE INDEX idx_woocommerce_links_synced ON public.woocommerce_product_links(last_synced_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_woocommerce_product_links_updated_at
BEFORE UPDATE ON public.woocommerce_product_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();