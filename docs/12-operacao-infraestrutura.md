# Operação e infraestrutura

Revisão: **30/07/2026**.

## Topologia recomendada

### Desenvolvimento corporativo

```text
Frontend Vite (Windows, 5173)
Backend FastAPI (Windows, 8000)
PostgreSQL (Docker, 5432)
SQL Server/TFS (rede corporativa)
```

Motivo: o processo Windows reutiliza autenticação integrada do usuário para o SQL Server.

### Servidor

```text
Reverse proxy/TLS
Frontend React estático em Nginx (contêiner)
Backend FastAPI/Uvicorn (contêiner)
PostgreSQL 16 (contêiner com volume persistente)
SQL Server/TFS via conta técnica somente leitura
```

Para contêiner Linux, prefira autenticação SQL ou configure formalmente Kerberos/SPN/keytab.

## Requisitos

### Backend

- Python compatível com as dependências fixadas;
- ODBC Driver 18 for SQL Server;
- acesso TCP ao SQL Server/porta configurada;
- acesso TCP ao PostgreSQL;
- variáveis de ambiente;
- diretório de migrations disponível.

### Frontend

- Node.js 20 é usado somente na etapa de build da imagem;
- Nginx entrega o build estático em runtime;
- `/api` é encaminhado pelo Nginx ao serviço `backend`;
- a imagem final não precisa de Node.js instalado no servidor.

### PostgreSQL

- PostgreSQL 16 recomendado;
- volume persistente;
- backup;
- usuário com permissão de DDL na inicialização/migrations e DML em runtime.

## Solicitação para infraestrutura

Informações mínimas:

### Aplicação

- nome: Alfred — Gerenciador de horas;
- backend: Python/FastAPI/Uvicorn;
- frontend: React/TypeScript/Vite;
- banco: PostgreSQL 16;
- integração: SQL Server/TFS 2015 via ODBC 18.

### Rede

- entrada HTTPS para usuários;
- frontend → backend;
- backend → PostgreSQL;
- backend → SQL Server na porta configurada;
- DNS/certificado do ambiente.

### Conta SQL Server

Conta exclusivamente de leitura:

- `CONNECT` no banco TFS;
- `SELECT` nos objetos:
  - `advise.RegistroHorario`;
  - `tbl_WorkItemCoreLatest`;
  - `WorkItemLONgTexts`;
  - `LinksAre`;
  - `tbl_PropertyValue`;
  - `tbl_PropertyDefinition`;
  - `tbl_TagDefinition`.

Não solicitar `INSERT`, `UPDATE`, `DELETE`, `ALTER` ou `CONTROL`.

## Inicialização

### Stack completa em Docker

```powershell
docker compose up -d --build
docker compose ps
```

Serviços criados:

| Serviço | Contêiner | Porta padrão | Função |
| --- | --- | ---: | --- |
| `frontend` | `analise-horas-web` | 5173 | React estático + proxy `/api` |
| `backend` | `analise-horas-api` | 8000 | FastAPI |
| `db` | `analise-horas-db` | 5432 | PostgreSQL 16 |

Validação:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173
Invoke-RestMethod http://127.0.0.1:5173/api/health
docker compose ps
```

Para o backend Linux consultar o SQL Server, configure `SQLSERVER_AUTH=sql`
com uma conta técnica somente leitura. `SQLSERVER_AUTH=windows` continua sendo
adequado para o backend executado diretamente no Windows, mas não transfere
automaticamente a identidade da usuária para o contêiner.

### PostgreSQL

```powershell
docker compose up -d db
docker compose ps
```

### Backend Windows

```powershell
.\iniciar-backend-windows.cmd
```

### Frontend Windows

```powershell
.\iniciar-frontend-windows.cmd
```

### Saúde

```powershell
curl.exe -s http://127.0.0.1:8000/api/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:5173
docker compose ps
```

## Diagnóstico

### Porta ocupada

Erro `WinError 10048`:

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen
Get-Process -Id <PID>
```

Não inicie uma segunda instância.

### Driver não encontrado

Erros `IM002` ou “Can't open lib”:

- confirme `SQLSERVER_DRIVER`;
- Windows: abra “Fontes de Dados ODBC” e verifique o nome exato;
- Docker/Linux: instale `msodbcsql18` na imagem;
- não configure Driver 17 se apenas o 18 estiver instalado.

### Login timeout

Erro `HYT00`:

- teste DNS;
- teste porta;
- valide VPN/ZTNA/firewall;
- confirme host e instância/porta;
- compare execução Windows x contêiner;
- teste as credenciais com ferramenta SQL.

```powershell
Test-NetConnection <host> -Port <porta>
```

### SSMS conecta, aplicação não

Possíveis diferenças:

- autenticação Windows x SQL;
- processo em contêiner;
- driver;
- DNS;
- porta;
- criptografia/certificado;
- usuário efetivo.

### Frontend mostra `Failed to fetch`

- confirme backend em 8000;
- consulte `/api/health`;
- confira CORS;
- veja Network/Console;
- evite backend Docker e Windows simultâneos.

### Consulta lenta

Não resolver com `NOLOCK`. Verifique:

- tempo de conexão;
- tempo da consulta de lançamentos;
- quantidade de Tasks/Features únicas;
- batches;
- plano de execução/índices no SQL Server;
- bloqueios reais;
- latência da rede;
- progresso persistido da consulta.

## Backup e restore

Scripts:

```powershell
.\scripts\backup-database.ps1
.\scripts\restore-database.ps1 -BackupFile <arquivo>
```

Boas práticas:

- backup antes de migration em produção;
- cópia fora do servidor;
- criptografia e controle de acesso;
- teste de restauração;
- retenção definida pela infraestrutura.

## Deploy

Checklist:

1. backup;
2. revisar `.env`;
3. validar conectividade;
4. construir backend/frontend;
5. iniciar API (migrations rodam no startup);
6. validar health;
7. validar tela;
8. executar consulta controlada;
9. acompanhar logs;
10. manter rollback da aplicação e restore do banco.

## Segredos

- `.env` não deve ser versionado;
- nunca colocar senha em README, migration, log ou screenshot;
- em servidor, usar secret store;
- rotacionar conta SQL Server/PostgreSQL;
- mascarar connection strings em logs.
