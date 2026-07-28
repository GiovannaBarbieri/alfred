# Escopo e estado do produto

Revisão: **28/07/2026**.

## Objetivo atual

Entregar rastreabilidade das horas do TFS em dois contextos:

- análise operacional de projetos importados;
- indicadores gerenciais oficiais salvos por período.

## Funcionalidades ativas

### Relatórios > Projetos

- importação Excel/CSV;
- entrada alternativa via SQL Server;
- staging;
- validação de estrutura e conteúdo;
- duplicidades;
- classificação automática e manual;
- perfis de colaboradores;
- confirmação;
- relatórios executivo, gráficos, Tasks, evolução e comparativos;
- exportações.

### Relatórios > Indicadores Gerais

- período livre;
- consulta assíncrona ao SQL Server/TFS;
- hierarquia em lote;
- identificação real de PBI/Bug;
- TAGs da Feature;
- pendências detalhadas;
- atualização seletiva;
- salvamento de relatório independente;
- redirecionamento automático.

### Relatórios > Meus Relatórios

- listagem paginada;
- busca e filtro anual;
- abertura somente leitura;
- KPIs e gráficos;
- snapshot histórico;
- análise por período;
- exclusão permanente.

### Configurações

- categorias, subcategorias, palavras-chave e regras;
- colaboradores e participação;
- pesos configuráveis da distribuição.

## Funcionalidades preservadas, fora do menu

- Dashboard;
- Histórico;
- Auditoria;
- Inteligência Operacional.

O backend e os componentes permanecem no repositório. Uma eventual reativação deve incluir revisão de navegação, permissões e testes.

## Garantias implementadas

- migrations versionadas e com checksum;
- transações nas operações críticas;
- concorrência controlada por estado e locks;
- snapshots oficiais imutáveis;
- consulta de relatórios sem acesso ao TFS;
- distribuição ponderada reconciliada;
- atualização seletiva preservando dados válidos;
- testes de regras críticas;
- compressão de respostas grandes.

## Limites atuais

- não existe autenticação/autorização corporativa completa;
- frontend é uma SPA sem roteador URL tradicional;
- parte do domínio Projetos ainda depende de `schema_service.py` para compatibilidade;
- frontend não possui uma suíte E2E completa;
- observabilidade é baseada principalmente em logs;
- Windows Authentication para SQL Server requer backend rodando no Windows.

## Fora do produto

- controle de jornada;
- ponto eletrônico;
- folha;
- banco de horas;
- gestão de férias;
- edição automática de TAGs/work items no TFS;
- BI externo ou data warehouse.
