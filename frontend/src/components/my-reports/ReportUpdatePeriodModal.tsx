import { RefreshCw } from "lucide-react";

export function ReportUpdatePeriodModal({
  draft,
  busy,
  error,
  onChange,
  onCancel,
  onConfirm,
}: {
  draft: { startDate: string; endDate: string };
  busy: boolean;
  error: string | null;
  onChange: (field: "startDate" | "endDate", value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const errors = validateUpdatePeriod(draft);
  const invalid = Boolean(errors.startDate || errors.endDate);
  return (
    <div className="saved-report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div className="saved-report-modal saved-report-update-modal" role="dialog" aria-modal="true" aria-labelledby="saved-report-update-title">
        <header>
          <span><RefreshCw size={20} /></span>
          <div>
            <h2 id="saved-report-update-title">Atualizar relatório</h2>
            <p>Informe o período que será utilizado na atualização.</p>
          </div>
        </header>
        <div className="saved-report-update-period-fields">
          <label>
            <span>Data inicial</span>
            <input type="date" value={draft.startDate} disabled={busy} aria-invalid={Boolean(errors.startDate)} onChange={(event) => onChange("startDate", event.target.value)} />
            {errors.startDate && <small role="alert">{errors.startDate}</small>}
          </label>
          <label>
            <span>Data final</span>
            <input type="date" value={draft.endDate} disabled={busy} aria-invalid={Boolean(errors.endDate)} onChange={(event) => onChange("endDate", event.target.value)} />
            {errors.endDate && <small role="alert">{errors.endDate}</small>}
          </label>
        </div>
        {error && <div className="error-banner" role="alert">{error}</div>}
        <footer>
          <button className="secondary-button" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
          <button className="primary-button" type="button" onClick={onConfirm} disabled={busy || invalid}>{busy ? "Atualizando..." : "Atualizar relatório"}</button>
        </footer>
      </div>
    </div>
  );
}

function validateUpdatePeriod(draft: { startDate: string; endDate: string }) {
  const errors: { startDate?: string; endDate?: string } = {};
  if (!draft.startDate) errors.startDate = "Informe a data inicial.";
  if (!draft.endDate) errors.endDate = "Informe a data final.";
  if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
    errors.endDate = "A data final não pode ser anterior à data inicial.";
  }
  return errors;
}
