# Backlog técnico

Revisão: **28/07/2026**.

Itens concluídos foram removidos deste backlog e estão descritos nos demais documentos.

## Prioridade alta

### Autenticação e autorização

- integrar identidade corporativa;
- obter usuário autenticado no backend;
- controlar permissões de configuração, exclusão e auditoria;
- deixar de aceitar `actor` apenas como dado informado pelo cliente.

### Observabilidade

- padronizar logs estruturados;
- incluir correlation ID;
- métricas de latência por endpoint e etapa;
- alerta para consulta SQL Server lenta/falha;
- painel de saúde PostgreSQL, SQL Server e filas em processamento.

### Banco

- mover o restante das evoluções de `schema_service.py` para migrations;
- criar processo formal de backup/restore por ambiente;
- testar restore periodicamente;
- definir política de retenção de consultas não finalizadas;
- revisar crescimento do JSONB `resultado` e de `dados_tecnicos`.

## Prioridade média

### API

- autenticação no Swagger;
- tratamento uniforme de erros;
- contratos mais específicos no lugar de `dict` em estruturas agregadas;
- endpoints administrativos para consultar migrations e saúde das integrações;
- política explícita de compatibilidade/depreciação do endpoint síncrono `/consultation`.

### Frontend

- roteamento por URL para deep links;
- error boundary global;
- testes de componentes com ambiente DOM;
- testes E2E dos fluxos principais;
- divisão de `styles.css` por domínio;
- padronização global de alertas/toasts;
- virtualização para listas muito grandes.

### Desempenho

- medir planos SQL reais em produção;
- avaliar índices do SQL Server com a equipe de infraestrutura;
- monitorar polling;
- cache curto para configurações somente leitura;
- paginação/streaming em exportações grandes.

## Prioridade baixa

- reavaliar reativação de Dashboard, Histórico, Auditoria e Inteligência Operacional;
- exportação dos Indicadores Gerais;
- comparação explícita entre relatórios salvos;
- agendamento de relatórios;
- notificações de conclusão;
- documentação OpenAPI enriquecida com exemplos.

## Dívidas conhecidas

- nomes históricos `annual_report` permanecem no código/banco por compatibilidade, apesar do modelo atual ser de relatórios independentes;
- coexistem `audit_log` e `auditoria_acoes`;
- o bootstrap inicial e as migrations não formam ainda um único mecanismo;
- alguns contratos legados permanecem expostos internamente;
- mensagens e comentários antigos podem usar a terminologia “anual”.

## Critérios para novas evoluções

Toda mudança em Indicadores Gerais deve:

1. preservar `IdLancamento`;
2. provar reconciliação de horas;
3. preservar snapshots anteriores;
4. impedir nova consulta ao TFS na leitura histórica;
5. incluir migration quando alterar persistência;
6. adicionar teste de regressão;
7. atualizar esta documentação.
