
-- 1. Create storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('document-attachments', 'document-attachments', false);

-- 2. Create document_attachments table
CREATE TABLE public.document_attachments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  sales_order_id uuid REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_one_parent CHECK (
    (quote_id IS NOT NULL AND sales_order_id IS NULL) OR
    (quote_id IS NULL AND sales_order_id IS NOT NULL)
  )
);

-- 3. Enable RLS
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for document_attachments (org members can CRUD)
CREATE POLICY "Org members can view attachments"
ON public.document_attachments FOR SELECT
TO authenticated
USING (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Org members can insert attachments"
ON public.document_attachments FOR INSERT
TO authenticated
WITH CHECK (public.is_organization_member(auth.uid(), organization_id));

CREATE POLICY "Org members can delete attachments"
ON public.document_attachments FOR DELETE
TO authenticated
USING (public.is_organization_member(auth.uid(), organization_id));

-- 5. Storage RLS policies for document-attachments bucket
CREATE POLICY "Org members can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'document-attachments'
  AND public.is_organization_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Org members can read attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'document-attachments'
  AND public.is_organization_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

CREATE POLICY "Org members can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'document-attachments'
  AND public.is_organization_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);
