-- Corregir presupuesto incorrecto
UPDATE quotes 
SET quote_number = 'PR-25-0004' 
WHERE quote_number = '25-0002' 
AND user_id = 'a21eb8c8-e9fa-4afb-812f-b0fa48aea3e4';

-- Actualizar secuencial de Campillo
UPDATE numbering_formats 
SET last_sequential_number = 4 
WHERE organization_id = '108bcc37-fc60-4bc0-a81f-c30641d0ebc9' 
AND document_type = 'quote';