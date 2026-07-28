# Fluxo de telas

Versão documental: **28/07/2026**.

## Navegação lateral

```text
Relatórios
├── Projetos
├── Indicadores Gerais
└── Meus Relatórios

Configurações
├── Configurações gerais
└── Pesos de distribuição
```

- apenas um grupo fica expandido;
- a rota atual reabre automaticamente seu grupo;
- o grupo pai não recebe o mesmo destaque do item ativo;
- estado é preservado localmente quando aplicável.

## Projetos

```mermaid
flowchart TD
  A["Relatórios > Projetos"] --> B["Importar dados"]
  B --> C["Upload ou SQL Server"]
  C --> D["Validação"]
  D --> E["Classificação"]
  E --> F["Confirmação"]
  F --> G["Projeto salvo"]
  G --> H["Relatório do projeto"]
  H --> I["Executivo"]
  H --> J["Gráficos"]
  H --> K["Tasks"]
  H --> L["Evolução e comparativos"]
```

### Estados

- vazio;
- enviando/processando;
- bloqueios;
- alertas;
- revisão de duplicidade;
- colaboradores sem perfil;
- pronto para confirmar;
- confirmação em andamento;
- sucesso/abertura do relatório;
- erro recuperável.

## Indicadores Gerais

```mermaid
flowchart TD
  A["Selecionar período"] --> B["Consultar"]
  B --> C["Acompanhar progresso"]
  C --> D{"Pendências impeditivas?"}
  D -- "Sim" --> E["Corrigir no TFS"]
  E --> F["Atualizar pendências"]
  F --> D
  D -- "Não" --> G["Informar nome"]
  G --> H["Salvar relatório"]
  H --> I["Meus Relatórios"]
  I --> J["Abrir relatório recém-salvo"]
```

### Consulta

- filtros em linha: ano, data inicial, data final e botão;
- atalhos apenas preenchem;
- durante processamento, botão é bloqueado e mostra carregamento;
- progresso indica etapa, percentual e mensagem;
- a consulta só ocorre após clique.

### Validação

Com pendências:

- resumo de impacto;
- inconsistências agrupadas por causa;
- Task, PBI/Bug, Feature esperada, tipo encontrado, lançamentos e horas afetadas;
- instrução de correção;
- ação principal **Atualizar pendências**.

Sem pendências:

- título **Validação concluída**;
- resumo de lançamentos e horas;
- campo de nome;
- botão **Salvar relatório**.

Não há dashboard final nessa tela.

## Meus Relatórios

### Listagem

```mermaid
flowchart TD
  A["Abrir Meus Relatórios"] --> B["Carregar página"]
  B --> C["Filtrar por nome/ano"]
  C --> D["Aplicar"]
  D --> E["Abrir relatório"]
  D --> F["Excluir"]
```

Comportamentos:

- atualização manual no topo;
- alerta de sucesso fecha em 4 segundos e mantém fechamento manual;
- erro permanece visível;
- paginação aparece apenas quando o total ultrapassa o tamanho da página;
- estado vazio distingue “nenhum relatório” de “nenhum resultado para filtros”.

### Relatório salvo

```text
← Nome do relatório

Visão Geral | Análise por período
```

**Visão Geral**:

- resumo;
- KPIs;
- evolução;
- gráficos de categoria/composição;
- composição das horas;
- distribuição de Atualização do sistema;
- comparativo trimestral quando aplicável.

Auditoria de lançamentos permanece persistida, mas não é exibida como bloco principal.

**Análise por período**:

- período oficial;
- data inicial/final limitadas;
- atalhos;
- botão Analisar;
- KPIs e gráficos do recorte;
- estados inicial, carregando, vazio e erro.

## Configurações gerais

Áreas funcionais:

- categorias;
- subcategorias;
- palavras-chave;
- regras;
- colaboradores;
- participação nos Indicadores Gerais.

O bootstrap agrega leituras para reduzir carregamento inicial.

## Pesos de distribuição

- tabela com categoria, peso, influência e participação;
- salvar;
- restaurar padrão;
- explicação e exemplo simples do cálculo;
- alterações afetam somente novos cálculos.

## Responsividade

- filtros e ações quebram para múltiplas linhas;
- gráficos passam para uma coluna;
- botões principais ocupam 100% apenas quando necessário no mobile;
- menus e controles preservam navegação por teclado e atributos ARIA.

## Telas preservadas fora da navegação

- Dashboard;
- Histórico;
- Auditoria;
- Inteligência Operacional.

Essas páginas não devem ser removidas sem auditoria, mas também não devem ser tratadas como rotas ativas do menu atual.
