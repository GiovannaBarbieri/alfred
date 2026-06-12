# Modelo De Dados v1

## Tabelas Do MVP

```text
usuarios
importacoes
lancamentos_horas
categorias
subcategorias
classificacoes_task
erros_importacao
duplicidades_importacao
auditoria_acoes
```

## usuarios

Mesmo sem login completo na primeira versao, a tabela prepara a expansao.

```text
id
nome
login
email
perfil: admin, operador, gestor
ativo
criado_em
```

## importacoes

```text
id
nome_arquivo
hash_arquivo
status: em_validacao, bloqueada, corrigida, concluida
data_importacao
usuario_importacao_id
total_registros
registros_validos
registros_com_alerta
registros_bloqueados
observacao
```

## lancamentos_horas

```text
id
importacao_id
id_lancamento
data_hora_cadastro
login_usuario
duracao_original
duracao_segundos
id_epic
titulo_epic
id_feat
titulo_feat
id_pbi
titulo_pbi
id_task
titulo_task
categoria_id
subcategoria_id
status_validacao: valido, alerta, bloqueado
status_classificacao: automatica, sugerida, alterada, nao_classificada
criado_em
```

## categorias

```text
id
nome
ativa
criada_por
criado_em
```

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

## subcategorias

```text
id
nome
ativa
criada_por
criado_em
```

Subcategorias iniciais:

```text
Back
Front
QA
Nao aplicavel
Nao classificado
```

## classificacoes_task

```text
id
lancamento_id
titulo_task
categoria_sugerida_id
subcategoria_sugerida_id
categoria_final_id
subcategoria_final_id
origem_classificacao: padrao_titulo, regra, ia, manual
confianca
aprovado_por_usuario
usuario_aprovacao_id
data_aprovacao
```

## erros_importacao

```text
id
importacao_id
linha
campo
valor_encontrado
tipo_erro
severidade: bloqueio, alerta
mensagem
resolvido
criado_em
```

## duplicidades_importacao

```text
id
importacao_id
id_lancamento
linhas_envolvidas
registro_mantido_id
registros_removidos
resolvido
resolvido_por
data_resolucao
```

## auditoria_acoes

```text
id
usuario_id
importacao_id
entidade
entidade_id
acao
valor_anterior
valor_novo
data_acao
```

## Observacao Sobre Consolidados

A tabela `consolidados_horas` pode entrar depois, se os relatorios ficarem lentos. No MVP, os consolidados podem ser calculados direto a partir de `lancamentos_horas`.

