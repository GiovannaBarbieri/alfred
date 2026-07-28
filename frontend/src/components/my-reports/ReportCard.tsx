import { Eye, Trash2 } from "lucide-react";
import type { ReportActionState, SavedReportListItem } from "../../types";
import {
  formatKpiStatus,
  formatReportDate,
  formatReportDateTime,
  formatReportHours,
  formatReportNumber,
  formatReportPercentage,
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
            <p>Período consultado: {formatReportDate(report.periodStart)} a {formatReportDate(report.periodEnd)} · Salvo em {formatReportDateTime(report.finalizedAt)}</p>
          </div>
        </div>

        <div className="saved-report-metrics">
          <Metric label="Total de horas" value={formatReportHours(report.totalHours)} />
          <Metric label="Lançamentos considerados" value={formatReportNumber(report.consideredLaunchCount)} />
          <Metric label="Colaboradores excluídos" value={formatReportNumber(report.excludedCollaboratorCount)} />
          <Metric label="Novos projetos + melhorias" value={formatReportPercentage(report.projectsImprovementsPercentage)} detail={formatKpiStatus(report.projectsImprovementsStatus)} tone={report.projectsImprovementsStatus} />
          <Metric label="Erros de TI + bugs" value={formatReportPercentage(report.errorsBugsPercentage)} detail={formatKpiStatus(report.errorsBugsStatus)} tone={report.errorsBugsStatus} />
        </div>
        {report.responsible && <p className="saved-report-responsible">Responsável: <strong>{report.responsible}</strong></p>}
      </div>

      <div className="saved-report-card-actions">
        <button className="primary-button" type="button" onClick={onOpen} disabled={opening}><Eye size={16} />{opening ? "Abrindo..." : "Abrir relatório"}</button>
        <button className="saved-report-delete" type="button" onClick={() => onAction({ type: "delete", report })}><Trash2 size={16} />Excluir</button>
      </div>
    </article>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: string | null }) {
  return <div className={`saved-report-metric ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div>;
}
