# Especificacao Funcional v1.1

## 1. Objetivo

Criar um sistema para automatizar a analise de horas lancadas em projetos, a partir de arquivos Excel/CSV ou, futuramente, de uma conexao com o banco de dados do TFS.

O sistema deve validar lancamentos, bloquear erros criticos, consolidar horas pela hierarquia do TFS, classificar categorias de trabalho e gerar relatorios gerenciais.

O foco nao e controle de ponto, jornada diaria, hora extra ou banco de horas. O foco e entender onde as horas foram consumidas dentro dos projetos.

## 2. Hierarquia Principal

A hierarquia correta do TFS sera:

```text
Epic > Feature > PBI > Task
```

Todos os relatorios devem respeitar essa estrutura.

## 3. Campos Obrigatorios

A importacao deve exigir:

```text
IdLancamento
DataHoraCadastro
Task
LoginUsuario
Duracao
IdTask
TituloTask
IdPBI
TituloPBI
IdFeat
TituloFeat
IdEpic
TituloEpic
```

Observacao: o campo pode vir com acento como `Duração`; o sistema deve aceitar alias configuravel para normalizar para `Duracao`.

## 4. Regras De Bloqueio

A importacao deve ser bloqueada quando houver:

```text
Campo obrigatorio ausente
Campo obrigatorio vazio
IdLancamento duplicado sem resolucao
Duracao vazia
Duracao invalida
Duracao negativa
DataHoraCadastro invalida
LoginUsuario vazio
Hierarquia Epic > Feature > PBI > Task incompleta
```

O sistema deve mostrar linha do arquivo, campo com erro, valor encontrado, tipo do erro e acao sugerida.

## 5. Duplicidade

A duplicidade sera identificada somente por `IdLancamento`.

Se houver mais de um registro com o mesmo `IdLancamento`, a importacao deve ser bloqueada inicialmente. O usuario podera:

```text
Manter apenas um dos registros duplicados
Remover os demais da importacao
Cancelar a importacao para corrigir a base original
Exportar relatorio de duplicidades
```

O sistema nao deve excluir registros automaticamente.

## 6. Duracao

A coluna `Duracao` sera considerada a fonte oficial das horas.

Formato esperado:

```text
HH:MM:SS
```

Exemplo:

```text
01:30:00
```

Duracao igual a `00:00:00` nao bloqueia importacao, mas gera alerta.

## 7. Categorias

Categorias oficiais v1:

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

Subcategorias oficiais v1:

```text
Back
Front
QA
Nao aplicavel
Nao classificado
```

O campo usado para classificacao sera sempre `TituloTask`.

## 8. Classificacao Por Titulo

Formato ideal:

```text
[Categoria] Titulo da atividade
```

Exemplo:

```text
[Desenvolvimento][Back] - Nota rota abacaxi dois
```

Resultado:

```text
Categoria: Desenvolvimento
Subcategoria: Back
Descricao: Nota rota abacaxi dois
Status: Automatica por padrao do titulo
```

Se o titulo nao estiver no padrao ou a categoria nao estiver cadastrada/ativa, o sistema deve manter o registro como nao classificado para revisao.

O usuario podera aceitar, alterar, marcar como nao classificado ou solicitar criacao de nova categoria. Criacao de nova categoria sera permitida somente para administrador.

## 9. Calculos

O sistema deve calcular:

```text
Total de horas por colaborador
Total de horas por periodo
Total de horas por Epic
Total de horas por Feature
Total de horas por PBI
Total de horas por Task
Total de horas por categoria
Total de horas por subcategoria
Total de horas por categoria dentro de Epic
Total de horas por categoria dentro de Feature
Total de horas por categoria dentro de PBI
Total de horas por colaborador dentro de categoria
Percentual de participacao por Epic/Feature/PBI/Task
Percentual de participacao por categoria
Ranking de maior consumo de horas
Media de horas por colaborador
Media de horas por categoria
```

## 10. Relatorios

Relatorios obrigatorios para o MVP:

```text
Relatorio de erros de importacao
Relatorio de duplicidades
Resumo de horas por colaborador
Resumo de horas por Epic
Resumo de horas por Feature
Resumo de horas por PBI
Resumo de horas por Task
Resumo de horas por categoria
Resumo de horas por subcategoria
Ranking de maior consumo de horas
Relatorio de titulos fora do padrao
Relatorio de classificacoes sugeridas
Relatorio de classificacoes alteradas pelo usuario
```

## 11. IA

A IA sera usada principalmente para analises complexas dos numeros e relatorios:

```text
Gerar resumo executivo
Explicar variacoes de horas
Identificar concentracao de esforco
Apontar aumento de retrabalho
Comparar categorias
Detectar padroes fora do esperado
Responder perguntas sobre os dados
Sugerir classificacao de titulos fora do padrao
```

A IA nao deve alterar dados automaticamente.
