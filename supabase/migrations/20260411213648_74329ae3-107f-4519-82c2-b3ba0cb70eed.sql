
-- 1. Create quote_portal_tokens table
CREATE TABLE public.quote_portal_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accessed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_quote_portal_tokens_token ON public.quote_portal_tokens(token);
CREATE INDEX idx_quote_portal_tokens_quote_id ON public.quote_portal_tokens(quote_id);

ALTER TABLE public.quote_portal_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (edge functions use service role key)
-- No policies = no access from anon/authenticated, which is what we want

-- 2. Create quote_portal_actions table
CREATE TABLE public.quote_portal_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  token_id UUID NOT NULL REFERENCES public.quote_portal_tokens(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'commented', 'viewed')),
  comment TEXT,
  client_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_portal_actions_quote_id ON public.quote_portal_actions(quote_id);

ALTER TABLE public.quote_portal_actions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read actions for quotes in their org
CREATE POLICY "Org members can view portal actions"
  ON public.quote_portal_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      JOIN public.organization_members om ON om.organization_id = q.organization_id
      WHERE q.id = quote_portal_actions.quote_id
        AND om.user_id = auth.uid()
    )
  );

-- 3. Add client_portal column to organization_integration_access
ALTER TABLE public.organization_integration_access
  ADD COLUMN client_portal BOOLEAN NOT NULL DEFAULT false;
