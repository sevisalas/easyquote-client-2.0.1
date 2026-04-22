INSERT INTO pdf_configurations (organization_id, user_id, company_name, logo_url, brand_color, footer_text, selected_template, terms_page_text)
SELECT
  '294133c5-ab2a-445c-9270-85a179a0bde6'::uuid,
  user_id,
  'Campillo - Formación',
  logo_url,
  brand_color,
  footer_text,
  selected_template,
  terms_page_text
FROM pdf_configurations
WHERE organization_id = '108bcc37-fc60-4bc0-a81f-c30641d0ebc9'
LIMIT 1;