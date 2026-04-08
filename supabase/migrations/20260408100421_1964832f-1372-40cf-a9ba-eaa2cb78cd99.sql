
-- Fix Anebri quotes with wrong PR- prefix (format should be 26-XXXX)
UPDATE quotes SET quote_number = '26-0158' WHERE id = '2f0d9c93-d220-4054-b79c-1226da979a6f'; -- PR-26-0001
UPDATE quotes SET quote_number = '26-0159' WHERE id = 'b85c6f03-185d-48b5-a24b-c853dc86e579'; -- PR-26-0002
UPDATE quotes SET quote_number = '26-0160' WHERE id = 'beaeff0a-2092-4a4f-b818-1d320d07226f'; -- PR-26-0003
UPDATE quotes SET quote_number = '26-0161' WHERE id = 'f05a93e1-f052-462d-abc8-a00fd731ba9e'; -- PR-26-0004

-- Update Anebri sequence
UPDATE document_sequences 
SET last_number = 161, updated_at = now()
WHERE organization_id = '95abc5cd-77dd-4f55-8380-f9de4dd85cac' 
  AND document_type = 'quote' AND year = 2026;
