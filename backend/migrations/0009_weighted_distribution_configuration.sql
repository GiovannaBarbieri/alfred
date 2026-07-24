CREATE TABLE IF NOT EXISTS general_indicator_distribution_weights (
    category_name VARCHAR(160) PRIMARY KEY,
    distribution_weight NUMERIC(12, 4) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_general_indicator_distribution_weight_positive
        CHECK (distribution_weight > 0)
);

INSERT INTO general_indicator_distribution_weights (
    category_name,
    distribution_weight,
    active
)
VALUES
    ('Novo projeto', 4, TRUE),
    ('Melhoria', 4, TRUE),
    ('Erro TI', 3, TRUE),
    ('Bug', 3, TRUE),
    ('Manutenção', 1, TRUE)
ON CONFLICT (category_name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_general_indicator_distribution_weights_active
    ON general_indicator_distribution_weights (active, category_name);
