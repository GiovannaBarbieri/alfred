# Fase 2 - Importacao com staging

## Objetivo

Evoluir o fluxo de importacao para um modelo temporario antes da persistencia final, mantendo o foco em analise operacional das horas apontadas no TFS.

## Fluxo implementado

1. Upload do arquivo Excel/CSV.
2. Criacao de uma sessao temporaria em `import_sessions`.
3. Gravacao das linhas cruas em `staging_rows`.
4. Validacao e classificacao automatica.
5. Revisao de bloqueios, alertas, duplicidades e classificacoes.
6. Confirmacao do usuario.
7. Persistencia final em `importacoes`, `lancamentos_horas`, `erros_importacao`, `duplicidades_importacao` e `classificacoes_task`.

## Recursos adicionados

- Staging de importacao por sessao.
- Cancelamento de sessao temporaria.
- Reprocessamento de sessao ainda nao concluida, usando o arquivo armazenado.
- Logs estruturados em `import_logs`.
- Score numerico e nivel de confianca da classificacao.
- Versao do classificador gravada com cada classificacao.
- Alertas operacionais simples sem bloqueio da importacao.

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
