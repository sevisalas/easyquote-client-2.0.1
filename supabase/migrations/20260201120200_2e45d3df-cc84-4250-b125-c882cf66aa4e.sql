-- Create enum for request types
CREATE TYPE public.support_request_type AS ENUM ('feature', 'bug', 'question');

-- Create enum for request status
CREATE TYPE public.support_request_status AS ENUM ('pending', 'in_progress', 'resolved', 'rejected');

-- Create support requests table
CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  type support_request_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status support_request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own requests
CREATE POLICY "Users can create support requests"
ON public.support_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
ON public.support_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Superadmins can view all requests
CREATE POLICY "Superadmins can view all requests"
ON public.support_requests
FOR SELECT
USING (is_superadmin());

-- Superadmins can update all requests
CREATE POLICY "Superadmins can update all requests"
ON public.support_requests
FOR UPDATE
USING (is_superadmin());

-- Superadmins can delete requests
CREATE POLICY "Superadmins can delete requests"
ON public.support_requests
FOR DELETE
USING (is_superadmin());

-- Create trigger for updated_at
CREATE TRIGGER update_support_requests_updated_at
BEFORE UPDATE ON public.support_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();