-- Create table for Holded sales accounts
CREATE TABLE IF NOT EXISTS public.holded_sales_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  holded_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  account_num INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, holded_account_id)
);

-- Enable RLS
ALTER TABLE public.holded_sales_accounts ENABLE ROW LEVEL SECURITY;

-- Organization owners can manage their sales accounts
CREATE POLICY "Organization owners can view sales accounts"
  ON public.holded_sales_accounts
  FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can insert sales accounts"
  ON public.holded_sales_accounts
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can update sales accounts"
  ON public.holded_sales_accounts
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

CREATE POLICY "Organization owners can delete sales accounts"
  ON public.holded_sales_accounts
  FOR DELETE
  USING (
    organization_id IN (
      SELECT id FROM public.organizations WHERE api_user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_holded_sales_accounts_updated_at
  BEFORE UPDATE ON public.holded_sales_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();