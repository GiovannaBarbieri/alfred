# Fase 2 - Importacao com staging

## Objetivo

Evoluir o fluxo de importacao para um modelo temporario antes da persistencia final, mantendo o foco em analise operacional das horas apontadas no TFS.

## Fluxo implementado

1. Upload do arquivo Excel/CSV.
2. Criacao de uma sessao temporaria em `import_sessions`.
3. Gravacao das linhas cruas em `staging_rows`.
4. Validacao e classificacao automatica.
5. Identificacao de colaboradores sem perfil ativo.
6. Cadastro rapido opcional dos colaboradores encontrados.
7. Revisao de bloqueios, alertas, duplicidades e classificacoes.
8. Confirmacao do usuario.
9. Persistencia final em `importacoes`, `lancamentos_horas`, `erros_importacao`, `duplicidades_importacao` e `classificacoes_task`.

## Recursos adicionados

- Staging de importacao por sessao.
- Cancelamento de sessao temporaria.
- Reprocessamento de sessao ainda nao concluida, usando o arquivo armazenado.
- Logs estruturados em `import_logs`.
- Score numerico e nivel de confianca da classificacao.
- Versao do classificador gravada com cada classificacao.
- Alertas operacionais simples sem bloqueio da importacao.
- Assistente de cadastro rapido para colaboradores sem perfil ativo.
- Aplicacao do cargo cadastrado como subcategoria sugerida na revisao atual quando a atividade estava sem cargo.

## Compatibilidade

Os endpoints antigos de validacao e conclusao por arquivo continuam disponiveis para compatibilidade:

- `POST /api/imports/validate`
- `POST /api/imports/complete`

O fluxo novo usa:

- `POST /api/imports/sessions`
- `POST /api/imports/sessions/{session_id}/reprocess`
- `POST /api/imports/sessions/{session_id}/complete`
- `DELETE /api/imports/sessions/{session_id}`

## Limites mantidos

Esta fase nao implementa IA generativa, chatbot, login corporativo, controle de ponto, banco de horas ou regras trabalhistas.
