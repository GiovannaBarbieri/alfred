# Analise de Horas TFS

Sistema interno para importar, validar, classificar e analisar horas apontadas em projetos a partir de arquivos Excel/CSV extraidos do TFS 2015.

O foco e analise operacional das horas lancadas. O sistema nao e controle de ponto, RH, banco de horas, regra trabalhista ou gestao formal de jornada.

## Estado Atual Do Produto

Telas ativas no frontend:

```text
Dashboard
Importacao
Validacao
Relatorios
Configuracoes
```

Modulos preservados no backend/codigo, mas ocultos na navegacao por enquanto:

```text
Historico
Auditoria
Inteligencia Operacional
```

## Stack

```text
Frontend: React + TypeScript + Vite
Backend: Python + FastAPI
Banco: PostgreSQL
Planilhas: pandas + openpyxl
Ambiente: Docker Compose
```

## Estrutura

```text
backend/
  app/
    api/routes/          Rotas FastAPI
    importers/           Leitura e normalizacao de planilhas
    repositories/        Acesso ao banco
    schemas/             Contratos de entrada e saida
    services/            Regras e fluxo de importacao
    main.py              App FastAPI
  migrations/            Migrations SQL versionadas do PostgreSQL
database/
  init.sql               Estrutura inicial do banco
docs/                    Documentacao funcional e tecnica
frontend/
  src/
    components/          Componentes reutilizaveis
    hooks/               Estado e chamadas por fluxo
    pages/               Telas principais
    services/            Cliente de API
    types/               Tipos compartilhados
samples/                 Arquivos de exemplo
```

## Como Rodar

Com o Docker Desktop aberto:

```powershell
cd C:\Projetos\analise-horas-tfs
docker compose up --build
```

Para rodar em segundo plano:

```powershell
docker compose up --build -d
```

Frontend:

```powershell
cd C:\Projetos\analise-horas-tfs\frontend
npm.cmd install
npm.cmd run dev
```

URLs locais:

```text
Frontend: http://localhost:5173
API:      http://localhost:8000/api/health
Swagger:  http://localhost:8000/docs
```

## Validacao

Validacao local completa:

```powershell
cd C:\Projetos\alfred
powershell -ExecutionPolicy Bypass -File .\scripts\validate-local.ps1
```

Esse comando verifica os imports principais do backend, roda os testes automatizados e compila o frontend.

Rodar testes do backend pelo container:

```powershell
docker compose run --rm -T -v "C:\Projetos\analise-horas-tfs\backend\tests:/app/tests" backend python -m unittest discover -s tests
```

Compilar frontend:

```powershell
cd C:\Projetos\analise-horas-tfs\frontend
npm.cmd run build
```

Checar servicos locais:

```powershell
curl.exe -s http://127.0.0.1:8000/api/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173 | Select-Object -ExpandProperty StatusCode
```

## Manutencao

Ao iniciar, a API remove sessoes temporarias de importacao antigas que ainda nao foram confirmadas. Por padrao, a retencao e de 7 dias.

Para ajustar o prazo, configure:

```text
IMPORT_SESSION_RETENTION_DAYS=7
```

## SQL Server

A importacao por planilha continua ativa. Como segunda entrada, a tela de importacao tambem permite consultar o SQL Server e enviar o resultado para o mesmo fluxo de pre-validacao, classificacao e confirmacao.

Configure a conexao somente por variaveis de ambiente:

```text
SQLSERVER_DRIVER=ODBC Driver 18 for SQL Server
SQLSERVER_HOST=srvbanco009
SQLSERVER_PORT=1463
SQLSERVER_DATABASE=Tfs_Fabrica
SQLSERVER_AUTH=sql
SQLSERVER_USER=usuario
SQLSERVER_PASSWORD=senha
SQLSERVER_ENCRYPT=false
SQLSERVER_TRUST_CERT=true
SQLSERVER_CONNECTION_TIMEOUT_SECONDS=10
SQLSERVER_REQUEST_TIMEOUT=60000
```

A query deve retornar, diretamente ou por aliases, as mesmas colunas obrigatorias da importacao por planilha: `IdLancamento`, `DataHoraCadastro`, `Task`, `LoginUsuario`, `Duracao`, `IdTask`, `TituloTask`, `IdPBI`, `TituloPBI`, `IdFeat`, `TituloFeat`, `IdEpic`, `TituloEpic`.

A tela aceita um ou mais IDs e o tipo `Automatico`, `Epic` ou `Feature`. No modo automatico, o backend procura primeiro em `TitEpic.ID`, depois em `TitFeat.ID`; se o ID existir nos dois niveis, o usuario deve escolher manualmente o tipo.

Como o backend roda em Docker, a estrategia recomendada e `SQLSERVER_AUTH=sql` com usuario SQL Server somente leitura. Esse usuario precisa apenas de `CONNECT` no banco `Tfs_Fabrica` e `SELECT` nos objetos usados pela consulta: `advise.RegistroHorario`, `WorkItemLONgTexts` e `LinksAre`.

Para teste local fora do Docker, tambem e possivel usar Windows Authentication com o usuario logado no Windows:

```text
SQLSERVER_AUTH=windows
SQLSERVER_USER=
SQLSERVER_PASSWORD=
```

Windows Authentication no container nao e garantida por padrao. Para viabilizar isso em Docker seria necessario configurar autenticacao integrada no ambiente, normalmente com dominio/Kerberos, SPN, keytab, driver ODBC compativel e variaveis de runtime especificas. Por simplicidade operacional, mantenha SQL Authentication com senha fora do codigo quando o backend rodar em container.

Endpoints:

```text
GET/POST /api/imports/sqlserver/test-connection
POST     /api/imports/sqlserver/preview
```

## Fluxo De Importacao

```text
Upload
-> leitura do Excel/CSV
-> selecao automatica da aba valida quando o Excel tiver varias abas
-> criacao de sessao temporaria
-> gravacao em staging_rows
-> validacao
-> classificacao automatica
-> identificacao de colaboradores sem perfil ativo
-> cadastro rapido opcional de colaboradores e cargos
-> revisao de bloqueios, alertas, duplicidades e categorias
-> confirmacao do usuario
-> persistencia final
-> dashboards, relatorios e exportacoes
```

O fluxo novo usa staging e evita gravar dados direto nas tabelas finais antes da confirmacao do usuario.

Endpoints principais do fluxo novo:

```text
POST   /api/imports/sessions
POST   /api/imports/sessions/{session_id}/reprocess
POST   /api/imports/sessions/{session_id}/complete
DELETE /api/imports/sessions/{session_id}
```

Endpoints antigos mantidos por compatibilidade:

```text
POST /api/imports/validate
POST /api/imports/complete
```

### Cadastro rapido de colaboradores na importacao

Na Fase 4 - Classificacao, quando a planilha contem colaboradores sem perfil ativo em `perfis_colaborador`, o frontend exibe o assistente "Novos colaboradores encontrados".

O usuario pode associar cada colaborador a um cargo existente antes de continuar. O cadastro usa a API de configuracoes de colaboradores e grava o vinculo em `perfis_colaborador`. Quando o cargo e definido, o sistema tambem aplica esse cargo como subcategoria sugerida na revisao atual para atividades que ainda estavam sem subcategoria.

Se o usuario preferir, pode ignorar temporariamente o cadastro e seguir com a revisao manual das atividades.

## Regras Principais

- Hierarquia TFS: `Epic > Feature > PBI > Task`.
- Campos obrigatorios na importacao:
  `IdLancamento`, `DataHoraCadastro`, `Task`, `LoginUsuario`, `Duracao`, `IdTask`, `TituloTask`, `IdPBI`, `TituloPBI`, `IdFeat`, `TituloFeat`, `IdEpic`, `TituloEpic`.
- Em arquivos Excel com varias abas, o sistema usa automaticamente a primeira aba que contem todas as colunas obrigatorias.
- Duplicidade e detectada somente por `IdLancamento`.
- `IdLancamento` duplicado bloqueia a conclusao ate o usuario escolher uma linha para manter.
- `Duracao` deve vir no formato `HH:MM:SS`.
- `Duracao` igual a `00:00:00` gera alerta, mas nao bloqueia.
- A classificacao automatica por titulo captura somente a categoria no primeiro colchete: `[Categoria] - Descricao`.
- Colchetes adicionais no titulo sao ignorados pela classificacao automatica.
- Quando o titulo nao segue o padrao, o classificador usa palavras-chave no titulo completo.
- Lancamentos com o mesmo `IdTask` podem ser revisados como uma unica atividade.
- Overrides manuais de classificacao sempre partem da escolha do usuario.
- Colaboradores sem perfil ativo geram necessidade de revisao e podem ser cadastrados diretamente na Fase 4.
- Horas extras e banco de horas nao fazem parte da analise.

## Classificacao

Categorias oficiais:

```text
Acompanhamento
Definicao
Desenvolvimento
Homologacao
Impedimento
Retrabalho
```

Cargos/perfis operacionais oficiais:

```text
Analista
Desenvolvedor Back-end
Desenvolvedor Front-end
QA
Banco de Dados
Infraestrutura
DataOps
```

O classificador grava origem, score de confianca, nivel de confianca e versao do classificador. As configuracoes podem ser mantidas pela tela de configuracoes.

Colaboradores sem cargo/perfil operacional continuam permitidos na importacao, mas entram no fluxo de revisao. O assistente de cadastro rapido permite criar o vinculo sem sair da importacao.

## Relatorios

A tela de relatorios lista projetos importados. O titulo do projeto e derivado do nome da planilha importada, por exemplo:

```text
175613 - Migracao de boletos
```

Ao abrir um projeto, ficam disponiveis:

```text
Executivo: resumo inteligente, destaques do projeto e rankings executivos
Graficos: evolucao diaria, distribuicao por categoria e analises especificas por colaborador/categoria
Tasks: detalhe paginado de tasks por colaborador
```

Exportacoes disponiveis:

```text
Excel Operacional
CSV/XLSX tecnicos da API
```

## Indicadores Gerais

O modulo `Indicadores Gerais` consulta o SQL Server/TFS sob demanda por periodo, sem importar planilhas. O fluxo inicial preserva uma unidade por `IdLancamento`, resolve em lote a hierarquia Task -> PBI/Bug -> Feature -> Epic, le as TAGs 1/2/3 exclusivamente da Feature e identifica Bugs pelo tipo real do pai da Task.

O frontend inicia a consulta de forma assincrona, sem manter uma requisicao HTTP aberta durante todo o processamento:

```text
POST /api/general-indicators/consultations?startDate=2026-01-01&endDate=2026-03-31
GET /api/general-indicators/consultations/{consultaId}?page=1&pageSize=100
```

O segundo endpoint informa a etapa, percentual, contagens e tempo decorrido enquanto a consulta estiver em andamento. Depois da validacao, retorna no maximo 500 lancamentos por pagina. O endpoint sincronico `/consultation` permanece apenas para compatibilidade tecnica e tambem aplica paginacao.

Cada execucao e persistida em `general_indicator_consultations`; os lancamentos tecnicos ficam em
`general_indicator_launches` e as inconsistencias em `general_indicator_inconsistencies`. O retorno
informa `canFinalize=false` enquanto existir qualquer inconsistencia impeditiva. Problemas de TAG
sao agrupados por Feature, enquanto duracao, data, hierarquia e duplicidade permanecem rastreaveis
por `IdLancamento`.

Depois da correcao no TFS, as pendencias impeditivas podem ser atualizadas sem repetir a consulta inteira:

```text
POST /api/general-indicators/consultations/{consultaId}/pending-refresh
```

Somente as Features, Tasks, pais e lancamentos afetados sao reconsultados. Os demais lancamentos tecnicos sao preservados. A consulta completa continua disponivel como acao secundaria e exige confirmacao explicita:

```text
POST /api/general-indicators/consultations/{consultaId}/full-refresh?confirm=true
```

As tentativas de atualizacao ficam registradas em `general_indicator_updates`. Inconsistencias antigas sao mantidas como historico inativo, e apenas a versao ativa participa da proxima atualizacao. Uma execucao finalizada ou ja em atualizacao nao pode ser sobrescrita. Nenhuma dessas acoes finaliza a consulta nem calcula KPIs automaticamente.

Quando a consulta estiver `PRONTA_PARA_FINALIZAR`, o resultado oficial e gerado explicitamente por:

```text
POST /api/general-indicators/consultations/{consultaId}/finalize
```

A finalizacao usa somente os lancamentos validados e persistidos, sem nova consulta ao TFS. O resultado oficial, a data de finalizacao, os KPIs, a composicao, a distribuicao mensal e a auditoria sao persistidos na propria consulta. Enquanto houver pendencias impeditivas ou a consulta estiver vazia, a finalizacao e recusada.

A auditoria final tambem e paginada:

```text
GET /api/general-indicators/consultations/{consultaId}/audit?page=1&pageSize=100
```

As consultas oficiais ao SQL Server nao usam `NOLOCK`. Cada execucao registra no resumo a quantidade estimada de consultas em lote e o tempo gasto nas etapas de lancamentos, hierarquia e Features, permitindo comparar cargas mensais e anuais.

O modulo reutiliza as mesmas variaveis `SQLSERVER_*` da importacao direta. O usuario configurado deve ter acesso somente leitura tambem a `tbl_WorkItemCoreLatest`, `tbl_PropertyValue`, `tbl_PropertyDefinition` e `tbl_TagDefinition`, alem dos objetos ja usados pela consulta de lancamentos.

### Migrations do banco

As tabelas do modulo sao mantidas por migrations SQL versionadas em `backend/migrations`. Na inicializacao, o backend:

1. cria a tabela de controle `schema_migrations`, quando necessario;
2. adquire um lock transacional para impedir execucoes simultaneas;
3. valida o checksum das migrations ja aplicadas;
4. executa somente as versoes pendentes;
5. inicia os demais servicos apenas depois da conclusao.

A migration inicial do modulo e `0001_general_indicators.sql`. Uma migration aplicada nunca deve ser editada; alteracoes futuras devem usar um novo arquivo com a proxima versao. Para executar manualmente:

```powershell
cd backend
.\.venv\Scripts\python.exe -c "from app.services.migration_service import run_database_migrations; print(run_database_migrations())"
```

## Documentos

- `docs/01-especificacao-funcional.md`
- `docs/02-tabela-regras.md`
- `docs/03-modelo-dados.md`
- `docs/04-fluxo-telas.md`
- `docs/05-mvp.md`
- `docs/06-backlog-tecnico.md`
- `docs/07-arquitetura-tecnica.md`
- `docs/08-fase-2-importacao-staging.md`
- `docs/09-documentacao-tecnica-completa.md`
- `docs/10-estrutura-banco.sql`
- `docs/11-diagramas-endpoints-fluxos.md`

## Docker

Comandos uteis:

```powershell
docker compose ps
docker compose logs backend --tail=100
docker compose logs db --tail=100
docker compose down
docker compose down -v
```

`docker compose down -v` remove o volume local do PostgreSQL.
