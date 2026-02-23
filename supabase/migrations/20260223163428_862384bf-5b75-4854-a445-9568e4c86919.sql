
-- Drop the existing unique constraint on user_id only
ALTER TABLE public.pdf_configurations DROP CONSTRAINT IF EXISTS pdf_configurations_user_id_key;

-- Add a new unique constraint on (user_id, organization_id)
ALTER TABLE public.pdf_configurations ADD CONSTRAINT pdf_configurations_user_org_unique UNIQUE (user_id, organization_id);

-- Create a separate config row for Anebri (copying from Campillo but with template 1)
INSERT INTO public.pdf_configurations (user_id, organization_id, company_name, logo_url, brand_color, footer_text, selected_template, terms_page_text)
VALUES (
  'a21eb8c8-e9fa-4afb-812f-b0fa48aea3e4',
  '95abc5cd-77dd-4f55-8380-f9de4dd85cac',
  'Anebri',
  NULL,
  '#233588',
  '',
  1,
  ''
)
ON CONFLICT (user_id, organization_id) DO NOTHING;
