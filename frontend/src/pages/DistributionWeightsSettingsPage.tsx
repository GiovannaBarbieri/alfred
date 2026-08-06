import { CircleHelp, RefreshCw, Save } from "lucide-react";
import { useDistributionWeights } from "../hooks/useDistributionWeights";
import {
  displayDistributionCategory,
  hasActiveDistributionCategory,
} from "../utils/distributionWeights";

const WEIGHT_OPTIONS = [1, 2, 3, 4, 5] as const;

export function DistributionWeightsSettingsPage() {
  const weights = useDistributionWeights();
  const hasParticipant = hasActiveDistributionCategory(weights.items);

  async function handleRestoreDefaults() {
    const confirmed = window.confirm(
      "Restaurar a distribuição proporcional padrão, com peso 1, e ativar todas as categorias participantes?",
    );
    if (confirmed) await weights.restoreDefaults();
  }

  if (weights.isLoading) {
    return (
      <section className="distribution-weights-state" aria-live="polite">
        <RefreshCw className="spin" size={20} />
        Carregando distribuição das categorias...
      </section>
    );
  }

  if (weights.error && weights.items.length === 0) {
    return (
      <section className="distribution-weights-state error" role="alert">
        <strong>Não foi possível carregar a distribuição das categorias.</strong>
        <span>{weights.error}</span>
        <button className="secondary-button compact" type="button" onClick={() => void weights.load()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="distribution-weights-page">
      <p className="distribution-weights-scope">
        As alterações afetam somente novas consultas. Relatórios já finalizados preservam a configuração original.
      </p>

      {weights.items.length === 0 ? (
        <div className="distribution-weights-state">
          <strong>Nenhuma configuração encontrada.</strong>
          <span>Restaure os padrões para criar a configuração inicial.</span>
          <button className="primary-button compact" type="button" onClick={() => void handleRestoreDefaults()}>
            Restaurar padrão
          </button>
        </div>
      ) : (
        <div className="distribution-weights-panel">
          <div className="distribution-weights-table" role="table" aria-label="Distribuição das categorias">
            <div className="distribution-weights-row header" role="row">
              <span role="columnheader">Categoria</span>
              <span role="columnheader">Participa da distribuição</span>
              <span role="columnheader">Peso</span>
            </div>
            {weights.items.map((item) => (
              <div className={`distribution-weights-row ${item.active ? "" : "inactive"}`} role="row" key={item.category}>
                <strong role="cell">{displayDistributionCategory(item.category)}</strong>
                <label className="distribution-participation" role="cell">
                  <input
                    type="checkbox"
                    checked={item.active}
                    disabled={weights.isSaving}
                    onChange={(event) => weights.changeParticipation(item.category, event.target.checked)}
                  />
                  <span>{item.active ? "Participa" : "Não participa"}</span>
                </label>
                <label role="cell">
                  <span className="sr-only">Peso de {item.category}</span>
                  <select
                    aria-label={`Peso de ${item.category}`}
                    value={item.weight}
                    disabled={weights.isSaving}
                    onChange={(event) => weights.changeWeight(item.category, Number(event.target.value))}
                  >
                    {WEIGHT_OPTIONS.map((option) => <option value={option} key={option}>{option}</option>)}
                  </select>
                </label>
              </div>
            ))}
          </div>

          {!hasParticipant && (
            <p className="settings-feedback error" role="alert">
              Pelo menos uma categoria deve participar da distribuição.
            </p>
          )}
          {weights.error && <p className="settings-feedback error" role="alert">{weights.error}</p>}
          {weights.success && <p className="settings-feedback" role="status">{weights.success}</p>}

          <footer className="distribution-weights-actions">
            <button
              className="secondary-button compact"
              type="button"
              disabled={weights.isSaving}
              onClick={() => void handleRestoreDefaults()}
            >
              <RefreshCw size={16} />
              Restaurar distribuição padrão
            </button>
            <button
              className="primary-button compact"
              type="button"
              disabled={weights.isSaving || !hasParticipant}
              onClick={() => void weights.save()}
            >
              {weights.isSaving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
              {weights.isSaving ? "Salvando..." : "Salvar configuração"}
            </button>
          </footer>
        </div>
      )}

      <aside className="distribution-weights-help">
        <CircleHelp size={20} />
        <div>
          <strong>Como funciona?</strong>
          <p>
            Com peso 1, cada categoria recebe uma parcela proporcional às suas horas originais no mês.
            Pesos maiores aumentam a influência da categoria, sem alterar a base mensal do cálculo.
          </p>
          <p>
            As alterações não modificam relatórios já finalizados. Somente novas análises e futuras
            atualizações utilizarão essa configuração.
          </p>
          <div className="distribution-weights-example">
            <strong>Exemplo simples</strong>
            <p>
              Considere <strong>100 h</strong> em Novo Projeto, <strong>300 h</strong> em
              Manutenção e <strong>80 h</strong> de Atualização do sistema, todos com peso 1.
            </p>
            <div className="distribution-weights-example-calculation">
              <span>Novo Projeto: 100 ÷ 400 = 25%</span>
              <span>Manutenção: 300 ÷ 400 = 75%</span>
            </div>
            <p>
              Das 80 h, Novo Projeto recebe <strong>20 h</strong> e Manutenção recebe
              {" "}<strong>60 h</strong>. As horas são totalmente distribuídas de forma proporcional.
            </p>
          </div>
        </div>
      </aside>

      <p className="distribution-weights-note">
        <strong>Observação:</strong> pesos iguais a 1 resultam em uma distribuição proporcional às horas originais.
        Pesos maiores aumentam a prioridade da categoria durante a redistribuição das horas de Atualização do sistema.
      </p>
    </section>
  );
}
