CREATE TABLE IF NOT EXISTS general_indicator_modules (
    id BIGSERIAL PRIMARY KEY,
    tag_name VARCHAR(500) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_general_indicator_modules_active
    ON general_indicator_modules (active, tag_name);
