# Documentação do Alfred

Documentação revisada em **28/07/2026**, baseada no código, migrations e contratos atuais.

## Ordem de leitura

| Documento | Finalidade |
| --- | --- |
| [README principal](../README.md) | Instalação, execução e visão geral |
| [01 — Especificação funcional](01-especificacao-funcional.md) | Módulos, atores e comportamentos |
| [02 — Regras de negócio](02-tabela-regras.md) | Regras normativas e cálculos |
| [03 — Modelo de dados](03-modelo-dados.md) | Tabelas, relações, snapshots e migrations |
| [04 — Fluxo de telas](04-fluxo-telas.md) | Navegação e estados de interface |
| [05 — Escopo do produto](05-mvp.md) | Funcionalidades atuais e limites |
| [06 — Backlog técnico](06-backlog-tecnico.md) | Melhorias pendentes e riscos |
| [07 — Arquitetura técnica](07-arquitetura-tecnica.md) | Camadas, integrações e decisões |
| [08 — Importação e staging](08-fase-2-importacao-staging.md) | Pipeline de Projetos |
| [09 — Referência técnica completa](09-documentacao-tecnica-completa.md) | Guia para desenvolvimento e manutenção |
| [10 — Manifesto do banco](10-estrutura-banco.sql) | Ordem canônica dos scripts SQL |
| [11 — Endpoints e fluxos](11-diagramas-endpoints-fluxos.md) | Referência REST e diagramas |
| [12 — Operação e infraestrutura](12-operacao-infraestrutura.md) | Ambientes, banco, ODBC, backup e diagnóstico |

## Fontes de verdade

Em caso de divergência:

1. contratos e regras executáveis em `backend/app`;
2. migrations em `backend/migrations`;
3. bootstrap em `database/init.sql`;
4. testes em `backend/tests` e `frontend/tests`;
5. esta documentação.

Migrations aplicadas nunca devem ser alteradas para “corrigir” a documentação.
