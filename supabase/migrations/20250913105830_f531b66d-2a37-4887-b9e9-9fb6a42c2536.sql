-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_plan TEXT NOT NULL DEFAULT 'api_base' CHECK (subscription_plan IN ('api_base', 'api_pro', 'client_base', 'client_pro', 'custom')),
  excel_limit INTEGER NOT NULL DEFAULT 0,
  excel_extra INTEGER NOT NULL DEFAULT 0,
  client_user_limit INTEGER NOT NULL DEFAULT 0,
  client_user_extra INTEGER NOT NULL DEFAULT 0,
  api_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_members table
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Create integrations table
CREATE TABLE public.integrations (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization_integration_access table
CREATE TABLE public.organization_integration_access (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, integration_id)
);

-- Create product_categories table
CREATE TABLE public.product_categories (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create product_subcategories table
CREATE TABLE public.product_subcategories (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create additionals table
CREATE TABLE public.additionals (
  id UUID NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_integration_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additionals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for customers
CREATE POLICY "Users can view their own customers" ON public.customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own customers" ON public.customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own customers" ON public.customers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own customers" ON public.customers FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for organizations
CREATE POLICY "API users can view their organization" ON public.organizations FOR SELECT USING (auth.uid() = api_user_id);
CREATE POLICY "API users can create their organization" ON public.organizations FOR INSERT WITH CHECK (auth.uid() = api_user_id);
CREATE POLICY "API users can update their organization" ON public.organizations FOR UPDATE USING (auth.uid() = api_user_id);
CREATE POLICY "API users can delete their organization" ON public.organizations FOR DELETE USING (auth.uid() = api_user_id);

-- Create RLS policies for organization_members
CREATE POLICY "Members can view their memberships" ON public.organization_members FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id));
CREATE POLICY "Organization owners can manage members" ON public.organization_members FOR INSERT WITH CHECK (auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id));
CREATE POLICY "Organization owners can update members" ON public.organization_members FOR UPDATE USING (auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id));
CREATE POLICY "Organization owners can delete members" ON public.organization_members FOR DELETE USING (auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id));

-- Create RLS policies for integrations (public read, admin only write)
CREATE POLICY "Anyone can view integrations" ON public.integrations FOR SELECT USING (true);

-- Create RLS policies for organization_integration_access
CREATE POLICY "Organization members can view integration access" ON public.organization_integration_access FOR SELECT USING (
  auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id) OR
  auth.uid() IN (SELECT user_id FROM public.organization_members WHERE organization_id = organization_integration_access.organization_id)
);
CREATE POLICY "Organization owners can manage integration access" ON public.organization_integration_access FOR INSERT WITH CHECK (auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id));
CREATE POLICY "Organization owners can update integration access" ON public.organization_integration_access FOR UPDATE USING (auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id));
CREATE POLICY "Organization owners can delete integration access" ON public.organization_integration_access FOR DELETE USING (auth.uid() IN (SELECT api_user_id FROM public.organizations WHERE id = organization_id));

-- Create RLS policies for product_categories
CREATE POLICY "Users can view their own categories" ON public.product_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own categories" ON public.product_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON public.product_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categories" ON public.product_categories FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for product_subcategories
CREATE POLICY "Users can view their own subcategories" ON public.product_subcategories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own subcategories" ON public.product_subcategories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subcategories" ON public.product_subcategories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subcategories" ON public.product_subcategories FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for additionals
CREATE POLICY "Users can view their own additionals" ON public.additionals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own additionals" ON public.additionals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own additionals" ON public.additionals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own additionals" ON public.additionals FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organization_integration_access_updated_at BEFORE UPDATE ON public.organization_integration_access FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_product_subcategories_updated_at BEFORE UPDATE ON public.product_subcategories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_additionals_updated_at BEFORE UPDATE ON public.additionals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_customers_user_id ON public.customers(user_id);
CREATE INDEX idx_organizations_api_user_id ON public.organizations(api_user_id);
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_organization_id ON public.organization_members(organization_id);
CREATE INDEX idx_organization_integration_access_organization_id ON public.organization_integration_access(organization_id);
CREATE INDEX idx_product_categories_user_id ON public.product_categories(user_id);
CREATE INDEX idx_product_subcategories_user_id ON public.product_subcategories(user_id);
CREATE INDEX idx_product_subcategories_category_id ON public.product_subcategories(category_id);
CREATE INDEX idx_additionals_user_id ON public.additionals(user_id);