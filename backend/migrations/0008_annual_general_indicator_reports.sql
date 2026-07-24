CREATE TABLE IF NOT EXISTS general_indicator_annual_reports (
    id BIGSERIAL PRIMARY KEY,
    report_type VARCHAR(80) NOT NULL,
    report_year INTEGER NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    current_revision_id BIGINT,
    active_consultation_id BIGINT REFERENCES general_indicator_consultations(id) ON DELETE SET NULL,
    current_period_start DATE NOT NULL,
    current_period_end DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    last_updated_by VARCHAR(255),
    CONSTRAINT chk_annual_report_year CHECK (report_year BETWEEN 2000 AND 2200),
    CONSTRAINT chk_annual_report_period CHECK (
        current_period_start = make_date(report_year, 1, 1)
        AND current_period_end >= current_period_start
        AND current_period_end <= make_date(report_year, 12, 31)
    ),
    CONSTRAINT uq_annual_report_type_year UNIQUE (report_type, report_year)
);

CREATE TABLE IF NOT EXISTS annual_report_migration_issues (
    id BIGSERIAL PRIMARY KEY,
    report_history_id BIGINT NOT NULL UNIQUE REFERENCES report_history(id) ON DELETE CASCADE,
    issue_type VARCHAR(80) NOT NULL,
    details JSONB NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE report_history
    ADD COLUMN IF NOT EXISTS annual_report_id BIGINT,
    ADD COLUMN IF NOT EXISTS previous_revision_id BIGINT;

ALTER TABLE general_indicator_consultations
    ADD COLUMN IF NOT EXISTS annual_report_id BIGINT;

INSERT INTO annual_report_migration_issues (report_history_id, issue_type, details)
SELECT
    History.id,
    'LEGACY_PERIOD_NOT_ANNUAL',
    jsonb_build_object(
        'periodStart', History.period_start,
        'periodEnd', History.period_end,
        'message', 'O snapshot histórico foi preservado sem recálculo; futuras revisões usarão início em 01/01.'
    )
FROM report_history AS History
WHERE History.period_start <> make_date(EXTRACT(YEAR FROM History.period_start)::INTEGER, 1, 1)
   OR EXTRACT(YEAR FROM History.period_end) <> EXTRACT(YEAR FROM History.period_start)
ON CONFLICT (report_history_id) DO NOTHING;

WITH Ranked AS (
    SELECT
        History.*,
        EXTRACT(YEAR FROM History.period_start)::INTEGER AS report_year,
        ROW_NUMBER() OVER (
            PARTITION BY History.report_type, EXTRACT(YEAR FROM History.period_start)
            ORDER BY History.finalized_at DESC, History.id DESC
        ) AS latest_order,
        MIN(History.created_at) OVER (
            PARTITION BY History.report_type, EXTRACT(YEAR FROM History.period_start)
        ) AS first_created_at
    FROM report_history AS History
),
Latest AS (
    SELECT * FROM Ranked WHERE latest_order = 1
)
INSERT INTO general_indicator_annual_reports (
    report_type,
    report_year,
    display_name,
    current_period_start,
    current_period_end,
    created_at,
    updated_at,
    created_by,
    last_updated_by
)
SELECT
    Latest.report_type,
    Latest.report_year,
    'Indicadores Gerais — ' || Latest.report_year,
    make_date(Latest.report_year, 1, 1),
    LEAST(Latest.period_end, make_date(Latest.report_year, 12, 31)),
    Latest.first_created_at,
    Latest.finalized_at,
    Latest.created_by,
    Latest.finalized_by
FROM Latest
ON CONFLICT (report_type, report_year) DO NOTHING;

UPDATE report_history AS History
SET annual_report_id = Annual.id
FROM general_indicator_annual_reports AS Annual
WHERE Annual.report_type = History.report_type
  AND Annual.report_year = EXTRACT(YEAR FROM History.period_start)::INTEGER
  AND History.annual_report_id IS NULL;

CREATE TEMP TABLE annual_revision_order ON COMMIT DROP AS
SELECT
    History.id,
    ROW_NUMBER() OVER (
        PARTITION BY History.annual_report_id
        ORDER BY History.finalized_at, History.id
    )::INTEGER AS revision_number,
    LAG(History.id) OVER (
        PARTITION BY History.annual_report_id
        ORDER BY History.finalized_at, History.id
    ) AS previous_revision_id
FROM report_history AS History
WHERE History.annual_report_id IS NOT NULL;

UPDATE report_history
SET version_number = version_number + 1000000
WHERE annual_report_id IS NOT NULL;

UPDATE report_history AS History
SET version_number = Revision.revision_number,
    previous_revision_id = Revision.previous_revision_id
FROM annual_revision_order AS Revision
WHERE Revision.id = History.id;

WITH CurrentRevision AS (
    SELECT DISTINCT ON (History.annual_report_id)
        History.annual_report_id,
        History.id,
        History.period_end,
        History.finalized_at,
        History.finalized_by,
        History.created_by
    FROM report_history AS History
    ORDER BY History.annual_report_id, History.version_number DESC, History.id DESC
)
UPDATE general_indicator_annual_reports AS Annual
SET current_revision_id = CurrentRevision.id,
    current_period_end = LEAST(
        CurrentRevision.period_end,
        make_date(Annual.report_year, 12, 31)
    ),
    updated_at = CurrentRevision.finalized_at,
    last_updated_by = COALESCE(CurrentRevision.finalized_by, CurrentRevision.created_by)
FROM CurrentRevision
WHERE CurrentRevision.annual_report_id = Annual.id;

UPDATE general_indicator_consultations AS Consultation
SET annual_report_id = History.annual_report_id
FROM report_history AS History
WHERE History.source_consultation_id = Consultation.id
  AND Consultation.annual_report_id IS NULL;

ALTER TABLE report_history
    ALTER COLUMN annual_report_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_history_annual_report') THEN
        ALTER TABLE report_history
            ADD CONSTRAINT fk_report_history_annual_report
            FOREIGN KEY (annual_report_id)
            REFERENCES general_indicator_annual_reports(id)
            ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_report_history_previous_revision') THEN
        ALTER TABLE report_history
            ADD CONSTRAINT fk_report_history_previous_revision
            FOREIGN KEY (previous_revision_id)
            REFERENCES report_history(id)
            ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_annual_report_current_revision') THEN
        ALTER TABLE general_indicator_annual_reports
            ADD CONSTRAINT fk_annual_report_current_revision
            FOREIGN KEY (current_revision_id)
            REFERENCES report_history(id)
            ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_consultation_annual_report') THEN
        ALTER TABLE general_indicator_consultations
            ADD CONSTRAINT fk_consultation_annual_report
            FOREIGN KEY (annual_report_id)
            REFERENCES general_indicator_annual_reports(id)
            ON DELETE CASCADE;
    END IF;
END $$;

DROP INDEX IF EXISTS uq_report_history_group_version;
DROP INDEX IF EXISTS uq_report_history_current;

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_history_annual_revision
    ON report_history (annual_report_id, version_number);
CREATE INDEX IF NOT EXISTS idx_annual_reports_listing
    ON general_indicator_annual_reports (report_type, report_year DESC);
CREATE INDEX IF NOT EXISTS idx_report_history_annual
    ON report_history (annual_report_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_annual
    ON general_indicator_consultations (annual_report_id, criado_em DESC);
