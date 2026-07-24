CREATE INDEX IF NOT EXISTS idx_general_indicator_launches_consulta_ordem
    ON general_indicator_launches (consulta_id, id);

CREATE INDEX IF NOT EXISTS idx_general_indicator_inconsistencies_ativas
    ON general_indicator_inconsistencies (consulta_id, ativa, id);

CREATE INDEX IF NOT EXISTS idx_general_indicator_consultations_processing
    ON general_indicator_consultations (status, atualizado_em)
    WHERE status IN ('CONSULTANDO', 'ATUALIZANDO_PENDENCIAS', 'REFAZENDO_CONSULTA', 'FINALIZANDO');
