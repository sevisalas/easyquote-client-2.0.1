ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS grouped_at timestamptz NULL;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS grouped_into_quote_id uuid NULL,
  ADD COLUMN IF NOT EXISTS source_quote_id uuid NULL,
  ADD COLUMN IF NOT EXISTS source_item_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_grouped_into ON public.quote_items(grouped_into_quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_source_quote ON public.quote_items(source_quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_source_item  ON public.quote_items(source_item_id);