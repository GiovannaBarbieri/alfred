# Backlog Tecnico v1

Observacao: este backlog representa a base inicial do projeto. Parte dos itens ja foi implementada e refinada; a navegacao atual mantem ativas as telas Dashboard, Importacao, Validacao, Relatorios e Configuracoes.

## Epico 1: Estrutura Do Projeto

### Feature 1.1: Criar base do sistema

```text
Criar repositorio do projeto
Configurar backend FastAPI
Configurar frontend React + TypeScript
Configurar PostgreSQL
Configurar Docker Compose
Criar estrutura inicial de pastas
Criar arquivo de variaveis de ambiente
Configurar conexao backend com banco
```

### Feature 1.2: Configurar banco

```text
Criar migrations iniciais
Criar tabelas do MVP
Inserir categorias oficiais atuais
Inserir cargos/perfis operacionais oficiais
```

## Epico 2: Importacao De Arquivos

```text
Criar endpoint de upload
Validar extensao .xlsx e .csv
Salvar metadados da importacao
Calcular hash do arquivo
Ler .xlsx com pandas/openpyxl
Ler .csv com pandas
Validar cabecalhos
Normalizar nomes de colunas
```

## Epico 3: Validacao Dos Dados

```text
Validar campos obrigatorios
Validar DataHoraCadastro
Validar Duracao HH:MM:SS
Converter Duracao para segundos
Gerar alerta para 00:00:00
Identificar IdLancamento duplicado
Gerar erros por linha e campo
Bloquear importacao em erro critico
```

## Epico 4: Resolucao De Duplicidades

```text
Listar grupos duplicados
Mostrar registros lado a lado
Permitir escolher registro mantido
Marcar registros removidos
Salvar decisao
Registrar auditoria
Liberar importacao apos resolver todas
```

## Epico 5: Classificacao De Categorias

```text
Criar parser para categoria no primeiro colchete do titulo
Validar categoria oficial
Validar subcategoria oficial
Criar dicionario de palavras-chave
Sugerir categoria por titulo
Criar tela de revisao
Registrar alteracoes manuais
```

## Epico 6: Persistencia

```text
Salvar importacao
Salvar lancamentos validos
Salvar alertas
Salvar erros
Salvar classificacoes
Salvar duplicidades resolvidas
Atualizar status da importacao
```

## Epico 7: Relatorios

```text
Horas por colaborador
Horas por Epic
Horas por Feature
Horas por PBI
Horas por Task
Horas por categoria
Horas por subcategoria
Relatorio de alertas
Relatorio de erros
Relatorio de duplicidades
Exportar Excel/CSV
```

## Epico 8: Dashboard

```text
Cards de indicadores principais
Top 10 Epics por horas
Top 10 PBIs por horas
Top 10 colaboradores por horas
Top 10 categorias por horas
Linha do tempo por dia
Linha do tempo por semana
Linha do tempo por mes
Filtro por categoria
Filtro por Epic
Comparacao de categorias na linha do tempo
```

## Epico 9: Historico

```text
Listar importacoes
Abrir detalhes
Mostrar resumo
Mostrar erros e alertas
Exportar base consolidada
Status atual: modulo oculto no frontend
```

## Epico 10: Configuracoes

```text
Listar categorias
Criar categoria como admin
Editar categoria
Inativar categoria
Listar subcategorias
Criar cargo como admin
Editar cargo
Inativar cargo
Listar palavras-chave
Criar palavras-chave
Editar palavras-chave
Inativar palavras-chave
Vincular colaboradores a cargos
```
