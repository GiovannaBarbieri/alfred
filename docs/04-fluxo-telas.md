# Fluxo De Telas Atual

## 1. Dashboard

Tela inicial do sistema.

Mostra uma visao executiva dos projetos analisados, com:

```text
Total de horas importadas
Quantidade de registros
Ultimos projetos analisados
Acesso rapido ao relatorio do projeto
```

Itens operacionais de alerta foram reduzidos visualmente para manter foco na analise de horas.

## 2. Importacao

Tela para carregar Excel/CSV exportado do TFS.

Fluxo:

```text
Selecionar arquivo
Validar arquivo
Criar sessao temporaria
Revisar dados antes da conclusao
Confirmar importacao
```

## 3. Validacao

Etapa exibida apos o upload.

Mostra:

```text
Saude da importacao
Registros validos
Bloqueios impeditivos
Alertas relevantes
Duplicidades por IdLancamento
Classificacoes sugeridas
Revisao por Task
```

O usuario pode revisar classificacoes e resolver duplicidades antes de consolidar a importacao.

## 4. Relatorios

Tela principal de analise de projetos importados.

### 4.1 Listagem de projetos

Mostra os projetos importados em formato de listagem executiva:

```text
Nome do projeto
Arquivo importado
Status da analise
Ultima atualizacao
Horas
Registros
Colaboradores
Botao Visualizar Analise
```

### 4.2 Aba Executivo

Mostra a leitura gerencial do projeto:

```text
KPIs principais
Resumo Inteligente em texto
Destaques do Projeto
Resumo Executivo
Top colaboradores
Top categorias
Top tasks
Alertas executivos quando existirem
```

Os blocos analiticos ficam recolhidos por padrao.

### 4.3 Aba Graficos

Focada em tendencias visuais.

Mostra:

```text
Evolucao diaria do projeto
Distribuicao das horas por categoria
Analises especificas por colaborador
Analises especificas por categoria
```

O grafico de Evolucao Acumulada de Horas foi removido para reduzir redundancia.

### 4.4 Aba Tasks

Mostra tarefas por colaborador.

Recursos:

```text
Selecao de colaborador
Resumo do colaborador
Tabela paginada de 20 em 20 registros
Barra visual de duracao
Categoria principal da task
```

## 5. Configuracoes

Tela para manter cadastros usados na classificacao.

Abas ativas:

```text
Categorias
Cargos
Colaboradores
```

### Categorias

Permite criar, editar, ativar/inativar e excluir categorias.

Tambem exibe descricao da categoria por tooltip quando cadastrada.

### Cargos

Permite manter cargos/perfis operacionais e seus grupos.

Cargos oficiais:

```text
Analista
Desenvolvedor Back-end
Desenvolvedor Front-end
QA
Banco de Dados
Infraestrutura
DataOps
```

### Colaboradores

Permite vincular colaborador a cargo.

O grupo e derivado automaticamente do cargo.

## 6. Telas Ocultas No Frontend

As telas abaixo continuam existindo no codigo/backend, mas nao aparecem na navegacao principal neste momento:

```text
Historico
Auditoria
Inteligencia Operacional
```

Motivo:

```text
Historico: informacoes principais ja aparecem no contexto do projeto/importacao.
Auditoria: uso mais tecnico, sem valor imediato para analise gerencial.
Inteligencia Operacional: insights salvos ainda existem no backend, mas a tela foi ocultada ate voltar a ser util ao fluxo principal.
```
