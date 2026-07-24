ALTER TABLE general_indicator_distribution_weights
    ADD COLUMN IF NOT EXISTS default_weight SMALLINT,
    ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255) NOT NULL DEFAULT 'sistema';

UPDATE general_indicator_distribution_weights
SET
    default_weight = CASE category_name
        WHEN 'Novo projeto' THEN 5
        WHEN 'Melhoria' THEN 5
        WHEN 'Erro TI' THEN 3
        WHEN 'Bug' THEN 4
        WHEN 'Manutenção' THEN 1
        ELSE distribution_weight::SMALLINT
    END,
    distribution_weight = CASE category_name
        WHEN 'Novo projeto' THEN 5
        WHEN 'Melhoria' THEN 5
        WHEN 'Erro TI' THEN 3
        WHEN 'Bug' THEN 4
        WHEN 'Manutenção' THEN 1
        ELSE distribution_weight
    END,
    active = TRUE,
    updated_at = NOW(),
    updated_by = 'migration-0010';

ALTER TABLE general_indicator_distribution_weights
    ALTER COLUMN distribution_weight TYPE SMALLINT
        USING distribution_weight::SMALLINT,
    ALTER COLUMN default_weight SET NOT NULL;

ALTER TABLE general_indicator_distribution_weights
    DROP CONSTRAINT IF EXISTS chk_general_indicator_distribution_weight_positive;

ALTER TABLE general_indicator_distribution_weights
    ADD CONSTRAINT chk_general_indicator_distribution_weight_range
        CHECK (distribution_weight BETWEEN 1 AND 5),
    ADD CONSTRAINT chk_general_indicator_default_weight_range
        CHECK (default_weight BETWEEN 1 AND 5);

