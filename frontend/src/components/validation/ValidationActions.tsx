import type { ImportSessionSummary } from "../../types";

const statusLabels: Record<string, string> = {
  RECEBIDO: "Recebido",
  PROCESSANDO: "Processando",
  VALIDADO: "Validado",
  AGUARDANDO_CONFIRMACAO: "Aguardando confirmação",
  CONFIRMADO: "Confirmado",
  CANCELADO: "Cancelado",
  ERRO: "Erro",
  em_validacao: "Em validação",
  concluida: "Concluída",
  cancelada: "Cancelada",
  reprocessada: "Reprocessada",
};

type ValidationActionsProps = {
  fileName: string;
  session: ImportSessionSummary | null;
  sessionId: number | null;
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
  session,
  sessionId,
  processingMessage,
  error,
  isLoading,
  isCompleting,
  canCompleteImport,
  onReprocess,
  onCancel,
  onComplete,
}: ValidationActionsProps) {
  return (
    <section className="panel validation-actions-panel">
      <div>
        <strong>{fileName}</strong>
        <p className="muted">
          Sessão {session?.sessionId ?? sessionId ?? "-"} em staging. Confira as pendências e confirme para persistir nas tabelas finais.
        </p>
        {session && (
          <span className={`status-badge import-status-${session.status.toLowerCase()}`}>
            {statusLabels[session.status] ?? session.status}
          </span>
        )}
        {processingMessage && (
          <div className="saving-status" role="status" aria-live="polite">
            <span className="loading-dot" />
            {processingMessage}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>
      <div className="validation-button-stack">
        <span className="tooltip-wrap" data-tooltip="Reprocessar refaz a validação da sessão atual usando categorias e perfis mais recentes, sem reenviar a planilha.">
          <button className="secondary-button compact" disabled={isLoading || isCompleting} onClick={onReprocess} type="button">
            Reprocessar
          </button>
        </span>
        <button className="secondary-button compact" disabled={isLoading || isCompleting} onClick={onCancel} type="button">
          Cancelar
        </button>
        <button className="primary-button compact" disabled={!canCompleteImport || isCompleting} onClick={onComplete} type="button">
          {isCompleting ? "Salvando..." : "Confirmar"}
        </button>
      </div>
    </section>
  );
}
