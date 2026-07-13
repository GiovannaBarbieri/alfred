import { BarChart3, CheckCircle2, Eye, FilePlus2 } from "lucide-react";
import type { ImportCompleteResponse } from "../../types";
import type { ImportCompletionSnapshot } from "../../hooks/useImportFlow";

type ImportSuccessPanelProps = {
  completion: {
    response: ImportCompleteResponse;
    snapshot: ImportCompletionSnapshot;
  };
  onGoToDashboard: () => void;
  onNewImport: () => void;
  onViewImport: () => void;
};

function formatHours(value: number) {
  return Number.isInteger(value) ? `${value} horas` : `${value.toFixed(2)} horas`;
}

export function ImportSuccessPanel({
  completion,
  onGoToDashboard,
  onNewImport,
  onViewImport,
}: ImportSuccessPanelProps) {
  const { response, snapshot } = completion;
  const inconsistenciesLabel =
    snapshot.inconsistenciesCount === 0
      ? "Nenhuma inconsistencia encontrada"
      : `${snapshot.inconsistenciesCount} inconsistencia${snapshot.inconsistenciesCount === 1 ? "" : "s"} registrada${snapshot.inconsistenciesCount === 1 ? "" : "s"}`;

  return (
    <section className="import-success-panel">
      <div className="import-success-hero">
        <span>
          <CheckCircle2 size={34} />
        </span>
        <div>
          <p className="eyebrow">Fluxo finalizado</p>
          <h2>Importacao concluida com sucesso</h2>
          <p>Os dados foram persistidos na base oficial e ja podem ser acompanhados nos paineis do Alfred.</p>
        </div>
      </div>

      <div className="import-success-metrics" aria-label="Resumo da importacao concluida">
        <div>
          <strong>{formatHours(snapshot.totalHours)}</strong>
          <span>importadas</span>
        </div>
        <div>
          <strong>{response.savedRows}</strong>
          <span>registros persistidos</span>
        </div>
        <div>
          <strong>{snapshot.tasksCount}</strong>
          <span>Tasks cadastradas</span>
        </div>
        <div>
          <strong>{snapshot.collaboratorsCount}</strong>
          <span>colaboradores relacionados</span>
        </div>
      </div>

      <div className={`import-success-integrity ${snapshot.inconsistenciesCount === 0 ? "clean" : "attention"}`}>
        <CheckCircle2 size={18} />
        <strong>{inconsistenciesLabel}</strong>
      </div>

      <div className="import-success-actions">
        <button className="secondary-button compact" type="button" onClick={onGoToDashboard}>
          <BarChart3 size={16} />
          Ir para Dashboard
        </button>
        <button className="primary-button compact" type="button" onClick={onNewImport}>
          <FilePlus2 size={16} />
          Nova importacao
        </button>
        <button className="secondary-button compact" type="button" onClick={onViewImport}>
          <Eye size={16} />
          Visualizar importacao
        </button>
      </div>
    </section>
  );
}
