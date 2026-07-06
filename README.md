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

Windows Authentication nao esta habilitada por padrao no container. Para viabilizar isso seria necessario configurar autenticacao integrada no ambiente Docker, normalmente com dominio/Kerberos, SPN, keytab, driver ODBC compativel e variaveis de runtime especificas. Por simplicidade operacional, mantenha SQL Authentication com senha fora do codigo.

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
