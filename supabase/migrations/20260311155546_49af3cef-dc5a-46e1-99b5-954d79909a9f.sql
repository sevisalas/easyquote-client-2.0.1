-- Allow one numbering format per organization+document_type, while keeping legacy uniqueness only for rows without organization_id
ALTER TABLE public.numbering_formats
  DROP CONSTRAINT IF EXISTS numbering_formats_user_id_document_type_key;

-- Legacy safeguard: only constrain user-level formats when organization_id IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS numbering_formats_user_doc_legacy_unique
  ON public.numbering_formats (user_id, document_type)
  WHERE organization_id IS NULL;