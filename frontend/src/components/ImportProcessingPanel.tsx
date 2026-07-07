import { CheckCircle2, Circle, Loader2 } from "lucide-react";

export type ImportProcessingSummaryItem = {
  label: string;
  value: string;
};

export function ImportProcessingPanel({
  steps,
  currentStepIndex,
  isComplete,
  summaryItems,
}: {
  steps: readonly string[];
  currentStepIndex: number;
  isComplete: boolean;
  summaryItems: ImportProcessingSummaryItem[];
}) {
  const safeStepIndex = Math.min(Math.max(currentStepIndex, 0), Math.max(steps.length - 1, 0));
  const visibleStepIndex = isComplete ? steps.length - 1 : safeStepIndex;
  const progress = steps.length > 0 ? ((visibleStepIndex + 1) / steps.length) * 100 : 0;
  const currentStep = steps[visibleStepIndex] ?? "Processando importacao";
  const nextSteps = isComplete ? [] : steps.slice(visibleStepIndex + 1);

  return (
    <div className={`import-processing-card ${isComplete ? "complete" : "active"}`} role="status" aria-live="polite">
      <header className="import-processing-top">
        <div>
          <strong>{isComplete ? "Importacao concluida com sucesso" : "Processando importacao"}</strong>
          <span>
            {isComplete ? "Abrindo pre-visualizacao..." : `Etapa ${visibleStepIndex + 1} de ${steps.length}`}
          </span>
        </div>
        <span className="processing-stage-badge">{Math.round(progress)}%</span>
      </header>

      <div className="processing-progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      {isComplete ? (
        <div className="processing-complete-summary">
          {summaryItems.map((item) => (
            <span key={item.label}>
              <CheckCircle2 size={16} />
              <strong>{item.value}</strong>
              {item.label}
            </span>
          ))}
          <p>Abrindo pre-visualizacao...</p>
        </div>
      ) : (
        <>
          <section className="processing-current-step" aria-label="Etapa atual">
            <span>Etapa atual</span>
            <div>
              <Loader2 className="processing-current-spinner" size={28} />
              <strong>{currentStep}</strong>
            </div>
          </section>

          {nextSteps.length > 0 && (
            <section className="processing-next-steps" aria-label="Proximas etapas">
              <span>Proximas etapas</span>
              <ol>
                {nextSteps.map((step) => (
                  <li key={step}>
                    <Circle size={13} />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <ol className="processing-step-history" aria-label="Etapas concluidas">
            {steps.slice(0, visibleStepIndex).map((step) => (
              <li key={step}>
                <CheckCircle2 size={15} />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
