-- Create enum for subscription plans
CREATE TYPE public.subscription_plan AS ENUM ('api_base', 'api_pro', 'client_base', 'client_pro', 'custom');

-- Create enum for user roles within organizations  
CREATE TYPE public.organization_role AS ENUM ('superadmin', 'admin', 'user');

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subscription_plan subscription_plan NOT NULL DEFAULT 'api_base',
  excel_limit INTEGER NOT NULL DEFAULT 100,
  excel_extra INTEGER NOT NULL DEFAULT 0,
  client_user_limit INTEGER NOT NULL DEFAULT 1,
  client_user_extra INTEGER NOT NULL DEFAULT 0,
  api_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create organization_members table for client users
CREATE TABLE public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role organization_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Enable RLS on both tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "superadmin_all_access_orgs" ON public.organizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND email = 'test1'
    )
  );

CREATE POLICY "api_users_own_org" ON public.organizations
  FOR ALL USING (api_user_id = auth.uid());

-- RLS Policies for organization_members  
CREATE POLICY "superadmin_all_access_members" ON public.organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = auth.uid() AND email = 'test1'
    )
  );

CREATE POLICY "org_admins_manage_members" ON public.organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_members.organization_id 
      AND o.api_user_id = auth.uid()
    )
  );

CREATE POLICY "members_view_own_membership" ON public.organization_members
  FOR SELECT USING (user_id = auth.uid());

-- Add triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get plan limits
CREATE OR REPLACE FUNCTION public.get_plan_limits(plan subscription_plan)
RETURNS TABLE(excel_limit INTEGER, client_user_limit INTEGER)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE plan
      WHEN 'api_base' THEN 100
      WHEN 'api_pro' THEN 500
      WHEN 'client_base' THEN 100
      WHEN 'client_pro' THEN 500
      WHEN 'custom' THEN 1000
    END as excel_limit,
    CASE plan
      WHEN 'api_base' THEN 1
      WHEN 'api_pro' THEN 1
      WHEN 'client_base' THEN 2
      WHEN 'client_pro' THEN 5
      WHEN 'custom' THEN 10
    END as client_user_limit;
$$;