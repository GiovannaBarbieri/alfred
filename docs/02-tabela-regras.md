# Tabela De Regras v1

| ID | Regra | Tipo | Campo/Origem | Condicao | Acao |
|---|---|---|---|---|---|
| R001 | Verificar coluna IdLancamento | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R002 | Verificar coluna DataHoraCadastro | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R003 | Verificar coluna Task | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R004 | Verificar coluna LoginUsuario | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R005 | Verificar coluna Duracao | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R006 | Verificar coluna IdTask | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R007 | Verificar coluna TituloTask | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R008 | Verificar coluna IdPBI | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R009 | Verificar coluna TituloPBI | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R010 | Verificar coluna IdFeat | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R011 | Verificar coluna TituloFeat | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R012 | Verificar coluna IdEpic | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R013 | Verificar coluna TituloEpic | Bloqueio | Cabecalho | Coluna ausente | Bloquear importacao |
| R014 | Validar IdLancamento preenchido | Bloqueio | IdLancamento | Valor vazio | Bloquear importacao |
| R015 | Validar DataHoraCadastro preenchido | Bloqueio | DataHoraCadastro | Valor vazio | Bloquear importacao |
| R016 | Validar Task preenchida | Bloqueio | Task | Valor vazio | Bloquear importacao |
| R017 | Validar LoginUsuario preenchido | Bloqueio | LoginUsuario | Valor vazio | Bloquear importacao |
| R018 | Validar Duracao preenchida | Bloqueio | Duracao | Valor vazio | Bloquear importacao |
| R019 | Validar IdTask preenchido | Bloqueio | IdTask | Valor vazio | Bloquear importacao |
| R020 | Validar TituloTask preenchido | Bloqueio | TituloTask | Valor vazio | Bloquear importacao |
| R021 | Validar IdPBI preenchido | Bloqueio | IdPBI | Valor vazio | Bloquear importacao |
| R022 | Validar TituloPBI preenchido | Bloqueio | TituloPBI | Valor vazio | Bloquear importacao |
| R023 | Validar IdFeat preenchido | Bloqueio | IdFeat | Valor vazio | Bloquear importacao |
| R024 | Validar TituloFeat preenchido | Bloqueio | TituloFeat | Valor vazio | Bloquear importacao |
| R025 | Validar IdEpic preenchido | Bloqueio | IdEpic | Valor vazio | Bloquear importacao |
| R026 | Validar TituloEpic preenchido | Bloqueio | TituloEpic | Valor vazio | Bloquear importacao |
| R027 | Validar duplicidade de lancamento | Bloqueio com resolucao | IdLancamento | Mesmo ID repetido | Abrir resolucao de duplicidade |
| R028 | Validar formato da data | Bloqueio | DataHoraCadastro | Data invalida | Bloquear importacao |
| R029 | Validar formato da duracao | Bloqueio | Duracao | Diferente de HH:MM:SS | Bloquear importacao |
| R030 | Validar duracao negativa | Bloqueio | Duracao | Valor menor que zero | Bloquear importacao |
| R031 | Validar duracao zerada | Alerta | Duracao | Valor igual a 00:00:00 | Importar e marcar para revisao |
| R032 | Validar hierarquia completa | Bloqueio | Epic/Feature/PBI/Task | Algum nivel ausente | Bloquear importacao |
| R033 | Extrair categoria por padrao | Classificacao automatica | TituloTask | Categoria no primeiro colchete do titulo | Classificar automaticamente |
| R034 | Identificar titulo fora do padrao | Alerta | TituloTask | Fora do padrao | Enviar para sugestao |
| R035 | Sugerir categoria por palavra-chave | Sugestao | TituloTask | Contem termos conhecidos | Sugerir categoria/subcategoria |
| R036 | Sugerir categoria por IA | Sugestao IA | TituloTask + contexto | Regras inconclusivas | Sugerir para revisao |
| R037 | Aprovar classificacao sugerida | Acao do usuario | Categoria sugerida | Usuario aceita | Gravar classificacao |
| R038 | Alterar classificacao sugerida | Acao do usuario | Categoria/subcategoria | Usuario altera | Gravar alteracao |
| R039 | Marcar como nao classificado | Acao do usuario | Categoria/subcategoria | Usuario rejeita | Gravar como Nao classificado |
| R040 | Criar nova categoria | Restrito admin | Categoria | Categoria inexistente | Permitir somente admin |
| R041 | Calcular horas por colaborador | Calculo | LoginUsuario, Duracao | Importacao valida | Somar duracao |
| R042 | Calcular horas por periodo | Calculo | DataHoraCadastro, Duracao | Importacao valida | Somar por periodo |
| R043 | Calcular horas por Epic | Calculo | IdEpic, TituloEpic, Duracao | Importacao valida | Somar por Epic |
| R044 | Calcular horas por Feature | Calculo | IdFeat, TituloFeat, Duracao | Importacao valida | Somar por Feature |
| R045 | Calcular horas por PBI | Calculo | IdPBI, TituloPBI, Duracao | Importacao valida | Somar por PBI |
| R046 | Calcular horas por Task | Calculo | IdTask, TituloTask, Duracao | Importacao valida | Somar por Task |
| R047 | Calcular horas por categoria | Calculo | Categoria, Duracao | Categoria definida | Somar por categoria |
| R048 | Calcular horas por subcategoria | Calculo | Subcategoria, Duracao | Subcategoria definida | Somar por subcategoria |
| R049 | Calcular percentual por hierarquia | Calculo | Epic/Feature/PBI/Task | Importacao valida | Calcular percentual |
| R050 | Calcular percentual por categoria | Calculo | Categoria, Duracao | Categoria definida | Calcular percentual |
| R051 | Gerar relatorio de erros | Relatorio | Validacoes | Erros encontrados | Exibir/exportar |
| R052 | Gerar relatorio de duplicidades | Relatorio | IdLancamento | Duplicidades encontradas | Exibir/exportar |
| R053 | Gerar relatorio de titulos fora do padrao | Relatorio | TituloTask | Fora do padrao | Exibir/exportar |
| R054 | Gerar relatorio de classificacoes sugeridas | Relatorio | Categoria sugerida | Sugestoes existentes | Exibir/exportar |
| R055 | Gerar relatorio de alteracoes manuais | Auditoria | Classificacoes alteradas | Usuario alterou | Registrar alteracao |
| R056 | Registrar importacao | Auditoria | Arquivo importado | Tentativa de importacao | Gravar historico |
| R057 | Registrar importacao bloqueada | Auditoria | Validacoes | Erro bloqueante | Gravar status bloqueado |
| R058 | Registrar importacao concluida | Auditoria | Validacoes | Sem bloqueios pendentes | Gravar status concluido |
| R059 | Gerar resumo executivo por IA | IA | Dados consolidados | Usuario solicita | Gerar analise textual |
| R060 | Analisar variacoes por IA | IA | Dados consolidados | Usuario solicita | Explicar variacoes |
| R061 | Salvar base importada | Persistencia | Importacao valida ou bloqueada | Arquivo processado | Salvar original/metadados |
| R062 | Salvar base corrigida | Persistencia | Usuario corrige/resolucao | Alteracao confirmada | Salvar versao corrigida |
| R063 | Salvar base consolidada | Persistencia | Dados validados | Importacao concluida | Salvar dados para relatorios |
