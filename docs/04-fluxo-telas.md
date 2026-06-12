# Fluxo De Telas v1

## 1. Dashboard

Primeira tela do sistema.

Deve mostrar:

```text
Total de horas importadas
Ultima importacao realizada
Status da ultima importacao
Quantidade de registros validos
Quantidade de alertas
Quantidade de erros bloqueantes
Top categorias por horas
Top Epics por horas
Linha do tempo de horas
```

## 2. Importacao

Tela para carregar Excel/CSV.

```text
Selecionar arquivo
Mostrar nome do arquivo
Mostrar tipo do arquivo
Botao Validar arquivo
Botao Cancelar
```

## 3. Resultado Da Validacao

Mostra:

```text
Registros validos
Registros com alerta
Registros com erro bloqueante
Duplicidades encontradas
Titulos fora do padrao
Classificacoes pendentes
```

## 4. Erros De Importacao

Colunas:

```text
Linha
Campo
Valor encontrado
Tipo do erro
Severidade
Mensagem
Acao necessaria
Status
```

## 5. Resolver Duplicidades

Para cada grupo duplicado, mostrar:

```text
IdLancamento
Linha original
DataHoraCadastro
LoginUsuario
Duracao
Epic
Feature
PBI
Task
TituloTask
```

O usuario escolhe qual registro manter.

## 6. Revisar Categorias

Colunas:

```text
TituloTask
Categoria sugerida
Subcategoria sugerida
Origem da sugestao
Confianca
Categoria final
Subcategoria final
Status
```

Acoes:

```text
Aceitar sugestao
Alterar categoria
Alterar subcategoria
Marcar como Nao classificado
```

## 7. Conclusao Da Importacao

Resumo final:

```text
Arquivo importado
Total de registros lidos
Registros validos
Registros com alerta
Duplicidades resolvidas
Categorias automaticas
Categorias sugeridas aceitas
Categorias alteradas manualmente
Registros nao classificados
```

## 8. Relatorios

Relatorios:

```text
Horas por colaborador
Horas por Epic
Horas por Feature
Horas por PBI
Horas por Task
Horas por categoria
Horas por subcategoria
Ranking de consumo
Titulos fora do padrao
Classificacoes alteradas
```

Filtros:

```text
Periodo
Colaborador
Epic
Feature
PBI
Task
Categoria
Subcategoria
Importacao
```

## 9. Analise IA

Fase futura. Tela para perguntas livres e resumos executivos.

## 10. Historico De Importacoes

Colunas:

```text
Data
Arquivo
Usuario
Status
Total de registros
Registros validos
Alertas
Erros
Duplicidades
```

## 11. Configuracoes

Configuracoes:

```text
Categorias oficiais
Subcategorias oficiais
Palavras-chave por categoria
Regras de alerta
Parametros futuros de IA
```

