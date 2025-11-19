-- Create table for numbering format configurations
CREATE TABLE IF NOT EXISTS public.numbering_formats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('quote', 'order')),
  prefix TEXT NOT NULL DEFAULT '',
  suffix TEXT DEFAULT '',
  use_year BOOLEAN NOT NULL DEFAULT false,
  year_format TEXT NOT NULL DEFAULT 'YY' CHECK (year_format IN ('YY', 'YYYY')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, document_type),
  UNIQUE(user_id, document_type)
);

-- Enable RLS
ALTER TABLE public.numbering_formats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their organization's numbering formats
CREATE POLICY "Users can view organization numbering formats"
ON public.numbering_formats
FOR SELECT
USING (
  auth.uid() = user_id 
  OR organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Organization owners can insert numbering formats
CREATE POLICY "Organization owners can insert numbering formats"
ON public.numbering_formats
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    organization_id IS NULL
    OR organization_id IN (
      SELECT id 
      FROM organizations 
      WHERE api_user_id = auth.uid()
    )
  )
);

-- Policy: Organization owners can update numbering formats
CREATE POLICY "Organization owners can update numbering formats"
ON public.numbering_formats
FOR UPDATE
USING (
  auth.uid() = user_id
  OR organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  )
);

-- Policy: Organization owners can delete numbering formats
CREATE POLICY "Organization owners can delete numbering formats"
ON public.numbering_formats
FOR DELETE
USING (
  auth.uid() = user_id
  OR organization_id IN (
    SELECT id 
    FROM organizations 
    WHERE api_user_id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_numbering_formats_updated_at
BEFORE UPDATE ON public.numbering_formats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_numbering_formats_organization_id ON public.numbering_formats(organization_id);
CREATE INDEX IF NOT EXISTS idx_numbering_formats_user_id ON public.numbering_formats(user_id);
CREATE INDEX IF NOT EXISTS idx_numbering_formats_document_type ON public.numbering_formats(document_type);