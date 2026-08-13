import { Eye, Trash2 } from "lucide-react";
import type { ReportActionState, SavedReportListItem } from "../../types";
import {
  formatReportDate,
  formatReportDateTime,
  formatReportHours,
  formatReportNumber,
} from "../../utils/reportHistoryPresentation";

export function ReportCard({
  report,
  opening,
  onOpen,
  onAction,
}: {
  report: SavedReportListItem;
  opening: boolean;
  onOpen: () => void;
  onAction: (action: Exclude<ReportActionState, null>) => void;
}) {
  return (
    <article className="panel saved-report-card">
      <div className="saved-report-card-main">
        <div className="saved-report-card-heading">
          <div>
            <div className="saved-report-badges">
              <span className="saved-report-type">Indicadores Gerais</span>
            </div>
            <h2>{report.name}</h2>
            <p className="saved-report-period">
              <span>{formatReportDate(report.periodStart)} → {formatReportDate(report.periodEnd)}</span>
              <small>Salvo em {formatReportDateTime(report.finalizedAt)}</small>
            </p>
          </div>
        </div>
        <div className="saved-report-card-summary">
          <strong>{formatReportHours(report.totalHours)} · {formatReportNumber(report.consideredLaunchCount)} lançamentos</strong>
        </div>
        {report.responsible && <p className="saved-report-responsible">Responsável: <strong>{report.responsible}</strong></p>}
      </div>

      <div className="saved-report-card-actions">
        <button className="primary-button" type="button" onClick={onOpen} disabled={opening}>
          <Eye size={16} />
          {opening ? "Abrindo..." : "Abrir"}
        </button>
        <button className="saved-report-delete" type="button" onClick={() => onAction({ type: "delete", report })}>
          <Trash2 size={15} />
          Excluir
        </button>
      </div>
    </article>
  );
}
