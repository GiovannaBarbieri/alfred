# Referência técnica completa

Revisão: **10/08/2026**.

Este documento orienta desenvolvimento e manutenção. Regras funcionais detalhadas estão em [02-tabela-regras.md](02-tabela-regras.md); endpoints em [11-diagramas-endpoints-fluxos.md](11-diagramas-endpoints-fluxos.md).

## Componentes do sistema

### Backend

```text
backend/app/
├── api/routes/
│   ├── analytics.py
│   ├── audit.py
│   ├── dashboard.py
│   ├── exports.py
│   ├── general_indicators.py
│   ├── imports.py
│   ├── reports.py
│   └── settings.py
├── core/config.py
├── importers/spreadsheet_importer.py
├── repositories/
│   ├── distribution_weights_repository.py
│   ├── general_indicators_repository.py
│   ├── report_history_repository.py
│   └── ...
├── schemas/
│   ├── distribution_weights.py
│   ├── general_indicators.py
│   ├── imports.py
│   └── report_history.py
└── services/
    ├── general_indicators_classification.py
    ├── general_indicators_rules.py
    ├── general_indicators_service.py
    ├── general_indicators_validation.py
    ├── distribution_weights_service.py
    ├── report_history_service.py
    ├── sqlserver_service.py
    └── ...
```

### Frontend

```text
frontend/src/
├── components/
│   ├── general-indicators/
│   ├── my-reports/
│   ├── reports/
│   ├── settings/
│   └── validation/
├── hooks/
├── pages/
├── services/
├── types/
├── utils/
├── App.tsx
└── styles.css
```

## Configuração do backend

`Settings` usa `pydantic-settings` e lê `.env` na raiz.

| Variável | Padrão/uso |
| --- | --- |
| `DATABASE_URL` | PostgreSQL usado pelo processo |
| `BACKEND_CORS_ORIGINS` | origens separadas por vírgula |
| `IMPORT_SESSION_RETENTION_DAYS` | 7 |
| `SQLSERVER_DRIVER` | ODBC Driver 18 for SQL Server |
| `SQLSERVER_PORT` | 1433 |
| `SQLSERVER_AUTH` | `sql` |
| `SQLSERVER_ENCRYPT` | `true` |
| `SQLSERVER_TRUST_CERT` | `true` |
| `SQLSERVER_CONNECTION_TIMEOUT_SECONDS` | 10 |
| `SQLSERVER_REQUEST_TIMEOUT` | 60000 ms |
| `GENERAL_INDICATOR_PROCESSING_TIMEOUT_SECONDS` | 900 |
| `BACKEND_BUILD_IDENTIFIER` | versão opcional do build |

## Banco e transações

`get_connection()`:

- converte URL SQLAlchemy em URL aceita pelo psycopg;
- usa `dict_row`;
- commit no sucesso;
- rollback em exceção;
- sempre fecha conexão.

Serviços que precisam de atomicidade mantêm todas as operações na mesma conexão.

### Migrations

`migration_service.py`:

- descobre `.sql` em ordem;
- cria `schema_migrations`;
- adquire lock;
- calcula checksum;
- falha se arquivo aplicado foi modificado;
- aplica somente pendentes.

### Schema legado

`schema_service.py` ainda garante estruturas e seeds do domínio Projetos de forma idempotente. Novas mudanças devem preferir migrations.

## SQL Server/TFS

### Objetos usados

O conjunto atual inclui:

- `advise.RegistroHorario`;
- `tbl_WorkItemCoreLatest`;
- `WorkItemLONgTexts`;
- `LinksAre`;
- `tbl_PropertyValue`;
- `tbl_PropertyDefinition`;
- `tbl_TagDefinition`.

O acesso deve ser somente leitura.

`tbl_WorkItemCoreLatest.State` é a fonte usada para representar o estado atual do Work Item exibido no TFS. A consulta de hierarquia retorna o estado individual de Task, PBI/Bug, Feature e Epic quando o respectivo item é resolvido.

### Estratégia de desempenho

- uma consulta para lançamentos do período;
- IDs de Tasks únicos;
- hierarquia e `State` dos Work Items consultados em lotes;
- Features únicas consultadas em lotes;
- métricas de tempo por etapa;
- paginação na resposta PostgreSQL;
- processamento assíncrono para não manter request aberto.

Não adicionar `NOLOCK` às consultas oficiais: ele permite dirty reads, linhas duplicadas/ausentes e relações inconsistentes.

## Motor de Indicadores Gerais

### Classificação

`general_indicators_classification.py`:

- agrupa evidências de hierarquia;
- resolve tipo real;
- preserva lançamentos independentes;
- identifica Feature válida;
- identifica Work Items com `State = Removed` na cadeia resolvida;
- analisa TAGs;
- produz `trace` e diagnósticos.

### Validação

`general_indicators_validation.py`:

- valida lançamento e Feature;
- agrupa TAGs por Feature;
- calcula impacto;
- relaciona consequência à causa raiz;
- considera participação de colaborador;
- trata `State = Removed` como desconsideração automática, sem gerar inconsistência impeditiva;
- impede distribuição sem base mensal.

### Cálculo

`general_indicators_rules.py`:

- normaliza duração/categoria;
- distribui Atualização do sistema;
- calcula KPIs;
- balanceia arredondamento;
- monta snapshot e auditoria;
- registra versões e configuração histórica.

Lançamentos desconsiderados por Work Item removido permanecem auditáveis, mas são removidos antes dos cálculos finais. Se eram `Atualização do sistema`, suas horas não entram na base transitória e não são redistribuídas.

Não duplique fórmulas no frontend. O frontend apenas apresenta resultados.

### Orquestração

`general_indicators_service.py`:

- cria execução;
- processa consulta;
- persiste progresso;
- atualiza pendências;
- refaz consulta;
- controla concorrência;
- finaliza e cria relatório;
- pagina resultados/auditoria.

## Meus Relatórios

`report_history_service.py`:

- lista relatórios;
- abre snapshot;
- exclui permanentemente;
- mantém compatibilidade com revisões legadas;
- calcula análise por período.

A análise por período:

1. carrega snapshot completo do PostgreSQL;
2. valida o subperíodo;
3. extrai lançamentos da auditoria persistida;
4. recupera pesos históricos de `rules.distribution.configuration`;
5. reutiliza `build_finalized_general_indicators`;
6. devolve somente agregados.

Se snapshot antigo não tiver pesos históricos suficientes, a operação falha de forma explícita; não usa silenciosamente a configuração atual.

## Contratos e compatibilidade

- `GeneralIndicatorFinalizedSnapshot` tipa o resultado oficial.
- `SavedReport*` são nomes públicos neutros.
- classes `AnnualReport*` permanecem como base por compatibilidade interna.
- `source=SAVED_SNAPSHOT` identifica análise histórica.
- o endpoint de detalhe não precisa transferir toda a auditoria.

Ao alterar contrato:

1. manter leitura de snapshots legados;
2. incrementar versão quando houver mudança semântica;
3. criar adaptação de leitura, não regravar histórico;
4. atualizar TypeScript;
5. adicionar testes.

## Frontend — fluxos

### Indicadores Gerais

`GeneralIndicatorsFlowPage` controla:

- filtros;
- consulta;
- progresso;
- atualização;
- nome;
- salvamento;
- redirecionamento por `reportId`.

`GeneralIndicatorConsultationPanel` apresenta validação. Componentes de resultado final são usados somente em Meus Relatórios.

### Meus Relatórios

`useReportHistory` mantém:

- filtros digitados/aplicados;
- paginação;
- carregamento/refresh;
- abertura;
- exclusão;
- avisos temporários.

`MyReportsPage` alterna:

- lista;
- visão de relatório;
- Visão Geral, com Análise por período em card recolhível.

`useReportPeriodAnalysis` não executa automaticamente ao mudar datas, bloqueia requisições simultâneas e restaura o período completo ao limpar.

O endpoint da análise por período relê somente o snapshot PostgreSQL, reaplica pesos e metas históricas persistidas e devolve evolução diária para intervalos de até 31 dias ou mensal para intervalos maiores. Nenhuma consulta ao TFS/SQL Server e nenhuma gravação são realizadas.

### Metas dos indicadores

`IndicatorTargetsSettingsPage` gerencia períodos de metas em Configurações. O backend expõe `/api/settings/indicator-targets` para listar, criar, editar e excluir vigências. O serviço impede sobreposição, valida percentuais entre 0 e 100 e exige que novas consultas estejam cobertas por uma única vigência. Relatórios finalizados usam sempre a configuração gravada no snapshot.

### Estado de navegação

`App.tsx` controla a seção atual e abertura automática do relatório salvo. `navigationAccordion.ts` controla o grupo expandido.

## Convenções

### Python

- type hints;
- serviços pequenos por caso de uso;
- repositories recebem conexão quando participam de transação;
- exceções de domínio convertidas em HTTP na rota;
- `Decimal` para distribuição;
- datas ISO nos contratos.

### TypeScript

- tipos compartilhados;
- hooks para estado assíncrono;
- utilitários puros testáveis;
- componentes sem regra oficial de cálculo;
- botões com `disabled` real e atributos ARIA;
- estados de erro, vazio e loading explícitos.

### SQL

- nomes atuais em snake_case;
- parâmetros em vez de concatenação;
- FK e índices próximos ao caso de uso;
- migration imutável;
- exclusões críticas em transação.

## Testes

### Backend

Cobertura funcional:

- importação e staging;
- validação/classificação;
- hierarquia e TAGs;
- participação;
- distribuição ponderada;
- finalização/snapshot/hash;
- atualização seletiva;
- concorrência;
- performance/paginação;
- histórico/exclusão;
- análise por período;
- migrations e compressão.

### Frontend

Scripts:

```text
test:review-criteria
test:general-indicators
test:distribution-weights
test:navigation
test:report-history
test:period-analysis
test:period-comparison
```

Também é obrigatório executar `npm run build`.

## Checklist para mudança

1. identificar domínio e fonte de verdade;
2. preservar alterações locais não relacionadas;
3. atualizar schema/contrato;
4. criar migration se necessário;
5. implementar repository/service/route;
6. atualizar service/hook/componente frontend;
7. testar caso feliz, erro e legado;
8. validar reconciliação;
9. executar suíte;
10. atualizar documentação.
