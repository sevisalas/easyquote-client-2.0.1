-- Add sequential_digits column to numbering_formats table
ALTER TABLE numbering_formats
ADD COLUMN sequential_digits integer NOT NULL DEFAULT 4;