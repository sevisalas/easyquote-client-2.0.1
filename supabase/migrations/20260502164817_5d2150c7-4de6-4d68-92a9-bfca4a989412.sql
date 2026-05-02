UPDATE email_templates 
SET body = REPLACE(body, '{{boton_pdf}}', E'{{boton_portal}}\n  {{boton_pdf}}')
WHERE template_key='quote_sent' AND body NOT LIKE '%boton_portal%';