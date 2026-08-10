# Especificação funcional

Versão documental: **10/08/2026**.

## Objetivo

O Alfred consolida horas registradas no TFS em informações operacionais e gerenciais confiáveis. O produto separa dois domínios:

- **Projetos**: importação, saneamento, classificação e análise de bases de projeto.
- **Indicadores Gerais**: consulta direta por período, validação da hierarquia/TAGs e geração de relatórios oficiais independentes.

## Navegação

```text
Relatórios
├── Projetos
├── Indicadores Gerais
└── Meus Relatórios

Configurações
├── Configurações gerais
├── Distribuição das categorias
└── Módulos
```

O menu funciona como accordion: apenas um grupo principal permanece expandido e somente a página ativa recebe destaque.

## Projetos

### Entradas

- planilha `.xlsx`, `.xls`, `.csv`;
- prévia consultada no SQL Server.

### Etapas

1. seleção da origem;
2. leitura e normalização;
3. criação de sessão temporária;
4. validação;
5. classificação automática;
6. resolução de duplicidades e pendências;
7. cadastro opcional de colaboradores sem perfil;
8. confirmação;
9. persistência final;
10. abertura do relatório do projeto.

### Saídas

- resumo executivo;
- gráficos;
- evolução;
- comparações;
- Tasks por colaborador;
- exportações CSV/XLSX.

## Indicadores Gerais

### Responsabilidade da tela

A tela **Indicadores Gerais** existe somente para gerar um relatório:

1. escolher período;
2. consultar;
3. validar;
4. corrigir/atualizar pendências;
5. definir nome;
6. salvar.

Após salvar, o usuário é redirecionado para **Meus Relatórios**, e o relatório recém-criado é aberto automaticamente. KPIs e gráficos finais não são exibidos na tela de geração.

### Consulta

- Data inicial e final são obrigatórias.
- Data inicial deve ser menor ou igual à final.
- Alterar filtros ou atalhos não executa consulta.
- A consulta começa apenas pelo botão **Consultar**.
- O processamento é assíncrono e o frontend acompanha progresso por polling.
- Cada consulta persiste sua própria execução, lançamentos, inconsistências e histórico de atualizações.

### Unidade de contabilização

Cada `IdLancamento` é uma unidade independente. Lançamentos distintos na mesma Task, PBI, Bug ou Feature permanecem separados.

Linhas idênticas retornadas por joins de hierarquia são consolidadas tecnicamente sem multiplicar horas. Duplicidades reais de `IdLancamento` mantêm evidência de origem e são validadas.

### Hierarquia

Fluxo esperado:

```text
Task → PBI ou Bug → Feature → Epic
```

- O tipo real do pai da Task define PBI ou Bug.
- Um candidato superior só é aceito como Feature se seu tipo real for `Feature`.
- TAGs nunca são lidas de um item que não foi confirmado como Feature.
- Falta de Task, pai, Feature ou tipo suportado gera pendência impeditiva.
- O `State` atual da Task, PBI/Bug, Feature e Epic é lido em lote a partir do TFS para permitir auditoria e desconsideração automática de itens removidos.

### TAGs e classificação

A Feature deve possuir exatamente uma TAG de cada nível:

```text
1-Módulo
2-Categoria
3-Demanda
```

- Para pai real `Bug`, a categoria final é `Bug`.
- Para pai real `PBI`, a categoria final vem da TAG `2-`.
- Mesmo lançamentos abaixo de Bug exigem a presença das três TAGs na Feature.
- Categoria desconhecida na TAG `2-` bloqueia a finalização.
- Normalização técnica de espaços/acentos pode ser registrada como tratamento automático.

### Work Items removidos

Lançamentos associados a qualquer Work Item da cadeia hierárquica atual com `State = Removed` são preservados na auditoria, mas não participam dos Indicadores Gerais.

Níveis avaliados:

- Task;
- PBI ou Bug;
- Feature;
- Epic.

Regras:

- a verificação usa o estado atual retornado por `tbl_WorkItemCoreLatest.State`;
- a comparação é normalizada para evitar diferenças de caixa ou espaços;
- o lançamento é contado uma única vez como desconsiderado, mesmo quando mais de um nível da cadeia estiver `Removed`;
- `Removed` não gera pendência impeditiva para o usuário, pois não deve ser corrigido no Alfred;
- horas removidas não entram no total considerado, KPIs, categorias, gráficos, distribuição de `Atualização do sistema` nem análise por período.

### Participação de colaboradores

`perfis_colaborador.participa_indicadores_gerais` controla a participação.

- `true`: lançamento participa das validações e cálculos.
- `false`: lançamento e horas permanecem no snapshot/auditoria, mas são desconsiderados dos indicadores.

### Atualização de pendências

**Atualizar pendências** reconsulta somente entidades relacionadas às inconsistências abertas.

- TAG: Feature é consultada uma vez e todos os lançamentos relacionados são reclassificados individualmente.
- Duração, data, duplicidade, Task, pai e tipo: apenas lançamentos e itens relacionados são revalidados.
- Lançamentos válidos não afetados são preservados.
- A ação não finaliza e não calcula o resultado oficial.

**Refazer consulta completa** existe como operação técnica secundária e exige confirmação explícita.

### Salvamento

Quando não há pendência impeditiva:

- o usuário informa o nome;
- **Salvar relatório** finaliza a consulta;
- um snapshot oficial completo é persistido;
- um relatório independente é criado;
- o frontend abre esse relatório em **Meus Relatórios**.

Em caso de erro, a consulta e o nome permanecem na tela para nova tentativa.

## Meus Relatórios

### Listagem

Filtros:

- nome;
- ano;
- paginação.

Ações:

- abrir;
- excluir permanentemente;
- atualizar listagem.

Os filtros diferenciam valores digitados dos últimos valores aplicados. **Aplicar filtros** só habilita com alteração pendente; **Limpar filtros** só habilita quando existe algo a limpar.

### Visualização

Um relatório aberto possui:

- **Visão Geral**: snapshot oficial, KPIs, gráficos, composição e distribuição;
- **Análises**: área extensível com seletor interno para **Por período** e **Comparação**.

Abrir um relatório não consulta o TFS nem o SQL Server.

### Análise por período

### Comparação entre períodos

- compara dois intervalos independentes dentro do período oficial do relatório;
- utiliza exclusivamente o snapshot salvo, sem nova consulta ao SQL Server/TFS;
- apresenta totais, KPIs, categorias, participações, variações e resumo determinístico;
- quando as durações diferem, informa dias e médias diárias para apoiar a interpretação.

- intervalo deve estar contido no período oficial;
- atalhos apenas preenchem datas;
- cálculo inicia no botão **Analisar**;
- usa pesos históricos salvos no snapshot;
- não persiste alterações, revisões ou nova auditoria;
- retorna quatro KPIs, composição das seis categorias executivas e evolução diária para intervalos de até 31 dias ou mensal para intervalos maiores;
- inclui pontos sem horas para preservar a continuidade temporal;
- snapshots antigos sem pesos históricos retornam uma mensagem clara de incompatibilidade;
- o payload público não expõe a coleção técnica completa de auditoria.

### Exclusão

A exclusão é permanente e transacional:

- remove o relatório, revisões, consultas, lançamentos, inconsistências e atualizações relacionadas;
- não consulta o TFS;
- não renumera versões históricas;
- não promove automaticamente outra versão;
- impede exclusão enquanto existir processamento relacionado.

## Configurações gerais

Permite manter:

- categorias;
- subcategorias/cargos;
- palavras-chave;
- regras de classificação;
- perfis de colaboradores;
- colaboradores ignorados;
- participação nos Indicadores Gerais.

## Distribuição das categorias

Permite definir a participação e o peso (1 a 5) das categorias:

- Novo projeto;
- Melhoria;
- Erro TI;
- Bug;
- Manutenção.

O padrão utiliza peso 1 em todas as categorias ativas, resultando em distribuição mensal proporcional às horas originais. Pesos maiores aumentam a prioridade da categoria. Pelo menos uma categoria deve permanecer ativa. Alterações são auditadas e afetam somente novas consultas; snapshots finalizados preservam a configuração utilizada.

## Metas dos indicadores

Permite configurar períodos de vigência para os KPIs dos Indicadores Gerais:

- meta mínima de Novos projetos + melhorias;
- limite máximo de Erro TI + Bug.

Configurações não podem se sobrepor. Uma nova consulta deve estar inteiramente coberta por um único período de metas; períodos sem cobertura ou atravessando mais de uma vigência retornam validação clara e não usam fallback silencioso. O padrão inicial cadastra 2025 com meta 31,44% e limite 10,16%, e 2026 com meta 40,00% e limite 10,00%.

Relatórios finalizados salvam a configuração de metas no snapshot. Alterações futuras afetam somente novas consultas ou atualizações confirmadas, sem recalcular relatórios já salvos.

## Módulos

Lista TAGs completas de nível `1-` encontradas no TFS e permite ativar ou inativar sua
participação nos Indicadores Gerais. A sincronização inclui somente TAGs novas, inicialmente
ativas; não remove nem renomeia registros existentes.

Lançamentos de módulos inativos permanecem na auditoria, mas não entram nos cálculos,
percentuais ou gráficos novos. O relatório salva a configuração utilizada no snapshot e
nenhum relatório já finalizado é recalculado.

## Funcionalidades preservadas fora do menu

Os componentes/endpoints de Dashboard, Histórico, Auditoria e Inteligência Operacional continuam disponíveis no código. Eles não devem ser considerados páginas ativas do menu até uma decisão explícita de produto.

## Fora do escopo

- controle de ponto;
- folha de pagamento;
- banco de horas;
- regras trabalhistas;
- alteração automática de itens no TFS;
- autenticação/autorização corporativa completa;
- edição de snapshots oficiais.
