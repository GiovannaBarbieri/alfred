# Alfred — Gerenciador de horas

Sistema interno da ADVISE para importar, validar, classificar e analisar horas registradas no TFS 2015.

O Alfred possui dois fluxos principais:

1. **Projetos**: importa Excel/CSV ou dados do SQL Server, valida, classifica e apresenta relatórios operacionais de projetos.
2. **Indicadores Gerais**: consulta lançamentos diretamente no SQL Server/TFS, valida hierarquia e TAGs, salva um snapshot oficial e permite consultar relatórios históricos.

O produto não é controle de ponto, banco de horas, sistema trabalhista ou sistema de RH.

Documentação revisada em **28/07/2026**. Consulte o [índice da documentação](docs/README.md).

## Estado atual

Menu visível:

```text
Relatórios
├── Projetos
├── Indicadores Gerais
└── Meus Relatórios

Configurações
├── Configurações gerais
├── Distribuição das categorias
└── Módulos
```

Telas de Dashboard, Histórico, Auditoria e Inteligência Operacional continuam no código, mas não fazem parte da navegação principal atual.

## Tecnologias

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18, TypeScript 5, Vite 6, Recharts, Lucide React |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Banco da aplicação | PostgreSQL 16 |
| Fonte corporativa | SQL Server/TFS 2015 via `pyodbc` |
| Importação | pandas e openpyxl |
| Infraestrutura local | Docker Compose para PostgreSQL e, opcionalmente, backend |
| Testes | pytest e Node Test Runner |

## Estrutura

```text
alfred/
├── backend/
│   ├── app/
│   │   ├── api/routes/       Endpoints FastAPI
│   │   ├── core/             Configuração
│   │   ├── importers/        Leitura de Excel/CSV
│   │   ├── repositories/     SQL e persistência
│   │   ├── schemas/          Contratos Pydantic
│   │   └── services/         Regras e casos de uso
│   ├── migrations/           Migrations PostgreSQL versionadas
│   └── tests/                Testes automatizados
├── database/init.sql         Bootstrap do domínio Projetos
├── docs/                     Documentação funcional e técnica
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── tests/
├── scripts/                  Validação, backup e restore
├── docker-compose.yml
├── iniciar-backend-windows.cmd
└── iniciar-frontend-windows.cmd
```

## Execução local recomendada

No ambiente corporativo atual, o PostgreSQL roda no Docker e o backend roda diretamente no Windows para reutilizar a autenticação integrada do usuário no SQL Server.

### Pré-requisitos

- Docker Desktop;
- Node.js e npm;
- Python/venv já preparado em `backend/.venv`;
- Microsoft ODBC Driver 18 for SQL Server;
- acesso de rede ao SQL Server;
- arquivo `.env` configurado.

### 1. PostgreSQL

```powershell
cd C:\Projetos\alfred
docker compose up -d db
docker compose ps
```

### 2. Backend no Windows

```powershell
cd C:\Projetos\alfred
.\iniciar-backend-windows.cmd
```

Equivalente:

```powershell
cd C:\Projetos\alfred\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 3. Frontend

```powershell
cd C:\Projetos\alfred
.\iniciar-frontend-windows.cmd
```

Equivalente:

```powershell
cd C:\Projetos\alfred\frontend
npm.cmd install
npm.cmd run dev
```

Também é possível executar somente o frontend em contêiner:

```powershell
docker compose up -d --build frontend
```

Nesse modo, o Nginx entrega os arquivos estáticos e encaminha `/api` para o
serviço `backend` da rede do Docker.

### URLs

| Serviço | URL |
| --- | --- |
| Alfred | http://127.0.0.1:5173 |
| API | http://127.0.0.1:8000 |
| Health | http://127.0.0.1:8000/api/health |
| Swagger | http://127.0.0.1:8000/docs |
| OpenAPI | http://127.0.0.1:8000/openapi.json |

## Execução totalmente em Docker

```powershell
cd C:\Projetos\alfred
docker compose up --build -d
docker compose ps
```

O Compose inicia PostgreSQL, backend e frontend. O Alfred fica disponível em
`http://127.0.0.1:5173`, e a API também pode ser validada pelo frontend em
`http://127.0.0.1:5173/api/health`.

Essa opção é indicada quando o SQL Server aceitar autenticação SQL. A autenticação integrada do Windows não é transportada automaticamente para o contêiner Linux; no servidor, utilize uma conta técnica somente leitura ou uma configuração formal de Kerberos.

## Configuração

Copie `.env.example` para `.env` e ajuste os valores. Não versione senhas.

Variáveis principais:

```text
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
DATABASE_URL
DOCKER_DATABASE_URL
BACKEND_CORS_ORIGINS

SQLSERVER_DRIVER
SQLSERVER_HOST
SQLSERVER_PORT
SQLSERVER_DATABASE
SQLSERVER_AUTH
SQLSERVER_USER
SQLSERVER_PASSWORD
SQLSERVER_ENCRYPT
SQLSERVER_TRUST_CERT
SQLSERVER_CONNECTION_TIMEOUT_SECONDS
SQLSERVER_REQUEST_TIMEOUT

IMPORT_SESSION_RETENTION_DAYS
GENERAL_INDICATOR_PROCESSING_TIMEOUT_SECONDS
BACKEND_BUILD_IDENTIFIER
```

### Autenticação SQL Server

Para backend no Windows:

```text
SQLSERVER_AUTH=windows
SQLSERVER_USER=
SQLSERVER_PASSWORD=
```

Para backend no Docker:

```text
SQLSERVER_AUTH=sql
SQLSERVER_USER=usuario_somente_leitura
SQLSERVER_PASSWORD=segredo
```

O usuário técnico precisa de `CONNECT` no banco e `SELECT` somente nos objetos consultados. Consulte [Operação e infraestrutura](docs/12-operacao-infraestrutura.md).

## Fluxo de Projetos

```text
Excel/CSV ou SQL Server
→ sessão temporária
→ staging
→ validação
→ classificação
→ revisão
→ confirmação
→ persistência
→ relatórios e exportações
```

Regras centrais:

- `IdLancamento` identifica a duplicidade;
- duração válida usa `HH:MM:SS`;
- título no padrão `[Categoria] descrição` tem precedência na classificação;
- ausência de padrão exige revisão, mesmo quando há sugestão por palavra-chave;
- colaboradores sem perfil podem ser cadastrados durante a revisão;
- dados só entram nas tabelas finais após confirmação.

## Fluxo de Indicadores Gerais

```text
Selecionar período
→ iniciar consulta assíncrona
→ consultar lançamentos e hierarquia no TFS
→ validar TAGs, hierarquia, duração, data e duplicidade
→ atualizar pendências seletivamente, se necessário
→ informar nome
→ salvar relatório
→ abrir automaticamente em Meus Relatórios
```

Regras centrais:

- cada `IdLancamento` é uma unidade independente;
- a Task deve apontar para um PBI ou Bug;
- o pai superior deve ser uma Feature;
- as TAGs `1-`, `2-` e `3-` são obrigatórias na Feature;
- Bug é identificado pelo tipo real do pai da Task e sempre classificado como `Bug`;
- PBI é classificado pela TAG `2-` da Feature;
- lançamentos cuja cadeia hierárquica resolvida contenha Work Item com `State = Removed` são desconsiderados automaticamente dos Indicadores Gerais;
- colaboradores com `participa_indicadores_gerais=false` permanecem auditáveis, mas não entram nos cálculos;
- `Atualização do sistema` é redistribuída mensalmente pela fórmula proporcional ponderada;
- o padrão neutro usa peso 1 em Novo projeto, Melhoria, Erro TI, Bug e Manutenção, produzindo distribuição proporcional às horas originais;
- pesos configuráveis entre 2 e 5 continuam disponíveis para aumentar a prioridade de uma categoria;
- meta de Novos projetos + melhorias: 40%;
- limite de Erro TI + Bug: 10%;
- relatório salvo é um snapshot imutável e não consulta novamente o TFS ao ser aberto;
- a análise por período usa apenas o snapshot e seus pesos históricos.

Detalhes completos: [Regras de negócio](docs/02-tabela-regras.md) e [Indicadores Gerais](docs/01-especificacao-funcional.md#indicadores-gerais).

## Persistência e migrations

O PostgreSQL é iniciado por `database/init.sql`. Na inicialização da API:

1. `run_database_migrations()` cria e controla `schema_migrations`;
2. cada arquivo pendente de `backend/migrations` é aplicado em ordem;
3. checksums impedem alteração silenciosa de migrations já executadas;
4. `ensure_runtime_schema()` mantém compatibilidade do domínio legado de Projetos;
5. sessões temporárias expiradas são removidas.

Nunca edite uma migration aplicada. Crie a próxima versão sequencial.

Referência: [Modelo de dados](docs/03-modelo-dados.md).

## Testes e validação

Validação completa:

```powershell
cd C:\Projetos\alfred
powershell -ExecutionPolicy Bypass -File .\scripts\validate-local.ps1
```

Backend:

```powershell
cd C:\Projetos\alfred\backend
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
```

O `requirements.txt` contém somente as dependências de execução usadas pela
imagem Docker. Ferramentas de desenvolvimento e testes ficam em
`requirements-dev.txt`.

Frontend:

```powershell
cd C:\Projetos\alfred\frontend
npm.cmd run build
npm.cmd run test:review-criteria
npm.cmd run test:general-indicators
npm.cmd run test:distribution-weights
npm.cmd run test:navigation
npm.cmd run test:report-history
npm.cmd run test:period-analysis
```

## Backup e restore

```powershell
.\scripts\backup-database.ps1
.\scripts\restore-database.ps1 -BackupFile <arquivo>
```

Confira os parâmetros dos scripts antes de executar restore.

## Segurança e limitações atuais

- Credenciais ficam exclusivamente em variáveis de ambiente.
- Consultas oficiais ao SQL Server não usam `NOLOCK`, evitando leitura suja.
- O backend aplica CORS configurável e compressão GZip.
- Exclusão de relatório é permanente e transacional.
- O sistema ainda não possui autenticação/autorização própria completa; o usuário informado em operações auditáveis pode vir do cliente.
- Logs não devem registrar senhas ou connection strings completas.

## Documentação

- [Índice](docs/README.md)
- [Especificação funcional](docs/01-especificacao-funcional.md)
- [Regras de negócio](docs/02-tabela-regras.md)
- [Modelo de dados](docs/03-modelo-dados.md)
- [Fluxo de telas](docs/04-fluxo-telas.md)
- [Escopo e estado do produto](docs/05-mvp.md)
- [Backlog técnico](docs/06-backlog-tecnico.md)
- [Arquitetura](docs/07-arquitetura-tecnica.md)
- [Importação e staging](docs/08-fase-2-importacao-staging.md)
- [Referência técnica](docs/09-documentacao-tecnica-completa.md)
- [Manifesto do banco](docs/10-estrutura-banco.sql)
- [Endpoints e fluxos](docs/11-diagramas-endpoints-fluxos.md)
- [Operação e infraestrutura](docs/12-operacao-infraestrutura.md)
