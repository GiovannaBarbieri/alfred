UPDATE general_indicator_distribution_weights
SET
    distribution_weight = 1,
    default_weight = 1,
    active = TRUE,
    updated_at = NOW(),
    updated_by = 'migration-0013'
WHERE category_name IN (
    'Novo projeto',
    'Melhoria',
    'Erro TI',
    'Bug',
    'Manutenção'
);
