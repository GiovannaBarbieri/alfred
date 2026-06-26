# MVP v1

## Objetivo

Observacao: este documento registra o escopo original do MVP. O produto atual ja evoluiu para fluxo com staging, relatorios executivos e configuracoes de categorias/cargos/colaboradores.

Criar uma primeira versao funcional capaz de:

```text
Importar Excel/CSV
Validar campos obrigatorios
Bloquear erros criticos
Resolver duplicidades por IdLancamento
Classificar categorias pelo TituloTask
Salvar a base consolidada
Gerar relatorios basicos
Exibir dashboard com linha do tempo
```

## Entra No MVP

### Importacao

Formatos aceitos:

```text
.xlsx
.csv
```

Funcionalidades:

```text
Selecionar arquivo
Ler cabecalho
Validar colunas obrigatorias
Ler registros
Converter duracao HH:MM:SS para segundos
Salvar arquivo/importacao no historico
Criar sessao temporaria antes da persistencia final
```

### Validacao

Bloqueios:

```text
Coluna obrigatoria ausente
Campo obrigatorio vazio
DataHoraCadastro invalida
Duracao invalida
Duracao negativa
IdLancamento duplicado sem resolucao
Hierarquia incompleta
```

Alertas:

```text
Duracao igual a 00:00:00
TituloTask fora do padrao
Categoria nao identificada
Subcategoria nao identificada
```

### Classificacao

Pelo padrao:

```text
[Categoria] Titulo da atividade
```

Se o titulo estiver fora do padrao:

```text
Sugerir categoria por palavras-chave
Permitir usuario aceitar ou alterar
Permitir marcar como Nao classificado
```

### Relatorios

```text
Horas por colaborador
Horas por Epic
Horas por Feature
Horas por PBI
Horas por Task
Horas por categoria
Horas por subcategoria
Relatorio de erros
Relatorio de alertas
Relatorio de duplicidades
Relatorio de classificacoes pendentes
Resumo executivo do projeto
Graficos de tendencia
Tasks por colaborador
```

### Dashboard

Indicadores:

```text
Total de horas
Total de registros
Total de colaboradores
Total de Epics
Total de Features
Total de PBIs
Total de Tasks
Total por categoria
Top 10 Epics por horas
Top 10 PBIs por horas
Top 10 colaboradores por horas
```

Graficos obrigatorios:

```text
Linha do tempo de horas por dia/semana/mes
Linha do tempo por categoria
Linha do tempo por Epic
Comparativo de categorias no periodo
```

## Fora Do MVP

```text
Login completo
Permissoes avancadas
Integracao direta com banco TFS
Agendamento automatico
Deploy em servidor interno
Horas extras
Banco de horas
Controle de jornada
```
