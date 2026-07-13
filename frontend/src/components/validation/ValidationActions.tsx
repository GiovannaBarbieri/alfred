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
  const displayProcessingMessage = confirmationSucceeded ? processingMessage : isCompleting ? "Confirmando importacao..." : processingMessage;
  const confirmationSteps = [
    { label: "Validando importacao", status: isCompleting ? "done" : "pending" },
    { label: "Gravando registros", status: confirmationSucceeded ? "done" : isCompleting ? "active" : "pending" },
    { label: "Atualizando estatisticas", status: confirmationSucceeded ? "done" : "pending" },
    { label: "Finalizando importacao", status: confirmationSucceeded ? "done" : "pending" },
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
    { label: "Revisados manualmente", value: manuallyReviewedItems },
    { label: "Automáticos", value: automaticallyClassifiedItems },
    { label: "Duplicidades", value: duplicateGroups },
    { label: "Bloqueios", value: blockingCount },
  ];

  return (
    <section className="validation-confirmation-executive">
      <div className="validation-confirmation-hero">
        <div>
          <span className="eyebrow">Resumo executivo</span>
          <h2>Confirmacao da importacao</h2>
          <p>Revise o que sera salvo e confirme apenas quando tudo estiver pronto.</p>
        </div>
        <span className={`validation-readiness-badge ${readinessTone}`}>
          {isReady ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {isReady ? "Pronto para salvar" : "Revisao necessaria"}
        </span>
      </div>

      <div className="validation-confirmation-layout">
        <div className="validation-confirmation-main">
          <article className="validation-executive-card highlight">
            <div className="validation-executive-card-heading">
              <span>
                <Database size={18} />
              </span>
              <div>
                <h3>Resumo da importacao</h3>
                <p>Dados que serao gravados na base oficial.</p>
              </div>
            </div>

            <div className="validation-save-metrics">
              <div className="wide">
                <Database size={17} />
                <span>Projeto</span>
                <strong>{projectName}</strong>
              </div>
              <div className="wide">
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
                <strong>{isReady ? "Pronto para importacao" : "Revisao pendente"}</strong>
              </div>
            </div>
          </article>

          <div className="validation-executive-grid">
            <article className={`validation-executive-card readiness ${readinessTone}`}>
              <div className="validation-executive-card-heading">
                <span>{isReady ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}</span>
                <div>
                  <h3>{isReady ? "Pronto para salvar" : "Ainda existem pontos de atencao"}</h3>
                  <p>
                    {isReady
                      ? "Validacoes concluidas e sem bloqueios."
                      : "Revise bloqueios, duplicidades ou classificacoes antes de salvar."}
                  </p>
                </div>
              </div>
              {isReady ? (
                <>
                  <div className="validation-ready-checks">
                    <span>
                      <CheckCircle2 size={15} />
                      Todas as validacoes foram concluidas.
                    </span>
                    <span>
                      <CheckCircle2 size={15} />
                      Nenhum bloqueio encontrado.
                    </span>
                    <span>
                      <CheckCircle2 size={15} />
                      Os dados estao prontos para serem gravados definitivamente.
                    </span>
                  </div>
                  <p className="validation-ready-note">
                    Apos confirmar, os dados serao gravados definitivamente.
                  </p>
                </>
              ) : (
                <div className="validation-ready-checks attention">
                  <span>
                    <AlertTriangle size={15} />
                    Existem pontos que ainda precisam de revisao.
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
                  <p>Sinais que liberam a gravacao.</p>
                </div>
              </div>
              <div className="validation-confirmation-checklist">
                <span className={blockingCount === 0 ? "done" : "attention"}>
                  {blockingCount === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {blockingCount} bloqueios
                </span>
                <span className={duplicateGroups === 0 ? "done" : "attention"}>
                  {duplicateGroups === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {duplicateGroups} grupos duplicados
                </span>
                <span className={alertCount === 0 ? "done" : "attention"}>
                  {alertCount === 0 ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                  {alertCount} alertas
                </span>
              </div>
            </article>
          </div>
        </div>

        <aside className="validation-confirmation-side">
          <div className="validation-confirmation-status">
            <span>Status</span>
            <strong>{isReady ? "Importacao pronta" : "Revisao pendente"}</strong>
            <p>Os dados so entram na base oficial apos a confirmacao.</p>
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
                <strong>{confirmationSucceeded ? "Importacao confirmada com sucesso" : "Confirmando importacao..."}</strong>
                <span>{confirmationSucceeded ? "Tudo certo. Voce sera direcionado automaticamente." : "Estamos salvando os dados na base oficial."}</span>
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

          <div className="validation-button-stack">
            <button className="secondary-button compact danger" disabled={isLoading || isCompleting} onClick={onCancel} type="button">
              Descartar importacao
            </button>
            <button className="primary-button compact confirm-import-button" disabled={!canCompleteImport || isCompleting} onClick={onComplete} type="button">
              {isCompleting ? (
                <>
                  <span className="button-spinner" />
                  Confirmando importacao...
                </>
              ) : (
                <>
                  <CheckCircle2 size={17} />
                  Confirmar importacao
                </>
              )}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
