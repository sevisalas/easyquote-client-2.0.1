-- Add last_sequential_number column to numbering_formats table
ALTER TABLE public.numbering_formats 
ADD COLUMN last_sequential_number integer NOT NULL DEFAULT 0;

-- Add a comment explaining the column
COMMENT ON COLUMN public.numbering_formats.last_sequential_number IS 'The last sequential number used for this document type. Next document will use last_sequential_number + 1';