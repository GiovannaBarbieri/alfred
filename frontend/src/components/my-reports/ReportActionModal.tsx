import { AlertTriangle, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { ReportActionState } from "../../types";
import { formatReportDate } from "../../utils/reportHistoryPresentation";

type ActiveAction = Exclude<ReportActionState, null>;

export function ReportActionModal({
  action,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  action: ActiveAction;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const destructive = true;
  const copy = modalCopy();

  useEffect(() => {
    setAcknowledged(false);
    dialogRef.current?.focus();
  }, [action.report.id, action.type]);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  function keepFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
    if (!elements.length) return;
    const first = elements[0]; const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="saved-report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="saved-report-modal" role="dialog" aria-modal="true" aria-labelledby="saved-report-modal-title" tabIndex={-1} onKeyDown={keepFocus}>
        <header><span className={destructive ? "danger" : ""}>{copy.icon}</span><div><h2 id="saved-report-modal-title">{copy.title}</h2><p>{copy.description}</p></div><button type="button" aria-label="Fechar modal" onClick={onClose} disabled={busy}><X size={18} /></button></header>
        <div className="saved-report-modal-report">
          <strong>{action.report.name}</strong>
          <span>{formatReportDate(action.report.periodStart)} a {formatReportDate(action.report.periodEnd)}</span>
          <span>Revisão atual {action.report.currentRevisionNumber}</span>
        </div>
        {destructive && <>
          <div className="saved-report-permanent-warning"><AlertTriangle size={18} /><p>Esta ação excluirá permanentemente o relatório anual e todo o seu histórico de atualizações.<strong>Não será possível desfazer.</strong></p></div>
          <label className="saved-report-confirm-check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />Entendo que esta ação não poderá ser desfeita.</label>
        </>}
        {error && <div className="error-banner" role="alert"><AlertTriangle size={17} />{error}</div>}
        <footer><button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className={destructive ? "danger-button" : "primary-button"} type="button" onClick={onConfirm} disabled={busy || (destructive && !acknowledged)}>{busy ? "Processando..." : copy.confirm}</button></footer>
      </div>
    </div>
  );
}

function modalCopy() {
  return { title: "Excluir relatório anual?", description: "Confirme os dados antes de realizar a exclusão permanente.", confirm: "Excluir permanentemente", icon: <Trash2 size={20} /> };
}
