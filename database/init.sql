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
    observacao TEXT
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
CREATE INDEX IF NOT EXISTS idx_import_sessions_status ON import_sessions(status);
CREATE INDEX IF NOT EXISTS idx_staging_rows_session ON staging_rows(session_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_session ON import_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_importacao ON pending_reviews(importacao_id, tipo, status);
CREATE INDEX IF NOT EXISTS idx_comparativos_importacoes_comparativo ON comparativos_projetos_importacoes(comparativo_id);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_importacao ON analytics_insights(importacao_id);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_tipo ON analytics_insights(tipo);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_severidade ON analytics_insights(severidade);
CREATE INDEX IF NOT EXISTS idx_analytics_insights_status ON analytics_insights(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_insights_unique_simple
    ON analytics_insights(importacao_id, tipo, titulo, descricao);

INSERT INTO categorias (nome, ordem_exibicao) VALUES
    ('Acompanhamento', 1),
    ('Definição', 2),
    ('Desenvolvimento', 3),
    ('Homologação', 4),
    ('Impedimento', 5),
    ('Retrabalho', 6),
    ('Nao classificado', 99)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO subcategorias (nome, grupo, alias_ia, ordem_exibicao) VALUES
    ('Analista', 'Gestão', 'analista funcional requisitos', 1),
    ('Desenvolvedor Back-end', 'Desenvolvimento', 'back backend back-end', 2),
    ('Desenvolvedor Front-end', 'Desenvolvimento', 'front frontend front-end', 3),
    ('QA', 'Qualidade', 'qa testes qualidade', 4),
    ('Banco de Dados', 'Dados', 'banco dados dba database', 5),
    ('Infraestrutura', 'Operações', 'infraestrutura devops operacoes', 6),
    ('DataOps', 'Dados', 'dataops dados pipelines', 7),
    ('Nao aplicavel', NULL, NULL, 98),
    ('Nao classificado', NULL, NULL, 99)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO palavras_chave_categoria (categoria_id, palavra)
SELECT c.id, v.palavra
FROM categorias c
JOIN (
    VALUES
        ('Desenvolvimento', 'adicionando'),
        ('Desenvolvimento', 'auxilio'),
        ('Desenvolvimento', 'buscando'),
        ('Desenvolvimento', 'criar'),
        ('Desenvolvimento', 'criar servico'),
        ('Desenvolvimento', 'criacao'),
        ('Desenvolvimento', 'criando'),
        ('Desenvolvimento', 'desenvolvimento'),
        ('Desenvolvimento', 'implementar'),
        ('Desenvolvimento', 'implementando'),
        ('Desenvolvimento', 'montando'),
        ('Desenvolvimento', 'organizando'),
        ('Desenvolvimento', 'preparando'),
        ('Desenvolvimento', 'publicando'),
        ('Desenvolvimento', 'revisao'),
        ('Desenvolvimento', 'subindo'),
        ('Desenvolvimento', 'endpoint'),
        ('Desenvolvimento', 'api'),
        ('Desenvolvimento', 'tela'),
        ('Desenvolvimento', 'componente'),
        ('Desenvolvimento', 'integracao'),
        ('Desenvolvimento', 'integrar'),
        ('Reuniao', 'reuniao'),
        ('Reuniao', 'call'),
        ('Reuniao', 'daily'),
        ('Alinhamento', 'alinhamento'),
        ('Alinhamento', 'alinhar'),
        ('Definição', 'definir'),
        ('Definição', 'levant'),
        ('Definição', 'levantamento'),
        ('Definição', 'mapeando'),
        ('Definição', 'regra'),
        ('Definição', 'refinamento'),
        ('Definição', 'documentacao'),
        ('Definição', 'documento'),
        ('Definição', 'estudo'),
        ('Definição', 'analise'),
        ('Definição', 'analis'),
        ('Definição', 'analisando'),
        ('Definição', 'analisar'),
        ('Definição', 'avaliando'),
        ('Definição', 'estud'),
        ('Definição', 'estudando'),
        ('Homologação', 'homologacao'),
        ('Homologação', 'homologar'),
        ('Homologação', 'validacao'),
        ('Homologação', 'validando'),
        ('Homologação', 'validar'),
        ('Homologação', 'testes'),
        ('Homologação', 'testando'),
        ('Testes cruzados', 'teste cruzado'),
        ('Testes cruzados', 'testes cruzados'),
        ('Retrabalho', 'retrabalho'),
        ('Retrabalho', 'refatorando'),
        ('Retrabalho', 'verificando'),
        ('Retrabalho', 'ajustes'),
        ('Retrabalho', 'ajustado'),
        ('Retrabalho', 'corrigindo'),
        ('Retrabalho', 'corrigir'),
        ('Retrabalho', 'correcao'),
        ('Retrabalho', 'ajustando'),
        ('Retrabalho', 'bug'),
        ('Retrabalho', 'falha'),
        ('Analise', 'investigar')
) AS v(categoria, palavra) ON v.categoria = c.nome
ON CONFLICT (categoria_id, palavra) DO NOTHING;
