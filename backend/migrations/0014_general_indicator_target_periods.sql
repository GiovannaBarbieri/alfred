CREATE TABLE IF NOT EXISTS general_indicator_target_periods (
    id SERIAL PRIMARY KEY,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    projects_target NUMERIC(6, 2) NOT NULL,
    errors_limit NUMERIC(6, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255) NOT NULL DEFAULT 'sistema',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL DEFAULT 'sistema',
    CONSTRAINT chk_general_indicator_target_period_dates CHECK (start_date <= end_date),
    CONSTRAINT chk_general_indicator_target_projects CHECK (projects_target >= 0 AND projects_target <= 100),
    CONSTRAINT chk_general_indicator_target_errors CHECK (errors_limit >= 0 AND errors_limit <= 100),
    CONSTRAINT uq_general_indicator_target_period_dates UNIQUE (start_date, end_date)
);

CREATE INDEX IF NOT EXISTS idx_general_indicator_target_periods_dates
    ON general_indicator_target_periods (start_date, end_date);

INSERT INTO general_indicator_target_periods (
    start_date,
    end_date,
    projects_target,
    errors_limit,
    created_by,
    updated_by
)
VALUES
    ('2025-01-01', '2025-12-31', 31.44, 10.16, 'migration-0014', 'migration-0014'),
    ('2026-01-01', '2026-12-31', 40.00, 10.00, 'migration-0014', 'migration-0014')
ON CONFLICT (start_date, end_date) DO NOTHING;
