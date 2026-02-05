-- Fix incorrect composite prompt mapping causing Cubierta pricing to fail.
-- Problem: the Cubierta prompt "Cantidad ejemplares" (target_prompt_name=95dec...) was incorrectly mapped
-- to the parent's "Formato" (source_prompt_name=5cc1...), sending a text like "14,8 x 21 cm." into a numeric field.
-- This triggers EasyQuote pricing 500 and makes Cubierta not load.

UPDATE public.composite_prompt_connections
SET source_prompt_name = '79395440-6e93-4b54-a75e-c6eb75426368',
    updated_at = now()
WHERE id = '52c1b291-31bd-4b69-ba10-88d1199d3f23';
