-- Delete duplicate images keeping only the most recent one
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, original_filename 
           ORDER BY created_at DESC
         ) as rn
  FROM images
)
DELETE FROM images 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
)