# Modelo De Dados Atual

## Visao Geral

O banco principal e PostgreSQL.

A estrutura inicial esta em:

```text
database/init.sql
```

O backend tambem executa ajustes incrementais no startup por:

```text
backend/app/services/schema_service.py
```

A estrutura consolidada para consulta fica em:

```text
docs/10-estrutura-banco.sql
```

## Grupos De Tabelas

### Configuracao e classificacao

```text
categorias
subcategorias
palavras_chave_categoria
classification_rules
perfis_colaborador
colaboradores_ignorados
```

Uso:

```text
Categorias classificam a atividade.
Cargos/perfis operacionais ficam em subcategorias.
Grupos de cargos apoiam filtros e leitura gerencial.
Perfis vinculam colaborador a cargo.
Palavras-chave e regras apoiam classificacao automatica.
```

Categorias oficiais ativas:

```text
Acompanhamento
Definicao
Desenvolvimento
Homologacao
Impedimento
Retrabalho
```

Cargos oficiais ativos:

```text
Analista
Desenvolvedor Back-end
Desenvolvedor Front-end
QA
Banco de Dados
Infraestrutura
DataOps
```

### Importacao com staging

```text
import_sessions
staging_rows
import_logs
```

Uso:

```text
Guardar a importacao temporaria antes da confirmacao.
Preservar linhas cruas/processadas.
Permitir reprocessamento e cancelamento sem gravar tabelas finais.
Registrar eventos da importacao.
```

### Dados consolidados

```text
importacoes
lancamentos_horas
erros_importacao
duplicidades_importacao
classificacoes_task
```

Uso:

```text
Guardar importacoes confirmadas.
Guardar lancamentos de horas.
Preservar erros, alertas e duplicidades.
Guardar classificacao sugerida/final por lancamento.
```

### Relatorios e comparativos

```text
pending_reviews
comparativos_projetos
comparativos_projetos_importacoes
classification_reprocess_history
```

Uso:

```text
Controlar revisoes internas.
Salvar comparativos entre importacoes/projetos.
Registrar historico de reclassificacao.
```

### Auditoria e inteligencia operacional

```text
audit_log
auditoria_acoes
analytics_insights
```

Uso:

```text
Registrar eventos tecnicos e alteracoes importantes.
Persistir insights operacionais gerados pelo backend.
```

Observacao:

```text
As telas de Auditoria e Inteligencia Operacional estao ocultas no frontend atual.
As tabelas permanecem no banco porque endpoints, historico interno e evolucoes futuras ainda dependem delas.
```

## Principais Relacionamentos

```text
importacoes -> lancamentos_horas
importacoes -> erros_importacao
importacoes -> duplicidades_importacao
importacoes -> pending_reviews
importacoes -> analytics_insights
importacoes -> classification_reprocess_history
import_sessions -> staging_rows
import_sessions -> import_logs
categorias -> lancamentos_horas
subcategorias -> lancamentos_horas
subcategorias -> perfis_colaborador
lancamentos_horas -> classificacoes_task
comparativos_projetos -> comparativos_projetos_importacoes
```

## Observacoes

- O sistema ainda nao usa migrations formais.
- `schema_service.py` garante compatibilidade incremental em bases existentes.
- Para ambiente corporativo, o recomendado e migrar para Alembic ou ferramenta equivalente.
- Horas extras, banco de horas e regras trabalhistas nao fazem parte do modelo.
