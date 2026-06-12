# Analise de Horas TFS

Sistema interno para importar, validar, classificar e analisar horas apontadas em projetos a partir de arquivos Excel/CSV extraidos do TFS 2015.

O foco e analise operacional das horas lancadas. O sistema nao e controle de ponto, RH, banco de horas, regra trabalhista ou gestao formal de jornada.

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

## Fluxo De Importacao

```text
Upload
-> leitura do Excel/CSV
-> criacao de sessao temporaria
-> gravacao em staging_rows
-> validacao
-> classificacao automatica
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

## Regras Principais

- Hierarquia TFS: `Epic > Feature > PBI > Task`.
- Campos obrigatorios na importacao:
  `IdLancamento`, `DataHoraCadastro`, `Task`, `LoginUsuario`, `Duracao`, `IdTask`, `TituloTask`, `IdPBI`, `TituloPBI`, `IdFeat`, `TituloFeat`, `IdEpic`, `TituloEpic`.
- Duplicidade e detectada somente por `IdLancamento`.
- `IdLancamento` duplicado bloqueia a conclusao ate o usuario escolher uma linha para manter.
- `Duracao` deve vir no formato `HH:MM:SS`.
- `Duracao` igual a `00:00:00` gera alerta, mas nao bloqueia.
- Categoria e subcategoria podem vir do padrao `[Categoria][Subcategoria] - Descricao`.
- Quando o titulo nao segue o padrao, o classificador usa palavras-chave no titulo completo.
- Lancamentos com o mesmo `IdTask` podem ser revisados como uma unica atividade.
- Overrides manuais de classificacao sempre partem da escolha do usuario.
- Horas extras e banco de horas nao fazem parte da analise.

## Classificacao

Categorias iniciais:

```text
Desenvolvimento
Reuniao
Alinhamento
Definicao
Homologacao
Testes cruzados
Retrabalho
Analise
Outros
Nao classificado
```

Subcategorias iniciais:

```text
Back
Front
QA
Nao aplicavel
Nao classificado
```

O classificador grava origem, score de confianca, nivel de confianca e versao do classificador. As configuracoes podem ser mantidas pela tela de configuracoes.

## Relatorios

A tela de relatorios lista projetos importados. O titulo do projeto e derivado do nome da planilha importada, por exemplo:

```text
175613 - Migracao de boletos
```

Ao abrir um projeto, ficam disponiveis analises por:

```text
colaborador
Epic
PBI
categoria
subcategoria
```

Tambem existem dashboard, linha do tempo, historico e exportacoes CSV.

## Documentos

- `docs/01-especificacao-funcional.md`
- `docs/02-tabela-regras.md`
- `docs/03-modelo-dados.md`
- `docs/04-fluxo-telas.md`
- `docs/05-mvp.md`
- `docs/06-backlog-tecnico.md`
- `docs/07-arquitetura-tecnica.md`
- `docs/08-fase-2-importacao-staging.md`

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
