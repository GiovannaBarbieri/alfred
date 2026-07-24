import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AnnualReportDetail } from "../../types";
import { formatReportDate } from "../../utils/reportHistoryPresentation";

export function AnnualReportUpdateModal({
  detail,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  detail: AnnualReportDetail;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (newPeriodEnd: string) => void;
}) {
  const [newPeriodEnd, setNewPeriodEnd] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { report } = detail;

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [busy, onClose]);

  function submit() {
    if (!newPeriodEnd) return setValidation("Informe a nova data final.");
    if (newPeriodEnd <= report.periodEnd) return setValidation("A nova data final deve ser posterior ao período atual.");
    if (Number(newPeriodEnd.slice(0, 4)) !== report.year) return setValidation("A nova data final deve pertencer ao mesmo ano do relatório.");
    setValidation(null);
    onConfirm(newPeriodEnd);
  }

  function keepFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const elements = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") ?? []);
    if (!elements.length) return;
    const first = elements[0]; const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="saved-report-modal-backdrop" role="presentation">
      <div ref={dialogRef} className="saved-report-modal annual-report-update-modal" role="dialog" aria-modal="true" aria-labelledby="annual-update-title" tabIndex={-1} onKeyDown={keepFocus}>
        <header>
          <span><RefreshCw size={20} /></span>
          <div><h2 id="annual-update-title">Atualizar relatório de {report.year}</h2><p>Defina até qual data o relatório anual deve ser atualizado.</p></div>
          <button type="button" aria-label="Fechar modal" onClick={onClose} disabled={busy}><X size={18} /></button>
        </header>
        <div className="annual-report-update-fields">
          <label><span>Início do período</span><input type="date" value={report.periodStart} disabled /></label>
          <label><span>Período atual até</span><input type="date" value={report.periodEnd} disabled /></label>
          <label><span>Novo período final</span><input type="date" min={nextDate(report.periodEnd)} max={`${report.year}-12-31`} value={newPeriodEnd} onChange={(event) => { setNewPeriodEnd(event.target.value); setValidation(null); }} disabled={busy} required /></label>
        </div>
        <p className="annual-report-update-help">O Alfred consultará novamente todo o período, de {formatReportDate(report.periodStart)} até a nova data final.</p>
        {(validation || error) && <div className="error-banner" role="alert"><AlertTriangle size={17} />{validation || error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="primary-button" type="button" onClick={submit} disabled={busy}>{busy ? "Iniciando..." : "Atualizar dados"}</button>
        </footer>
      </div>
    </div>
  );
}

function nextDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 1));
  return date.toISOString().slice(0, 10);
}
