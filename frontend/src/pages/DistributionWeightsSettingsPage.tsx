import { CircleHelp, RefreshCw, Save } from "lucide-react";
import { useDistributionWeights } from "../hooks/useDistributionWeights";
import {
  distributionWeightInfluence,
  displayDistributionCategory,
  hasActiveDistributionCategory,
} from "../utils/distributionWeights";

const WEIGHT_OPTIONS = [1, 2, 3, 4, 5] as const;

export function DistributionWeightsSettingsPage() {
  const weights = useDistributionWeights();
  const hasParticipant = hasActiveDistributionCategory(weights.items);

  async function handleRestoreDefaults() {
    const confirmed = window.confirm(
      "Restaurar os pesos padrão e ativar todas as categorias participantes?",
    );
    if (confirmed) await weights.restoreDefaults();
  }

  if (weights.isLoading) {
    return (
      <section className="distribution-weights-state" aria-live="polite">
        <RefreshCw className="spin" size={20} />
        Carregando pesos de distribuição...
      </section>
    );
  }

  if (weights.error && weights.items.length === 0) {
    return (
      <section className="distribution-weights-state error" role="alert">
        <strong>Não foi possível carregar os pesos de distribuição.</strong>
        <span>{weights.error}</span>
        <button className="secondary-button compact" type="button" onClick={() => void weights.load()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="distribution-weights-page">
      <p className="distribution-weights-description">
        Configure os pesos utilizados para redistribuir as horas classificadas como
        {" "}<strong>Atualização do sistema</strong> entre as categorias participantes.
      </p>
      <p className="distribution-weights-scope">
        As alterações afetam apenas novas análises e futuras atualizações de relatórios.
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
          <div className="distribution-weights-table" role="table" aria-label="Pesos de distribuição">
            <div className="distribution-weights-row header" role="row">
              <span role="columnheader">Categoria</span>
              <span role="columnheader">Peso</span>
              <span role="columnheader">Influência</span>
              <span role="columnheader">Participa da distribuição</span>
            </div>
            {weights.items.map((item) => (
              <div className={`distribution-weights-row ${item.active ? "" : "inactive"}`} role="row" key={item.category}>
                <strong role="cell">{displayDistributionCategory(item.category)}</strong>
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
                <span className="distribution-weight-influence" role="cell">
                  {distributionWeightInfluence(item.weight)}
                </span>
                <label className="distribution-participation" role="cell">
                  <input
                    type="checkbox"
                    checked={item.active}
                    disabled={weights.isSaving}
                    onChange={(event) => weights.changeParticipation(item.category, event.target.checked)}
                  />
                  <span>{item.active ? "Participa" : "Não participa"}</span>
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
              Restaurar padrão
            </button>
            <button
              className="primary-button compact"
              type="button"
              disabled={weights.isSaving || !hasParticipant}
              onClick={() => void weights.save()}
            >
              {weights.isSaving ? <RefreshCw className="spin" size={16} /> : <Save size={16} />}
              {weights.isSaving ? "Salvando..." : "Salvar alterações"}
            </button>
          </footer>
        </div>
      )}

      <aside className="distribution-weights-help">
        <CircleHelp size={20} />
        <div>
          <strong>Como funciona?</strong>
          <p>
            Os pesos determinam a influência de cada categoria na redistribuição das horas classificadas
            como “Atualização do sistema”. Quanto maior o peso, maior será a participação da categoria.
          </p>
          <p>
            As alterações não modificam relatórios já finalizados. Somente novas análises e futuras
            atualizações utilizarão essa configuração.
          </p>
          <div className="distribution-weights-example">
            <strong>Exemplo simples</strong>
            <p>
              Considere <strong>100 h</strong> em Novo Projeto (peso 4), <strong>100 h</strong> em
              Manutenção (peso 1) e <strong>60 h</strong> de Atualização do sistema para distribuir.
            </p>
            <div className="distribution-weights-example-calculation">
              <span>Novo Projeto: 100 × 4 = 400 pontos</span>
              <span>Manutenção: 100 × 1 = 100 pontos</span>
              <span>Total: 500 pontos</span>
            </div>
            <p>
              Das 60 h, Novo Projeto recebe <strong>48 h</strong> e Manutenção recebe
              {" "}<strong>12 h</strong>. Assim, as 60 h são totalmente distribuídas conforme horas e peso.
            </p>
          </div>
        </div>
      </aside>
    </section>
  );
}
