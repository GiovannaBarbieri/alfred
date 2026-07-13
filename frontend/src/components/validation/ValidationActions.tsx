import { AlertTriangle, CheckCircle2, Clock3, Database, FileText, ListChecks, ShieldCheck, Users } from "lucide-react";
import type { ImportValidationResponse } from "../../types";

type ValidationActionsProps = {
  fileName: string;
  result: ImportValidationResponse;
  processingMessage: string | null;
  error: string | null;
  isLoading: boolean;
  isCompleting: boolean;
  canCompleteImport: boolean;
  onReprocess: () => void;
  onCancel: () => void;
  onComplete: () => void;
};

export function ValidationActions({
  fileName,
  result,
  processingMessage,
  error,
  isLoading,
  isCompleting,
  canCompleteImport,
  onReprocess,
  onCancel,
  onComplete,
}: ValidationActionsProps) {
  const totalHours = result.preview?.totalHours ?? 0;
  const collaboratorsCount = result.preview?.collaboratorsCount ?? 0;
  const tasksCount = result.preview?.tasksCount ?? 0;
  const duplicateGroups = result.duplicates.length;
  const blockingCount = result.blockedRows;
  const alertCount = result.alertRows;
  const isReady = canCompleteImport && !error;
  const readinessTone = isReady ? "ready" : "attention";
  const readinessTitle = isReady ? "Tudo pronto para confirmar" : "Ainda existem pontos de atencao";
  const readinessDescription = isReady
    ? "Importacao pronta para confirmacao. Os dados permanecem temporarios ate que a confirmacao seja realizada."
    : "Revise bloqueios, duplicidades ou classificacoes antes de salvar.";
  const displayProcessingMessage = isCompleting ? "Salvando dados no sistema..." : processingMessage;

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
                <h3>O que sera salvo no banco</h3>
                <p>{fileName}</p>
              </div>
            </div>

            <div className="validation-save-metrics">
              <div>
                <FileText size={17} />
                <span>Registros validos</span>
                <strong>{result.validRows}</strong>
              </div>
              <div>
                <Clock3 size={17} />
                <span>Horas</span>
                <strong>{totalHours.toFixed(2)}h</strong>
              </div>
              <div>
                <Users size={17} />
                <span>Colaboradores</span>
                <strong>{collaboratorsCount}</strong>
              </div>
              <div>
                <ListChecks size={17} />
                <span>Tasks</span>
                <strong>{tasksCount}</strong>
              </div>
            </div>
          </article>

          <div className="validation-executive-grid">
            <article className={`validation-executive-card readiness ${readinessTone}`}>
              <div className="validation-executive-card-heading">
                <span>{isReady ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}</span>
                <div>
                  <h3>{readinessTitle}</h3>
                  <p>{readinessDescription}</p>
                </div>
              </div>
            </article>

            <article className="validation-executive-card">
              <div className="validation-executive-card-heading compact">
                <span>
                  <ListChecks size={18} />
                </span>
                <div>
                  <h3>Checklist final</h3>
                  <p>Resumo objetivo antes da persistencia.</p>
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
            <p>Todos os dados permanecem temporarios ate que a confirmacao seja realizada.</p>
          </div>

          {displayProcessingMessage && (
            <div className="saving-status" role="status" aria-live="polite">
              <span className="loading-dot" />
              {displayProcessingMessage}
            </div>
          )}
          {error && <p className="error-text">{error}</p>}

          <div className="validation-button-stack">
            <span
              className="tooltip-wrap"
              data-tooltip="Reprocessar atualiza a revisao usando categorias e perfis mais recentes, sem reenviar a planilha."
            >
              <button className="secondary-button compact" disabled={isLoading || isCompleting} onClick={onReprocess} type="button">
                Reprocessar
              </button>
            </span>
            <button className="secondary-button compact" disabled={isLoading || isCompleting} onClick={onCancel} type="button">
              Cancelar
            </button>
            <button className="primary-button compact" disabled={!canCompleteImport || isCompleting} onClick={onComplete} type="button">
              {isCompleting ? "Salvando..." : "Confirmar importacao"}
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
