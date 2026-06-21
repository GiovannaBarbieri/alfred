-- Estrutura consolidada do banco - Gerenciador de Projetos
-- Base: PostgreSQL
-- Observacao: este arquivo consolida o schema inicial de database/init.sql
-- com tabelas/colunas criadas em runtime por backend/app/services/schema_service.py.

CREATE TABLE IF NOT EXISTS categorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    descricao VARCHAR(255),
    ordem_exibicao INTEGER,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subcategorias (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL UNIQUE,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    grupo VARCHAR(120),
    alias_ia VARCHAR(160),
    ordem_exibicao INTEGER,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS palavras_chave_categoria (
    id SERIAL PRIMARY KEY,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    palavra VARCHAR(160) NOT NULL,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(categoria_id, palavra)
);

CREATE TABLE IF NOT EXISTS perfis_colaborador (
    id SERIAL PRIMARY KEY,
    login_usuario VARCHAR(180) NOT NULL UNIQUE,
    subcategoria_id INTEGER NOT NULL REFERENCES subcategorias(id),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS colaboradores_ignorados (
    id SERIAL PRIMARY KEY,
    login_usuario VARCHAR(180) NOT NULL UNIQUE,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classification_rules (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(160) NOT NULL UNIQUE,
    categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    subcategoria_id INTEGER REFERENCES subcategorias(id) ON DELETE SET NULL,
    palavras_chave JSONB NOT NULL DEFAULT '[]'::jsonb,
    prioridade INTEGER NOT NULL DEFAULT 0,
    ativa BOOLEAN NOT NULL DEFAULT TRUE,
    versao VARCHAR(40) NOT NULL DEFAULT '1.0.0',
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS importacoes (
    id SERIAL PRIMARY KEY,
    nome_arquivo VARCHAR(255) NOT NULL,
    hash_arquivo VARCHAR(128) NOT NULL,
    status VARCHAR(40) NOT NULL,
    data_importacao TIMESTAMP NOT NULL DEFAULT NOW(),
    total_registros INTEGER NOT NULL DEFAULT 0,
    registros_validos INTEGER NOT NULL DEFAULT 0,
    registros_com_alerta INTEGER NOT NULL DEFAULT 0,
    registros_bloqueados INTEGER NOT NULL DEFAULT 0,
    observacao TEXT,
    versao_classificador VARCHAR(40) NOT NULL DEFAULT '1.0.0'
);

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
);

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
);

CREATE TABLE IF NOT EXISTS lancamentos_horas (
    id SERIAL PRIMARY KEY,
    importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
    id_lancamento VARCHAR(120) NOT NULL,
    data_hora_cadastro TIMESTAMP NOT NULL,
    task VARCHAR(255) NOT NULL,
    login_usuario VARCHAR(180) NOT NULL,
    duracao_original VARCHAR(40) NOT NULL,
    duracao_segundos INTEGER NOT NULL,
    id_epic VARCHAR(120) NOT NULL,
    titulo_epic TEXT NOT NULL,
    id_feat VARCHAR(120) NOT NULL,
    titulo_feat TEXT NOT NULL,
    id_pbi VARCHAR(120) NOT NULL,
    titulo_pbi TEXT NOT NULL,
    id_task VARCHAR(120) NOT NULL,
    titulo_task TEXT NOT NULL,
    categoria_id INTEGER REFERENCES categorias(id),
    subcategoria_id INTEGER REFERENCES subcategorias(id),
    status_validacao VARCHAR(40) NOT NULL DEFAULT 'valido',
    status_classificacao VARCHAR(40) NOT NULL DEFAULT 'automatica',
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(importacao_id, id_lancamento)
);

CREATE TABLE IF NOT EXISTS erros_importacao (
    id SERIAL PRIMARY KEY,
    importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
    linha INTEGER,
    campo VARCHAR(120) NOT NULL,
    valor_encontrado TEXT,
    tipo_erro VARCHAR(120) NOT NULL,
    severidade VARCHAR(40) NOT NULL,
    mensagem TEXT NOT NULL,
    resolvido BOOLEAN NOT NULL DEFAULT FALSE,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS duplicidades_importacao (
    id SERIAL PRIMARY KEY,
    importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
    id_lancamento VARCHAR(120) NOT NULL,
    linhas_envolvidas JSONB NOT NULL,
    registro_mantido_id INTEGER REFERENCES lancamentos_horas(id),
    registros_removidos JSONB,
    resolvido BOOLEAN NOT NULL DEFAULT FALSE,
    data_resolucao TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classificacoes_task (
    id SERIAL PRIMARY KEY,
    lancamento_id INTEGER NOT NULL REFERENCES lancamentos_horas(id) ON DELETE CASCADE,
    titulo_task TEXT NOT NULL,
    categoria_sugerida_id INTEGER REFERENCES categorias(id),
    subcategoria_sugerida_id INTEGER REFERENCES subcategorias(id),
    categoria_final_id INTEGER REFERENCES categorias(id),
    subcategoria_final_id INTEGER REFERENCES subcategorias(id),
    origem_classificacao VARCHAR(80) NOT NULL,
    confianca NUMERIC(5, 2) NOT NULL DEFAULT 0,
    nivel_confianca VARCHAR(20) NOT NULL DEFAULT 'media',
    versao_classificador VARCHAR(40) NOT NULL DEFAULT '1.0.0',
    aprovado_por_usuario BOOLEAN NOT NULL DEFAULT FALSE,
    data_aprovacao TIMESTAMP
);

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
);

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
);

CREATE TABLE IF NOT EXISTS comparativos_projetos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(180) NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comparativos_projetos_importacoes (
    id SERIAL PRIMARY KEY,
    comparativo_id INTEGER NOT NULL REFERENCES comparativos_projetos(id) ON DELETE CASCADE,
    importacao_id INTEGER NOT NULL REFERENCES importacoes(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL DEFAULT 0,
    UNIQUE(comparativo_id, importacao_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    entidade VARCHAR(120) NOT NULL,
    registro_id VARCHAR(120),
    acao VARCHAR(120) NOT NULL,
    usuario VARCHAR(180) NOT NULL DEFAULT 'sistema',
    antes JSONB,
    depois JSONB,
    criado_em TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auditoria_acoes (
    id SERIAL PRIMARY KEY,
    importacao_id INTEGER REFERENCES importacoes(id) ON DELETE CASCADE,
    entidade VARCHAR(120) NOT NULL,
    entidade_id VARCHAR(120),
    acao VARCHAR(120) NOT NULL,
    valor_anterior JSONB,
    valor_novo JSONB,
    data_acao TIMESTAMP NOT NULL DEFAULT NOW()
);

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
);

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
);

CREATE INDEX IF NOT EXISTS idx_lancamentos_importacao ON lancamentos_horas(importacao_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario ON lancamentos_horas(login_usuario);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON lancamentos_horas(data_hora_cadastro);
CREATE INDEX IF NOT EXISTS idx_lancamentos_epic ON lancamentos_horas(id_epic);
CREATE INDEX IF NOT EXISTS idx_lancamentos_categoria ON lancamentos_horas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_importacao_id_lancamento ON lancamentos_horas(importacao_id, id_lancamento);

CREATE INDEX IF NOT EXISTS idx_importacoes_hash ON importacoes(hash_arquivo);
CREATE INDEX IF NOT EXISTS idx_importacoes_nome ON importacoes(nome_arquivo);
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_staging_rows_session ON staging_rows(session_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_session ON import_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_importacao ON pending_reviews(importacao_id, tipo, status);
CREATE INDEX IF NOT EXISTS idx_comparativos_importacoes_comparativo ON comparativos_projetos_importacoes(comparativo_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entidade ON audit_log(entidade, acao, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON audit_log(entidade, registro_id);
CREATE INDEX IF NOT EXISTS idx_classification_rules_categoria ON classification_rules(categoria_id, ativa, prioridade DESC);
CREATE INDEX IF NOT EXISTS idx_reprocess_history_importacao ON classification_reprocess_history(importacao_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_importacao ON analytics_insights(importacao_id);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_tipo ON analytics_insights(tipo);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_severidade ON analytics_insights(severidade);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_status ON analytics_insights(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_insights_unique_simple
    ON analytics_insights(importacao_id, tipo, titulo, descricao);
