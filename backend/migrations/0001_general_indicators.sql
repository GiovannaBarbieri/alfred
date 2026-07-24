CREATE TABLE IF NOT EXISTS general_indicator_consultations (
    id BIGSERIAL PRIMARY KEY,
    data_inicial DATE NOT NULL,
    data_final DATE NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'CONSULTANDO',
    resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
    resultado JSONB,
    mensagem_erro TEXT,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_validacao_em TIMESTAMPTZ,
    finalizado_em TIMESTAMPTZ
);

ALTER TABLE general_indicator_consultations
    ADD COLUMN IF NOT EXISTS resultado JSONB,
    ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS general_indicator_launches (
    id BIGSERIAL PRIMARY KEY,
    consulta_id BIGINT NOT NULL REFERENCES general_indicator_consultations(id) ON DELETE CASCADE,
    id_lancamento VARCHAR(120),
    id_task VARCHAR(120),
    id_pai VARCHAR(120),
    tipo_pai VARCHAR(120),
    id_feature VARCHAR(120),
    categoria_validada VARCHAR(160),
    estado_validacao VARCHAR(40) NOT NULL,
    duracao_horas NUMERIC(18, 4),
    dados_tecnicos JSONB NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS general_indicator_inconsistencies (
    id BIGSERIAL PRIMARY KEY,
    consulta_id BIGINT NOT NULL REFERENCES general_indicator_consultations(id) ON DELETE CASCADE,
    id_lancamento VARCHAR(120),
    id_feature VARCHAR(120),
    tipo VARCHAR(80) NOT NULL,
    severidade VARCHAR(40) NOT NULL,
    escopo VARCHAR(30) NOT NULL,
    texto_original TEXT,
    descricao TEXT NOT NULL,
    impeditiva BOOLEAN NOT NULL,
    tratamento VARCHAR(255),
    status VARCHAR(40) NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ultima_validacao_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE general_indicator_inconsistencies
    ADD COLUMN IF NOT EXISTS ativa BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS general_indicator_updates (
    id BIGSERIAL PRIMARY KEY,
    consulta_id BIGINT NOT NULL REFERENCES general_indicator_consultations(id) ON DELETE CASCADE,
    tipo VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'EM_EXECUCAO',
    estado_anterior VARCHAR(40) NOT NULL,
    estado_resultante VARCHAR(40),
    pendencias_antes INTEGER NOT NULL DEFAULT 0,
    pendencias_resolvidas INTEGER NOT NULL DEFAULT 0,
    pendencias_abertas INTEGER NOT NULL DEFAULT 0,
    novas_inconsistencias INTEGER NOT NULL DEFAULT 0,
    features_reconsultadas INTEGER NOT NULL DEFAULT 0,
    lancamentos_revalidados INTEGER NOT NULL DEFAULT 0,
    resumo JSONB NOT NULL DEFAULT '{}'::jsonb,
    mensagem_erro TEXT,
    iniciado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalizado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_general_indicator_launches_consulta
    ON general_indicator_launches (consulta_id);
CREATE INDEX IF NOT EXISTS idx_general_indicator_launches_lancamento
    ON general_indicator_launches (consulta_id, id_lancamento);
CREATE UNIQUE INDEX IF NOT EXISTS idx_general_indicator_launches_unique
    ON general_indicator_launches (consulta_id, id_lancamento)
    WHERE id_lancamento IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_general_indicator_inconsistencies_consulta
    ON general_indicator_inconsistencies (consulta_id, impeditiva, tipo);
CREATE INDEX IF NOT EXISTS idx_general_indicator_updates_consulta
    ON general_indicator_updates (consulta_id, iniciado_em DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_general_indicator_consultation_period') THEN
        ALTER TABLE general_indicator_consultations
            ADD CONSTRAINT chk_general_indicator_consultation_period
            CHECK (data_final >= data_inicial);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_general_indicator_launch_duration') THEN
        ALTER TABLE general_indicator_launches
            ADD CONSTRAINT chk_general_indicator_launch_duration
            CHECK (duracao_horas IS NULL OR duracao_horas >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_general_indicator_update_counts') THEN
        ALTER TABLE general_indicator_updates
            ADD CONSTRAINT chk_general_indicator_update_counts
            CHECK (
                pendencias_antes >= 0
                AND pendencias_resolvidas >= 0
                AND pendencias_abertas >= 0
                AND novas_inconsistencias >= 0
                AND features_reconsultadas >= 0
                AND lancamentos_revalidados >= 0
            );
    END IF;
END
$$;
