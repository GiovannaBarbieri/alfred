export type ImportWizardStep = "upload" | "preview" | "validation" | "duplicates" | "classification" | "confirm";

const importWizardSteps: Array<{ id: ImportWizardStep; title: string }> = [
  { id: "upload", title: "Upload" },
  { id: "preview", title: "Pré-visualização" },
  { id: "duplicates", title: "Duplicidades" },
  { id: "classification", title: "Classificação" },
  { id: "confirm", title: "Confirmar" },
];

export function ImportWizard({
  activeStep,
  availableSteps,
  completed,
  disabled,
  onStepChange,
}: {
  activeStep: ImportWizardStep;
  availableSteps?: ImportWizardStep[];
  completed: boolean;
  disabled: boolean;
  onStepChange: (step: ImportWizardStep) => void;
}) {
  const activeIndex = importWizardSteps.findIndex((step) => step.id === activeStep);
  const availableStepSet = new Set(availableSteps ?? importWizardSteps.map((step) => step.id));

  return (
    <section className="panel import-wizard" aria-label="Etapas da importação">
      {importWizardSteps.map((step, index) => {
        const isActive = step.id === activeStep;
        const isDone = completed && index < activeIndex;
        const isUnavailable = step.id !== "upload" && !availableStepSet.has(step.id);

        return (
          <button
            className={`wizard-step ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${isUnavailable ? "unavailable" : ""}`}
            disabled={(disabled && step.id !== "upload") || isUnavailable}
            key={step.id}
            type="button"
            onClick={() => onStepChange(step.id)}
            title={isUnavailable ? "Nada para revisar nesta etapa" : undefined}
          >
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
          </button>
        );
      })}
    </section>
  );
}
