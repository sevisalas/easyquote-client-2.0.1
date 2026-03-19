-- Add timestamp columns for tracking when quotes are sent and approved
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Trigger function to auto-fill timestamps on status change
CREATE OR REPLACE FUNCTION set_quote_status_timestamps()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') AND NEW.sent_at IS NULL THEN
    NEW.sent_at = now();
  END IF;
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') AND NEW.approved_at IS NULL THEN
    NEW.approved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_quote_status_timestamps
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_quote_status_timestamps();