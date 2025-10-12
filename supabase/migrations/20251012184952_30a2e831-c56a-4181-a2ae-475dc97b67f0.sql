-- Add generate_pdfs field to organization_integration_access table
ALTER TABLE public.organization_integration_access 
ADD COLUMN generate_pdfs boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.organization_integration_access.generate_pdfs IS 
'Indica si se generan PDFs de presupuestos (true) o se crean en el CRM/ERP integrado (false). Solo configurable por superusuarios.';