-- Cada relatório de Indicadores Gerais passa a representar um snapshot independente.
-- A estrutura legada é mantida para preservar a leitura dos relatórios existentes.

ALTER TABLE general_indicator_annual_reports
    DROP CONSTRAINT IF EXISTS uq_annual_report_type_year;

ALTER TABLE general_indicator_annual_reports
    DROP CONSTRAINT IF EXISTS chk_annual_report_period;

ALTER TABLE general_indicator_annual_reports
    ADD CONSTRAINT chk_saved_report_period
    CHECK (current_period_end >= current_period_start);

DROP INDEX IF EXISTS idx_annual_reports_listing;

CREATE INDEX IF NOT EXISTS idx_saved_general_indicator_reports_listing
    ON general_indicator_annual_reports (report_type, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_saved_general_indicator_report_period
    ON report_history (report_type, period_start, period_end, finalized_at DESC);
