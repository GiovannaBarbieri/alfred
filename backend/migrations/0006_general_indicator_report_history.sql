CREATE TABLE IF NOT EXISTS report_history (
    id BIGSERIAL PRIMARY KEY,
    report_type VARCHAR(80) NOT NULL,
    source_consultation_id BIGINT NOT NULL UNIQUE
        REFERENCES general_indicator_consultations(id) ON DELETE RESTRICT,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_key VARCHAR(180) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    version_number INTEGER NOT NULL,
    report_status VARCHAR(20) NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    superseded_by_id BIGINT REFERENCES report_history(id) ON DELETE RESTRICT,
    superseded_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    current_selected_at TIMESTAMPTZ,
    current_selected_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL,
    finalized_at TIMESTAMPTZ NOT NULL,
    created_by VARCHAR(255),
    finalized_by VARCHAR(255),
    total_hours NUMERIC(18, 4) NOT NULL DEFAULT 0,
    considered_launch_count INTEGER NOT NULL DEFAULT 0,
    excluded_collaborator_count INTEGER NOT NULL DEFAULT 0,
    projects_improvements_percentage NUMERIC(9, 4),
    projects_improvements_status VARCHAR(40),
    errors_bugs_percentage NUMERIC(9, 4),
    errors_bugs_status VARCHAR(40),
    snapshot_contract_version INTEGER NOT NULL DEFAULT 1,
    result_hash CHAR(64),
    CONSTRAINT chk_report_history_period CHECK (period_end >= period_start),
    CONSTRAINT chk_report_history_version CHECK (version_number >= 1),
    CONSTRAINT chk_report_history_status
        CHECK (report_status IN ('CURRENT', 'SUPERSEDED', 'ARCHIVED')),
    CONSTRAINT chk_report_history_current_state CHECK (
        (report_status = 'CURRENT' AND is_current = TRUE AND archived_at IS NULL)
        OR (report_status = 'SUPERSEDED' AND is_current = FALSE AND archived_at IS NULL)
        OR (report_status = 'ARCHIVED' AND is_current = FALSE AND archived_at IS NOT NULL)
    ),
    CONSTRAINT chk_report_history_not_self_superseded
        CHECK (superseded_by_id IS NULL OR superseded_by_id <> id),
    CONSTRAINT chk_report_history_result_hash
        CHECK (result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64}$')
);

WITH Finalized AS (
    SELECT
        Consulta.*,
        ROW_NUMBER() OVER (
            PARTITION BY Consulta.data_inicial, Consulta.data_final
            ORDER BY COALESCE(Consulta.finalizado_em, Consulta.atualizado_em, Consulta.criado_em), Consulta.id
        ) AS VersionNumber,
        COUNT(*) OVER (
            PARTITION BY Consulta.data_inicial, Consulta.data_final
        ) AS VersionCount
    FROM general_indicator_consultations AS Consulta
    WHERE Consulta.status = 'FINALIZADA'
      AND Consulta.resultado IS NOT NULL
),
Prepared AS (
    SELECT
        Finalized.*,
        CASE
            WHEN EXTRACT(MONTH FROM data_inicial) = 1
             AND EXTRACT(DAY FROM data_inicial) = 1
             AND EXTRACT(MONTH FROM data_final) = 12
             AND EXTRACT(DAY FROM data_final) = 31
             AND EXTRACT(YEAR FROM data_inicial) = EXTRACT(YEAR FROM data_final)
                THEN 'Indicadores Gerais — ' || EXTRACT(YEAR FROM data_inicial)::INTEGER
            WHEN data_inicial = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 1, 1)
             AND data_final = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 6, 30)
                THEN 'Indicadores Gerais — 1º semestre de ' || EXTRACT(YEAR FROM data_inicial)::INTEGER
            WHEN data_inicial = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 7, 1)
             AND data_final = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 12, 31)
                THEN 'Indicadores Gerais — 2º semestre de ' || EXTRACT(YEAR FROM data_inicial)::INTEGER
            WHEN data_inicial = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 1, 1)
             AND data_final = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 3, 31)
                THEN 'Indicadores Gerais — 1º trimestre de ' || EXTRACT(YEAR FROM data_inicial)::INTEGER
            WHEN data_inicial = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 4, 1)
             AND data_final = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 6, 30)
                THEN 'Indicadores Gerais — 2º trimestre de ' || EXTRACT(YEAR FROM data_inicial)::INTEGER
            WHEN data_inicial = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 7, 1)
             AND data_final = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 9, 30)
                THEN 'Indicadores Gerais — 3º trimestre de ' || EXTRACT(YEAR FROM data_inicial)::INTEGER
            WHEN data_inicial = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 10, 1)
             AND data_final = make_date(EXTRACT(YEAR FROM data_inicial)::INTEGER, 12, 31)
                THEN 'Indicadores Gerais — 4º trimestre de ' || EXTRACT(YEAR FROM data_inicial)::INTEGER
            ELSE 'Indicadores Gerais — ' || TO_CHAR(data_inicial, 'DD/MM/YYYY')
                 || ' a ' || TO_CHAR(data_final, 'DD/MM/YYYY')
        END AS DisplayName
    FROM Finalized
)
INSERT INTO report_history (
    report_type,
    source_consultation_id,
    period_start,
    period_end,
    period_key,
    display_name,
    version_number,
    report_status,
    is_current,
    created_at,
    finalized_at,
    created_by,
    finalized_by,
    total_hours,
    considered_launch_count,
    excluded_collaborator_count,
    projects_improvements_percentage,
    projects_improvements_status,
    errors_bugs_percentage,
    errors_bugs_status,
    snapshot_contract_version,
    result_hash
)
SELECT
    'GENERAL_INDICATORS',
    id,
    data_inicial,
    data_final,
    'GENERAL_INDICATORS:' || data_inicial || ':' || data_final,
    DisplayName,
    VersionNumber,
    CASE WHEN VersionNumber = VersionCount THEN 'CURRENT' ELSE 'SUPERSEDED' END,
    VersionNumber = VersionCount,
    criado_em,
    COALESCE(finalizado_em, atualizado_em, criado_em),
    iniciado_por,
    finalizado_por,
    COALESCE(NULLIF(resultado->>'totalHours', '')::NUMERIC, 0),
    COALESCE(
        NULLIF(resultado #>> '{summary,consideredLaunchCount}', '')::INTEGER,
        NULLIF(resultado->>'recordCount', '')::INTEGER,
        0
    ),
    COALESCE(
        NULLIF(resultado #>> '{summary,excludedCollaboratorCount}', '')::INTEGER,
        (
            SELECT COUNT(DISTINCT Item->>'collaborator')
            FROM jsonb_array_elements(COALESCE(resultado->'audit', '[]'::jsonb)) AS Item
            WHERE COALESCE((Item->>'disregardedFromGeneralIndicators')::BOOLEAN, FALSE)
              AND NULLIF(Item->>'collaborator', '') IS NOT NULL
        ),
        0
    ),
    NULLIF(resultado #>> '{kpis,projectsImprovements,percentage}', '')::NUMERIC,
    resultado #>> '{kpis,projectsImprovements,status}',
    NULLIF(resultado #>> '{kpis,errorsBugs,percentage}', '')::NUMERIC,
    resultado #>> '{kpis,errorsBugs,status}',
    resultado_versao,
    resultado_hash
FROM Prepared
ON CONFLICT (source_consultation_id) DO NOTHING;

UPDATE report_history AS Previous
SET superseded_by_id = NextVersion.id,
    superseded_at = NextVersion.finalized_at
FROM report_history AS NextVersion
WHERE Previous.report_type = NextVersion.report_type
  AND Previous.period_start = NextVersion.period_start
  AND Previous.period_end = NextVersion.period_end
  AND NextVersion.version_number = Previous.version_number + 1
  AND Previous.report_status = 'SUPERSEDED'
  AND Previous.superseded_by_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_history_group_version
    ON report_history (report_type, period_start, period_end, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_history_current
    ON report_history (report_type, period_start, period_end)
    WHERE is_current = TRUE AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_report_history_listing
    ON report_history (report_type, report_status, finalized_at DESC, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_period
    ON report_history (report_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_report_history_period_key
    ON report_history (period_key, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_archived
    ON report_history (archived_at)
    WHERE archived_at IS NOT NULL;
