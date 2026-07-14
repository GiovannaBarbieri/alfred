import { CheckCircle2, Eye, FilePlus2 } from "lucide-react";
import type { ImportCompletionSnapshot } from "../../hooks/useImportFlow";
import type { ImportCompleteResponse } from "../../types";

type ImportSuccessPanelProps = {
  completion: {
    response: ImportCompleteResponse;
    snapshot: ImportCompletionSnapshot;
  };
  isOpeningProject: boolean;
  redirectError: string | null;
  onNewImport: () => void;
  onViewImport: () => void;
};

function formatHours(value: number) {
  return Number.isInteger(value) ? `${value} horas` : `${value.toFixed(2)} horas`;
}

export function ImportSuccessPanel({
  completion,
  isOpeningProject,
  redirectError,
  onNewImport,
  onViewImport,
}: ImportSuccessPanelProps) {
  const { response, snapshot } = completion;
  const inconsistenciesLabel =
    snapshot.inconsistenciesCount === 0
      ? "Nenhuma inconsistência encontrada"
      : `${snapshot.inconsistenciesCount} inconsistência${snapshot.inconsistenciesCount === 1 ? "" : "s"} registrada${snapshot.inconsistenciesCount === 1 ? "" : "s"}`;
  const statusLabel = isOpeningProject
    ? "Importação concluída com sucesso. Abrindo o projeto..."
    : redirectError
      ? "Importação concluída com sucesso."
      : inconsistenciesLabel;

  return (
    <section className="import-success-panel">
      <div className="import-success-hero">
        <span>
          <CheckCircle2 size={34} />
        </span>
        <div>
          <p className="eyebrow">Fluxo finalizado</p>
          <h2>Importação concluída com sucesso</h2>
          <p>Os dados foram persistidos na base oficial e já podem ser acompanhados nos painéis do ADVISE Gerenciador de horas.</p>
        </div>
      </div>

      <div className="import-success-metrics" aria-label="Resumo da importação concluída">
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
        <strong>{statusLabel}</strong>
      </div>

      {redirectError && <p className="error-text">{redirectError}</p>}

      {redirectError && (
        <div className="import-success-actions">
          <button className="primary-button compact" type="button" onClick={onViewImport} disabled={isOpeningProject}>
            <Eye size={16} />
            {isOpeningProject ? "Abrindo projeto..." : "Abrir projeto"}
          </button>
          <button className="secondary-button compact" type="button" onClick={onNewImport} disabled={isOpeningProject}>
            <FilePlus2 size={16} />
            Nova importação
          </button>
        </div>
      )}

      {!redirectError && !isOpeningProject && (
        <div className="import-success-actions">
          <button className="primary-button compact" type="button" onClick={onNewImport}>
            <FilePlus2 size={16} />
            Nova importação
          </button>
        </div>
      )}
    </section>
  );
}
