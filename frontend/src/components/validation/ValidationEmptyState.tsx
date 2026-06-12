import { ClipboardCheck } from "lucide-react";

type ValidationEmptyStateProps = {
  onGoToImport: () => void;
};

export function ValidationEmptyState({ onGoToImport }: ValidationEmptyStateProps) {
  return (
    <section className="panel empty-state-panel">
      <div className="panel-heading">
        <ClipboardCheck size={20} />
        <h2>Nenhuma planilha em validacao</h2>
      </div>
      <p className="muted">Importe uma planilha para revisar bloqueios, alertas, duplicidades e classificacoes.</p>
      <button className="primary-button compact" type="button" onClick={onGoToImport}>
        Ir para importacao
      </button>
    </section>
  );
}
