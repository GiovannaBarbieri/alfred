ALTER TABLE general_indicator_consultations
    ADD COLUMN IF NOT EXISTS resultado_versao INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS iniciado_por VARCHAR(255),
    ADD COLUMN IF NOT EXISTS finalizado_por VARCHAR(255),
    ADD COLUMN IF NOT EXISTS calculo_versao VARCHAR(80),
    ADD COLUMN IF NOT EXISTS classificacao_versao VARCHAR(80),
    ADD COLUMN IF NOT EXISTS distribuicao_versao VARCHAR(80),
    ADD COLUMN IF NOT EXISTS metas_versao VARCHAR(80),
    ADD COLUMN IF NOT EXISTS backend_build VARCHAR(255),
    ADD COLUMN IF NOT EXISTS snapshot_hash CHAR(64),
    ADD COLUMN IF NOT EXISTS resultado_hash CHAR(64);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_general_indicator_result_contract_version'
    ) THEN
        ALTER TABLE general_indicator_consultations
            ADD CONSTRAINT chk_general_indicator_result_contract_version
            CHECK (resultado_versao >= 1);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_general_indicator_snapshot_hash'
    ) THEN
        ALTER TABLE general_indicator_consultations
            ADD CONSTRAINT chk_general_indicator_snapshot_hash
            CHECK (snapshot_hash IS NULL OR snapshot_hash ~ '^[0-9a-f]{64}$');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_general_indicator_result_hash'
    ) THEN
        ALTER TABLE general_indicator_consultations
            ADD CONSTRAINT chk_general_indicator_result_hash
            CHECK (resultado_hash IS NULL OR resultado_hash ~ '^[0-9a-f]{64}$');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_general_indicator_consultations_result_history
    ON general_indicator_consultations (status, finalizado_em DESC)
    WHERE status = 'FINALIZADA';
