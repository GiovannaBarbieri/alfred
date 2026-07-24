ALTER TABLE perfis_colaborador
    ADD COLUMN IF NOT EXISTS participa_indicadores_gerais BOOLEAN NOT NULL DEFAULT TRUE;

