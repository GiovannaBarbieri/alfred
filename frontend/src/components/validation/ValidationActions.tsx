import { AlertTriangle, CheckCircle2, Clock3, Database, FileText, ListChecks, ShieldCheck, Users } from "lucide-react";
import type { ImportValidationResponse } from "../../types";

type ValidationActionsProps = {
  fileName: string;
  result: ImportValidationResponse;
  classificationOverrides: Record<number, { category: string; subcategory: string }>;
  processingMessage: string | null;
  error: string | null;
  isLoading: boolean;
  isCompleting: boolean;
  canCompleteImport: boolean;
  onCancel: () => void;
  onComplete: () => void;
};

export function ValidationActions({
  fileName,
  result,
  classificationOverrides,
  processingMessage,
  error,
  isLoading,
  isCompleting,
  canCompleteImport,
  onCancel,
  onComplete,
}: ValidationActionsProps) {
  const projectName = fileName.replace(/\.[^.]+$/, "");
  const totalHours = result.preview?.totalHours ?? 0;
  const collaboratorsCount = result.preview?.collaboratorsCount ?? 0;
  const tasksCount = result.preview?.tasksCount ?? 0;
  const categoriesCount =
    result.preview?.categoriesCount ??
    new Set(
      result.classifications
        .map((classification) => classificationOverrides[classification.line]?.category ?? classification.category)
        .filter((category) => category && category !== "Nao classificado"),
    ).size;
  const subcategoriesCount = new Set(
    result.classifications
      .map((classification) => classificationOverrides[classification.line]?.subcategory ?? classification.subcategory)
      .filter((subcategory) => subcategory && subcategory !== "Nao classificado" && subcategory !== "Nao aplicavel"),
  ).size;
  const manuallyReviewedItems = Object.keys(classificationOverrides).length;
  const automaticallyClassifiedItems = Math.max(result.validRows - manuallyReviewedItems, 0);
  const duplicateGroups = result.duplicates.length;
  const blockingCount = result.blockedRows;
  const alertCount = result.alertRows;
  const isReady = canCompleteImport && !error;
  const readinessTone = isReady ? "ready" : "attention";
  const confirmationSucceeded = Boolean(processingMessage?.toLowerCase().includes("confirmada"));
  const displayProcessingMessage = confirmationSucceeded ? processingMessage : isCompleting ? "Confirmando importação..." : null;
  const confirmationSteps = [
    { label: "Validando importação", status: isCompleting ? "done" : "pending" },
    { label: "Gravando registros", status: confirmationSucceeded ? "done" : isCompleting ? "active" : "pending" },
    { label: "Atualizando estatísticas", status: confirmationSucceeded ? "done" : "pending" },
    { label: "Finalizando importação", status: confirmationSucceeded ? "done" : "pending" },
  ];
  const primaryMetrics = [
    { icon: <Clock3 size={17} />, label: "Horas", value: `${totalHours.toFixed(2)}h` },
    { icon: <FileText size={17} />, label: "Registros", value: result.validRows },
    { icon: <ListChecks size={17} />, label: "Tasks", value: tasksCount },
    { icon: <Users size={17} />, label: "Colaboradores", value: collaboratorsCount },
  ];
  const secondaryMetrics = [
    { label: "Categorias", value: categoriesCount },
    { label: "Subcategorias", value: subcategoriesCount },
    { label: "Itens revisados manualmente", value: manuallyReviewedItems },
    { label: "Classificados automaticamente", value: automaticallyClassifiedItems },
    { label: "Duplicidades", value: duplicateGroups },
    { label: "Bloqueios", value: blockingCount },
  ];

  return (
    <section className="validation-confirmation-executive">
      <div className="validation-confirmation-layout">
        <div className="validation-confirmation-main">
          <article className="validation-executive-card highlight">
            <div className="validation-executive-card-heading">
              <span>
                <Database size={18} />
              </span>
              <div>
                <h3>Resumo da importação</h3>
                <p>Dados que serão gravados na base oficial.</p>
              </div>
            </div>

            <div className="validation-save-metrics">
              <div className="wide project-context">
                <Database size={17} />
                <span>Projeto</span>
                <strong>{projectName}</strong>
              </div>
              <div className="wide file-context">
                <FileText size={17} />
                <span>Arquivo</span>
                <strong>{fileName}</strong>
              </div>
              {primaryMetrics.map((metric) => (
                <div className="primary" key={metric.label}>
                  {metric.icon}
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
              {secondaryMetrics.map((metric) => (
                <div className="compact" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                </div>
              ))}
              <div className={`status ${isReady ? "ready" : "attention"}`}>
                {isReady ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                <span>Status</span>
                <strong>{isReady ? "Sem bloqueios" : "Revisão pendente"}</strong>
              </div>
            </div>
          </article>

          <div className="validation-executive-grid">
            <article className={`validation-executive-card readiness ${readinessTone}`}>
              <div className="validation-executive-card-heading">
                <span>{isReady ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}</span>
                <div>
                  <h3>{isReady ? "Conferência final" : "Ainda existem pontos de atenção"}</h3>
                  <p>
                    {isReady
                      ? "Validações concluídas e sem bloqueios."
                      : "Revise bloqueios, duplicidades ou classificações antes de salvar."}
                  </p>
                </div>
              </div>
              {isReady ? (
                <>
                  <div className="validation-ready-checks">
                    <span>
                      <CheckCircle2 size={15} />
                      Todas as validações foram concluídas.
                    </span>
                    <span>
                      <CheckCircle2 size={15} />
                      Nenhum bloqueio encontrado.
                    </span>
                    <span>
                      <CheckCircle2 size={15} />
                      Os dados estão prontos para serem gravados definitivamente.
                    </span>
                  </div>
                  <p className="validation-ready-note">
                    Após confirmar, os dados serão gravados definitivamente.
                  </p>
                </>
              ) : (
                <div className="validation-ready-checks attention">
                  <span>
                    <AlertTriangle size={15} />
                    Existem pontos que ainda precisam de revisão.
                  </span>
                </div>
              )}
            </article>

            <article className="validation-executive-card">
              <div className="validation-executive-card-heading compact">
                <span>
                  <ListChecks size={18} />
                </span>
                <div>
                  <h3>Checklist final</h3>
                  <p>Sinais que liberam a gravação.</p>
                </div>
              </div>
              <ul className="validation-confirmation-checklist">
                <li className={blockingCount === 0 ? "done" : "attention"}>
                  {blockingCount === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {blockingCount === 0 ? "Nenhum bloqueio encontrado" : `${blockingCount} bloqueio${blockingCount === 1 ? "" : "s"} encontrado${blockingCount === 1 ? "" : "s"}`}
                </li>
                <li className={duplicateGroups === 0 ? "done" : "attention"}>
                  {duplicateGroups === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {duplicateGroups === 0 ? "Nenhuma duplicidade encontrada" : `${duplicateGroups} grupo${duplicateGroups === 1 ? "" : "s"} duplicado${duplicateGroups === 1 ? "" : "s"}`}
                </li>
                <li className={alertCount === 0 ? "done" : "attention"}>
                  {alertCount === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {alertCount === 0 ? "Nenhum alerta pendente" : `${alertCount} alerta${alertCount === 1 ? "" : "s"} pendente${alertCount === 1 ? "" : "s"}`}
                </li>
              </ul>
            </article>
          </div>
        </div>

        <aside className="validation-confirmation-side">
          <div className="validation-confirmation-actions-title">
            <span>Área de decisão</span>
            <strong>Ações da importação</strong>
          </div>

          <div className="validation-button-stack">
            <button className="primary-button compact confirm-import-button" disabled={!canCompleteImport || isCompleting} onClick={onComplete} type="button">
              {isCompleting ? (
                <>
                  <span className="button-spinner" />
                  Confirmando importação...
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  Confirmar importação
                </>
              )}
            </button>
            <button className="secondary-button compact danger" disabled={isLoading || isCompleting} onClick={onCancel} type="button">
              Descartar importação
            </button>
          </div>

          <div className="validation-confirmation-side-separator" aria-hidden="true" />

          <div className="validation-confirmation-status">
            <span>Status</span>
            <strong>{isReady ? "Sem bloqueios" : "Revisão pendente"}</strong>
            <p>Os dados serão gravados na base oficial somente após a confirmação.</p>
          </div>

          {displayProcessingMessage && (
            <div className="saving-status" role="status" aria-live="polite">
              <span className="loading-dot" />
              {displayProcessingMessage}
            </div>
          )}
          {isCompleting && (
            <div className={`validation-confirmation-progress ${confirmationSucceeded ? "complete" : ""}`} role="status" aria-live="polite">
              <div>
                <strong>{confirmationSucceeded ? "Importação confirmada com sucesso" : "Confirmando importação..."}</strong>
                <span>{confirmationSucceeded ? "Tudo certo. Você será direcionado automaticamente." : "Estamos salvando os dados na base oficial."}</span>
              </div>
              <ol>
                {confirmationSteps.map((step) => (
                  <li className={step.status} key={step.label}>
                    {step.status === "done" && <CheckCircle2 size={15} />}
                    {step.status === "active" && <span className="button-spinner" />}
                    {step.status === "pending" && <i />}
                    {step.label}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {error && <p className="error-text">{error}</p>}
        </aside>
      </div>
    </section>
  );
}
