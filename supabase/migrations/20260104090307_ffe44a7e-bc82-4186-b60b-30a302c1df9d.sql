-- Copiar product_component_settings de Campillo a Tradsis
INSERT INTO product_component_settings (organization_id, easyquote_product_id, is_composite, enabled_components)
VALUES 
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', true, ARRAY['cubierta', 'interior_1', 'interior_2']),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '74bc7596-fb04-45da-bcf9-f1ad2d14458e', true, ARRAY['interior_1', 'cubierta', 'interior_2']),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '6a8c133a-2c54-4059-9e6b-d21575f6abf3', false, ARRAY[]::text[]),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', 'fbafad38-8fd9-4745-903d-ff38949b4967', true, ARRAY['cubierta', 'interior_1', 'interior_2']),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '5678486d-465e-4a5f-b80d-9c46f207725e', true, ARRAY['cubierta', 'interior_1', 'interior_2']),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '6ade17f5-586d-4670-a58e-62d335935c50', true, ARRAY['cubierta', 'interior_1', 'interior_2'])
ON CONFLICT (organization_id, easyquote_product_id) DO UPDATE SET
  is_composite = EXCLUDED.is_composite,
  enabled_components = EXCLUDED.enabled_components,
  updated_at = now();

-- Copiar product_prompt_components para producto 10f45cb0-8013-4d10-a7dd-ddc029fc19dc
INSERT INTO product_prompt_components (organization_id, easyquote_product_id, prompt_name, component)
VALUES 
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B6', 'general'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B7', 'general'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B8', 'general'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B12', 'interior_1'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B13', 'interior_1'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B14', 'interior_1'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B16', 'interior_1'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B39', 'cubierta'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B36', 'cubierta'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B37', 'cubierta'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B38', 'cubierta'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B41', 'cubierta'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B24', 'interior_2'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B25', 'interior_2'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B26', 'interior_2'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'B28', 'interior_2'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'E13', 'interior_1'),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', 'E14', 'interior_1')
ON CONFLICT DO NOTHING;

-- Copiar product_output_order
INSERT INTO product_output_order (organization_id, easyquote_product_id, output_order)
VALUES 
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '10f45cb0-8013-4d10-a7dd-ddc029fc19dc', ARRAY['E5', 'E8', 'E9', 'E12', 'E21', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20', 'E19']),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '5678486d-465e-4a5f-b80d-9c46f207725e', ARRAY['E5', 'E8', 'E9', 'E12', 'E21', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20', 'E19']),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', 'fbafad38-8fd9-4745-903d-ff38949b4967', ARRAY['E5', 'E8', 'E9', 'E12', 'E21', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20', 'E19']),
  ('f95d535e-5a8f-4fef-9dda-75071d5b0e9e', '6ade17f5-586d-4670-a58e-62d335935c50', ARRAY['E5', 'E8', 'E9', 'E12', 'E21', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20', 'E19'])
ON CONFLICT (organization_id, easyquote_product_id) DO UPDATE SET
  output_order = EXCLUDED.output_order,
  updated_at = now();