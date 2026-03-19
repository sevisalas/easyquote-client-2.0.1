-- Backfill sent_at for quotes already in 'sent' or 'approved' status
UPDATE quotes SET sent_at = updated_at WHERE status IN ('sent', 'approved') AND sent_at IS NULL;

-- Backfill approved_at for quotes already in 'approved' status
UPDATE quotes SET approved_at = updated_at WHERE status = 'approved' AND approved_at IS NULL;