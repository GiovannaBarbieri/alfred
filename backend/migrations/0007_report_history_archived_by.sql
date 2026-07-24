ALTER TABLE report_history
    ADD COLUMN IF NOT EXISTS archived_by VARCHAR(255);
