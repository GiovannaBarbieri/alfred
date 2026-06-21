from __future__ import annotations

from app.db import get_connection


def ensure_runtime_schema() -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS import_sessions (
                    id SERIAL PRIMARY KEY,
                    nome_arquivo VARCHAR(255) NOT NULL,
                    hash_arquivo VARCHAR(128) NOT NULL,
                    conteudo_arquivo BYTEA NOT NULL,
                    status VARCHAR(40) NOT NULL DEFAULT 'em_validacao',
                    total_registros INTEGER NOT NULL DEFAULT 0,
                    registros_validos INTEGER NOT NULL DEFAULT 0,
                    registros_com_alerta INTEGER NOT NULL DEFAULT 0,
                    registros_bloqueados INTEGER NOT NULL DEFAULT 0,
                    importacao_final_id INTEGER REFERENCES importacoes(id) ON DELETE SET NULL,
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS staging_rows (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER NOT NULL REFERENCES import_sessions(id) ON DELETE CASCADE,
                    linha INTEGER NOT NULL,
                    id_lancamento VARCHAR(120),
                    id_task VARCHAR(120),
                    login_usuario VARCHAR(180),
                    titulo_task TEXT,
                    dados_originais JSONB NOT NULL,
                    categoria_sugerida VARCHAR(120),
                    subcategoria_sugerida VARCHAR(120),
                    origem_classificacao VARCHAR(80),
                    confianca NUMERIC(5, 2),
                    nivel_confianca VARCHAR(20),
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE(session_id, linha)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS import_logs (
                    id SERIAL PRIMARY KEY,
                    session_id INTEGER REFERENCES import_sessions(id) ON DELETE CASCADE,
                    importacao_id INTEGER REFERENCES importacoes(id) ON DELETE CASCADE,
                    etapa VARCHAR(80) NOT NULL,
                    nivel VARCHAR(20) NOT NULL DEFAULT 'info',
                    evento VARCHAR(120) NOT NULL,
                    mensagem TEXT,
                    metricas JSONB,
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS pending_reviews (
                    id SERIAL PRIMARY KEY,
                    importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
                    tipo VARCHAR(60) NOT NULL,
                    chave VARCHAR(320) NOT NULL,
                    status VARCHAR(40) NOT NULL DEFAULT 'pendente',
                    observacao TEXT,
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE(importacao_id, tipo, chave)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_log (
                    id SERIAL PRIMARY KEY,
                    entidade VARCHAR(120) NOT NULL,
                    registro_id VARCHAR(120),
                    acao VARCHAR(120) NOT NULL,
                    usuario VARCHAR(180) NOT NULL DEFAULT 'sistema',
                    antes JSONB,
                    depois JSONB,
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS comparativos_projetos (
                    id SERIAL PRIMARY KEY,
                    nome VARCHAR(180) NOT NULL,
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS comparativos_projetos_importacoes (
                    id SERIAL PRIMARY KEY,
                    comparativo_id INTEGER NOT NULL REFERENCES comparativos_projetos(id) ON DELETE CASCADE,
                    importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
                    ordem INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(comparativo_id, importacao_id)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS classification_rules (
                    id SERIAL PRIMARY KEY,
                    nome VARCHAR(160) NOT NULL,
                    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
                    subcategoria_id INTEGER REFERENCES subcategorias(id) ON DELETE SET NULL,
                    palavras_chave JSONB NOT NULL DEFAULT '[]'::jsonb,
                    prioridade INTEGER NOT NULL DEFAULT 0,
                    ativa BOOLEAN NOT NULL DEFAULT TRUE,
                    versao VARCHAR(40) NOT NULL DEFAULT '1.0.0',
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE(nome)
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS classification_reprocess_history (
                    id SERIAL PRIMARY KEY,
                    importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
                    lancamento_id INTEGER NOT NULL REFERENCES lancamentos_horas(id) ON DELETE CASCADE,
                    categoria_anterior VARCHAR(120),
                    subcategoria_anterior VARCHAR(120),
                    categoria_nova VARCHAR(120),
                    subcategoria_nova VARCHAR(120),
                    confianca_anterior NUMERIC(5, 2),
                    confianca_nova NUMERIC(5, 2),
                    nivel_confianca_anterior VARCHAR(20),
                    nivel_confianca_novo VARCHAR(20),
                    versao_anterior VARCHAR(40),
                    versao_nova VARCHAR(40),
                    origem_nova VARCHAR(80),
                    fatores_confianca JSONB,
                    motivo TEXT,
                    usuario VARCHAR(180) NOT NULL DEFAULT 'sistema',
                    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS analytics_insights (
                    id SERIAL PRIMARY KEY,
                    importacao_id INTEGER REFERENCES importacoes(id) ON DELETE CASCADE,
                    tipo VARCHAR(50) NOT NULL,
                    severidade VARCHAR(20) NOT NULL,
                    titulo VARCHAR(255) NOT NULL,
                    descricao TEXT NOT NULL,
                    recomendacao TEXT,
                    metricas_json JSONB,
                    status VARCHAR(20) NOT NULL DEFAULT 'novo',
                    gerado_em TIMESTAMP NOT NULL DEFAULT NOW(),
                    revisado_em TIMESTAMP NULL,
                    usuario_revisao VARCHAR(100) NULL
                )
                """
            )
            cursor.execute(
                """
                INSERT INTO classification_rules (nome, categoria_id, palavras_chave, prioridade, ativa, versao)
                SELECT
                    CONCAT('Regra - ', c.nome) AS nome,
                    c.id AS categoria_id,
                    COALESCE(JSONB_AGG(p.palavra ORDER BY p.palavra) FILTER (WHERE p.palavra IS NOT NULL), '[]'::jsonb) AS palavras_chave,
                    CASE
                        WHEN c.nome = 'Retrabalho' THEN 50
                        WHEN c.nome = 'Homologacao' OR c.nome = 'Homologação' THEN 40
                        WHEN c.nome = 'Definicao' OR c.nome = 'Definição' OR c.nome = 'Analise/Definição' THEN 30
                        WHEN c.nome = 'Desenvolvimento' THEN 20
                        ELSE 10
                    END AS prioridade,
                    c.ativa,
                    '1.0.0'
                FROM categorias c
                LEFT JOIN palavras_chave_categoria p ON p.categoria_id = c.id AND p.ativa = TRUE
                WHERE NOT EXISTS (SELECT 1 FROM classification_rules)
                GROUP BY c.id, c.nome, c.ativa
                """
            )
            cursor.execute(
                """
                ALTER TABLE subcategorias
                ADD COLUMN IF NOT EXISTS grupo VARCHAR(120)
                """
            )
            cursor.execute(
                """
                ALTER TABLE subcategorias
                ADD COLUMN IF NOT EXISTS alias_ia VARCHAR(160)
                """
            )
            cursor.execute(
                """
                ALTER TABLE classificacoes_task
                ADD COLUMN IF NOT EXISTS versao_classificador VARCHAR(40) NOT NULL DEFAULT '1.0.0'
                """
            )
            cursor.execute(
                """
                ALTER TABLE classificacoes_task
                ADD COLUMN IF NOT EXISTS nivel_confianca VARCHAR(20) NOT NULL DEFAULT 'media'
                """
            )
            cursor.execute(
                """
                ALTER TABLE importacoes
                ADD COLUMN IF NOT EXISTS versao_classificador VARCHAR(40) NOT NULL DEFAULT '1.0.0'
                """
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_importacoes_hash ON importacoes(hash_arquivo)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_importacoes_nome ON importacoes(nome_arquivo)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_lancamentos_importacao_id_lancamento ON lancamentos_horas(importacao_id, id_lancamento)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_staging_rows_session ON staging_rows(session_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_import_logs_session ON import_logs(session_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_pending_reviews_importacao ON pending_reviews(importacao_id, tipo, status)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_log_entidade ON audit_log(entidade, acao, criado_em DESC)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON audit_log(entidade, registro_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_comparativos_importacoes_comparativo ON comparativos_projetos_importacoes(comparativo_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_classification_rules_categoria ON classification_rules(categoria_id, ativa, prioridade DESC)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_reprocess_history_importacao ON classification_reprocess_history(importacao_id, criado_em DESC)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_analytics_insights_importacao ON analytics_insights(importacao_id)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_analytics_insights_tipo ON analytics_insights(tipo)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_analytics_insights_severidade ON analytics_insights(severidade)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_analytics_insights_status ON analytics_insights(status)"
            )
            cursor.execute(
                """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_insights_unique_simple
                ON analytics_insights(importacao_id, tipo, titulo, descricao)
                """
            )
