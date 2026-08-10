-- Alfred - manifesto consolidado do banco
-- Revisado em 28/07/2026.
--
-- Este arquivo não duplica o DDL. As fontes canônicas são:
--   1. database/init.sql
--   2. backend/migrations/*.sql, em ordem numérica
--
-- Uso opcional somente para criar uma base de documentação/teste com psql:
--   cd C:\Projetos\alfred\docs
--   psql <conexao> -f .\10-estrutura-banco.sql
--
-- Em ambientes administrados, prefira iniciar a aplicação. O migration_service
-- registra versões e checksums em schema_migrations. Executar este manifesto
-- manualmente não registra os checksums.

\set ON_ERROR_STOP on

\echo 'Aplicando bootstrap do domínio Projetos'
\ir ../database/init.sql

\echo 'Aplicando migrations versionadas do Alfred'
\ir ../backend/migrations/0001_general_indicators.sql
\ir ../backend/migrations/0002_general_indicators_performance.sql
\ir ../backend/migrations/0003_general_indicators_collaborator_participation.sql
\ir ../backend/migrations/0004_general_indicators_hierarchy_contract.sql
\ir ../backend/migrations/0005_general_indicators_official_snapshot.sql
\ir ../backend/migrations/0006_general_indicator_report_history.sql
\ir ../backend/migrations/0007_report_history_archived_by.sql
\ir ../backend/migrations/0008_annual_general_indicator_reports.sql
\ir ../backend/migrations/0009_weighted_distribution_configuration.sql
\ir ../backend/migrations/0010_distribution_weights_management.sql
\ir ../backend/migrations/0011_independent_general_indicator_reports.sql
\ir ../backend/migrations/0012_general_indicator_modules.sql
\ir ../backend/migrations/0013_neutral_distribution_defaults.sql
\ir ../backend/migrations/0014_general_indicator_target_periods.sql

\echo 'Estrutura consolidada aplicada.'
