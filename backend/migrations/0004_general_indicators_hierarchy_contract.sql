ALTER TABLE general_indicator_consultations
    ADD COLUMN IF NOT EXISTS hierarchy_contract_version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_general_indicator_hierarchy_contract_version'
    ) THEN
        ALTER TABLE general_indicator_consultations
            ADD CONSTRAINT chk_general_indicator_hierarchy_contract_version
            CHECK (hierarchy_contract_version >= 1);
    END IF;
END $$;
