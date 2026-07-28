# Regras de negócio

Versão documental: **28/07/2026**.

## Projetos — importação

| Regra | Comportamento |
| --- | --- |
| Arquivos | Aceita Excel e CSV suportados pelo importer. |
| Aba Excel | Usa a primeira aba que contenha todas as colunas obrigatórias. |
| Colunas | `IdLancamento`, `DataHoraCadastro`, `Task`, `LoginUsuario`, `Duracao`, `IdTask`, `TituloTask`, `IdPBI`, `TituloPBI`, `IdFeat`, `TituloFeat`, `IdEpic`, `TituloEpic`. |
| Staging | Nenhum lançamento final é gravado antes da confirmação. |
| Sessão | Conteúdo, validação e classificações ficam em `import_sessions` e `staging_rows`. |
| Retenção | Sessões temporárias antigas são removidas conforme `IMPORT_SESSION_RETENTION_DAYS` (padrão 7). |
| Duplicidade | Chave exclusiva funcional: `IdLancamento` dentro da importação. |
| Resolução | Duplicidade bloqueia até o usuário selecionar a linha mantida. |
| Duração | Formato `HH:MM:SS`; minutos e segundos entre 00 e 59. |
| Duração zero | Gera alerta, não bloqueio. |
| Duração excessiva | Acima de 12 horas gera alerta operacional. |
| Data | Deve ser interpretável como data/hora. |
| Confirmação | Revalida bloqueios antes de persistir. |

## Projetos — classificação

| Prioridade | Regra |
| --- | --- |
| 1 | Primeiro colchete do título no padrão `[Categoria] descrição`. |
| 2 | Alias/nome de categoria ativa. |
| 3 | Palavras-chave/regras configuradas geram sugestão. |
| 4 | Override explícito do usuário define o resultado final. |

Regras complementares:

- colchetes posteriores ao primeiro não mudam a categoria;
- prefixo desconhecido gera pendência;
- título fora do padrão permanece para revisão mesmo com sugestão;
- classificações guardam origem, confiança, nível e versão;
- perfil do colaborador pode sugerir subcategoria;
- reprocessamento registra valores anteriores e novos.

## Indicadores Gerais — identidade e preservação

| Regra | Comportamento |
| --- | --- |
| Unidade | Um `IdLancamento` corresponde a uma unidade de contabilização. |
| Independência | Lançamentos da mesma Task/Feature nunca substituem uns aos outros. |
| Joins repetidos | Linhas técnicas idênticas são consolidadas sem duplicar horas. |
| Duplicidade idêntica | Tratada automaticamente, com evidência preservada. |
| Duplicidade conflitante | Impeditiva; nenhuma ocorrência é escolhida silenciosamente. |
| Ausência de ID | Impeditiva e excluída dos totais válidos. |

## Indicadores Gerais — hierarquia

| Regra | Validação |
| --- | --- |
| Task | Deve existir e ser rastreável. |
| Pai da Task | Tipo real deve ser `Product Backlog Item`/PBI ou `Bug`. |
| Feature | Pai superior deve existir e ter tipo real `Feature`. |
| Epic | É preservado para rastreabilidade quando disponível. |
| Candidato inválido | Nunca é usado como Feature nem como fonte de TAG. |
| PBI e Bug na mesma Feature | São permitidos e preservados separadamente. |

## Indicadores Gerais — TAGs

Formato:

```text
1-<módulo>; 2-<categoria>; 3-<demanda>
```

Regras:

- exatamente uma TAG válida de cada nível `1`, `2` e `3`;
- TAG ausente, vazia, múltipla ou fora do padrão é impeditiva;
- espaços excedentes podem ser normalizados e auditados;
- TAG `2-` deve representar uma categoria oficial;
- TAGs são obrigatórias inclusive para lançamentos classificados como Bug;
- problemas de TAG são agrupados por Feature, mas preservam todos os `IdLancamento` afetados.

## Indicadores Gerais — classificação

```text
se tipo real do pai da Task = Bug
    categoria final = Bug
senão
    categoria final = categoria da TAG 2- da Feature
```

`Atualização do sistema` é identificada pela TAG `1-`. Um Bug nunca é convertido em Atualização do sistema.

Categorias canônicas usadas no cálculo:

- Novo projeto;
- Melhoria;
- Erro TI;
- Bug;
- Manutenção;
- demais categorias operacionais;
- Atualização do sistema como categoria transitória.

## Participação

- perfil participante: lançamento pode ser validado e calculado;
- perfil não participante: lançamento permanece persistido e auditado, sem gerar bloqueios funcionais de hierarquia e sem integrar os cálculos;
- totais brutos, considerados e desconsiderados devem reconciliar.

## Pendências

Pendências impeditivas incluem:

- ID ausente;
- duração vazia, inválida ou negativa;
- data inválida ou fora do período;
- Task sem pai;
- tipo de pai ausente/não suportado;
- Feature ausente ou candidato superior que não é Feature;
- TAG obrigatória ausente/vazia/múltipla/inválida;
- categoria desconhecida;
- duplicidade conflitante;
- Atualização do sistema sem base mensal ativa para distribuição.

Uma consequência derivada, como “classificação impossível”, é relacionada à causa raiz para evitar duplicidade visual.

## Estados da consulta

Principais estados persistidos:

```text
CONSULTANDO
COM_INCONSISTENCIAS
PRONTA_PARA_FINALIZAR
ATUALIZANDO_PENDENCIAS
REFAZENDO_CONSULTA
FINALIZANDO
FINALIZADA
FALHA
```

Regras:

- somente `PRONTA_PARA_FINALIZAR` pode ser salva;
- atualização não finaliza automaticamente;
- consulta finalizada é imutável;
- operações concorrentes para a mesma consulta são rejeitadas;
- operação expirada pode ser recuperada de forma controlada.

## Distribuição ponderada

Categoria transitória: **Atualização do sistema**.

Participantes e pesos padrão atuais:

| Categoria | Peso | Ativa |
| --- | ---: | --- |
| Novo projeto | 5 | Sim |
| Melhoria | 5 | Sim |
| Erro TI | 3 | Sim |
| Bug | 4 | Sim |
| Manutenção | 1 | Sim |

O banco aceita pesos inteiros de 1 a 5.

Para cada mês:

```text
valor_ponderado(c) = horas_originais(c) × peso(c)

participação(c) =
    valor_ponderado(c)
    ÷ soma dos valores ponderados das categorias ativas

horas_redistribuídas(c) =
    horas_de_atualização_do_mês × participação(c)

horas_ajustadas(c) =
    horas_originais(c) + horas_redistribuídas(c)
```

Categorias inativas não recebem distribuição. Se houver horas de Atualização do sistema e a base ponderada mensal for zero, a finalização é bloqueada.

Resíduos de arredondamento são balanceados para que:

```text
soma das horas redistribuídas = horas de Atualização do sistema
soma das horas ajustadas = total de horas consideradas
```

## KPIs

### Novos projetos + melhorias

```text
percentual =
    (Novo projeto ajustado + Melhoria ajustada)
    ÷ total considerado × 100
```

| Faixa | Situação |
| --- | --- |
| >= 40% | Meta atendida |
| >= 30% e < 40% | Atenção |
| < 30% | Abaixo da meta |

### Erro TI + Bug

```text
percentual =
    (Erro TI ajustado + Bug ajustado)
    ÷ total considerado × 100
```

| Faixa | Situação |
| --- | --- |
| <= 10% | Dentro do limite |
| > 10% e <= 15% | Atenção |
| > 15% | Crítico |

Versões executáveis atuais:

```text
Contrato do resultado: 2
Cálculo: general-indicators-v1
Classificação: hierarchy-tags-v2
Distribuição: update-system-weighted-proportional-v2
Metas: general-indicators-targets-v1
```

## Snapshot oficial

O snapshot guarda:

- período, consulta, validação e finalização;
- responsáveis e identificadores de versão;
- resumos brutos, considerados e desconsiderados;
- categorias originais, redistribuídas e ajustadas;
- distribuição mensal;
- evolução mensal;
- KPIs e limites;
- configuração histórica de pesos;
- auditoria por `IdLancamento`;
- inconsistências e evidências;
- hashes do snapshot e do resultado.

Alterar TAGs, participação ou pesos depois da finalização não muda relatórios anteriores.

## Análise por período

- somente dentro do intervalo oficial;
- filtra lançamentos do audit trail persistido;
- recalcula usando o mesmo motor oficial;
- usa obrigatoriamente a configuração histórica do snapshot;
- é somente leitura e não cria versão;
- não chama SQL Server/TFS.
