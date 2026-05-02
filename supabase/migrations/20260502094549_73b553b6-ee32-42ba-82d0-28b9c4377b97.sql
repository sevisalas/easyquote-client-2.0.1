UPDATE public.quotes
SET status = 'grouped', grouped_at = COALESCE(grouped_at, now())
WHERE id IN (
  'a034ae17-69f2-4d09-8dd6-71e8ca01d4d8',
  'facc0de8-7bbd-4ca8-b54c-2f41786c9de5',
  '889496df-998c-49dd-8bcc-f2b85f69c812',
  '121c1e93-61dc-42ee-a59a-84e21fe852be'
);

UPDATE public.quote_items
SET grouped_into_quote_id = 'ab670ed8-3884-426d-9404-2f3ee8ddc1a1'
WHERE id IN (
  '1497346b-8b5c-4458-bd4a-28d856ddd5fc',
  '4a8b3ac2-479a-43da-a42b-bf5b7c26b76f',
  '572d462b-7ac7-42c0-8681-dcdab0742fd9',
  'ec617bb8-0b7f-46d2-a889-913ebc4fcfe7'
);