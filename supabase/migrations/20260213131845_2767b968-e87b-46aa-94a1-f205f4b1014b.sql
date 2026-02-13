
-- Fix storage policies for document-attachments to include org owners (not just members)
DROP POLICY IF EXISTS "Org members can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Org members can delete attachments" ON storage.objects;

CREATE POLICY "Org members and owners can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'document-attachments'
  AND (
    is_organization_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR is_organization_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

CREATE POLICY "Org members and owners can read attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'document-attachments'
  AND (
    is_organization_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR is_organization_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

CREATE POLICY "Org members and owners can delete attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'document-attachments'
  AND (
    is_organization_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    OR is_organization_owner(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);
