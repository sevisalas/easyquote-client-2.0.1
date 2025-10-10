-- Make product-images bucket private to prevent unauthorized access
-- This will require signed URLs for image access going forward
UPDATE storage.buckets 
SET public = false 
WHERE id = 'product-images';