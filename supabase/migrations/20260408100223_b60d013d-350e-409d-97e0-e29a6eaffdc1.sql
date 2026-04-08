
-- Fix Campillo Nevado quotes (PR-26-XXXXXX, 6 digits, current max = 427)
-- Ordered by created_at to assign sequential numbers
UPDATE quotes SET quote_number = 'PR-26-000428' WHERE id = '6c6df267-0d6b-4e00-a7c0-61da86669725'; -- 2026-0001
UPDATE quotes SET quote_number = 'PR-26-000429' WHERE id = '094d2451-7ce5-4595-a82c-a39512486312'; -- 2026-0002
UPDATE quotes SET quote_number = 'PR-26-000430' WHERE id = '619aa399-02eb-427d-bb1a-ba8f35578ff4'; -- 2026-0003
UPDATE quotes SET quote_number = 'PR-26-000431' WHERE id = '1a755c99-0bd5-4178-9d30-fcc5132c3cd2'; -- 2026-0004
UPDATE quotes SET quote_number = 'PR-26-000432' WHERE id = '1106963d-9623-4a74-8d24-26c88d0d997d'; -- 2026-0006
UPDATE quotes SET quote_number = 'PR-26-000433' WHERE id = '76a37d1a-87a6-447e-ad93-243ba552227b'; -- 2026-0007
UPDATE quotes SET quote_number = 'PR-26-000434' WHERE id = 'f453f785-e977-4d62-b1ad-515b6b56021f'; -- 2026-0011
UPDATE quotes SET quote_number = 'PR-26-000435' WHERE id = 'f87c1540-a5e0-4730-a9fd-44c45a4e922d'; -- 2026-0012
UPDATE quotes SET quote_number = 'PR-26-000436' WHERE id = '280f727f-b715-4ba3-8b38-50fbc64cff7e'; -- 2026-0014
UPDATE quotes SET quote_number = 'PR-26-000437' WHERE id = 'd2392d82-a6b8-4df3-b652-16e9de9d8fd8'; -- 2026-0016
UPDATE quotes SET quote_number = 'PR-26-000438' WHERE id = '6e6349f0-fa3a-43e2-9500-f6292343522b'; -- 2026-0017

-- Fix Anebri quotes (26-XXXX, 4 digits, current max = 151)
UPDATE quotes SET quote_number = '26-0152' WHERE id = 'bab7e5a6-e357-451b-aef2-5ca6ba5c822e'; -- 2026-0005
UPDATE quotes SET quote_number = '26-0153' WHERE id = 'bb7b74c5-8ee3-4dd1-969e-6d4a4b562d11'; -- 2026-0008
UPDATE quotes SET quote_number = '26-0154' WHERE id = '1dfe45a5-bc67-42af-9a77-e9ca1de72177'; -- 2026-0009
UPDATE quotes SET quote_number = '26-0155' WHERE id = '7bdddd1e-bf71-4f16-a539-6e642c407dbd'; -- 2026-0010
UPDATE quotes SET quote_number = '26-0156' WHERE id = '839d2b7e-c268-495e-bbbc-c2915dda26c2'; -- 2026-0013
UPDATE quotes SET quote_number = '26-0157' WHERE id = '12886d77-ca59-4718-b29e-eeb8f0ad6c4c'; -- 2026-0015

-- Update document sequences to reflect the new max
UPDATE document_sequences 
SET last_number = 438, updated_at = now()
WHERE organization_id = '108bcc37-fc60-4bc0-a81f-c30641d0ebc9' 
  AND document_type = 'quote' AND year = 2026;

UPDATE document_sequences 
SET last_number = 157, updated_at = now()
WHERE organization_id = '95abc5cd-77dd-4f55-8380-f9de4dd85cac' 
  AND document_type = 'quote' AND year = 2026;
