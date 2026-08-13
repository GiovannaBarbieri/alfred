import { Eye, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getReportDetail } from "../../services/reportHistoryService";
import type { ReportActionState, SavedReportListItem } from "../../types";
import {
  formatKpiStatus,
  formatReportDate,
  formatReportDateTime,
  formatReportHours,
  formatReportNumber,
  formatReportPercentage,
} from "../../utils/reportHistoryPresentation";

type ReportKpiReference = {
  projectsTarget: number | null;
  errorsLimit: number | null;
};

const kpiReferenceCache = new Map<number, ReportKpiReference>();

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
  const [kpiReference, setKpiReference] = useState<ReportKpiReference | null>(() => kpiReferenceCache.get(report.id) ?? null);

  useEffect(() => {
    const cached = kpiReferenceCache.get(report.id);
    if (cached) {
      setKpiReference(cached);
      return;
    }

    let ignore = false;
    async function loadKpiReference() {
      try {
        const detail = await getReportDetail(report.id);
        const reference = {
          projectsTarget: detail.snapshot.kpis.projectsImprovements.target ?? null,
          errorsLimit: detail.snapshot.kpis.errorsBugs.limit ?? null,
        };
        kpiReferenceCache.set(report.id, reference);
        if (!ignore) setKpiReference(reference);
      } catch {
        if (!ignore) setKpiReference(null);
      }
    }
    void loadKpiReference();
    return () => { ignore = true; };
  }, [report.id]);

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

        <div className="saved-report-metrics">
          <Metric label="Total de horas" value={formatReportHours(report.totalHours)} variant="operational" />
          <Metric label="Lançamentos considerados" value={formatReportNumber(report.consideredLaunchCount)} variant="operational" />
          <Metric label="Colaboradores excluídos" value={formatReportNumber(report.excludedCollaboratorCount)} variant="operational" />
          <Metric
            label="Novos projetos + melhorias"
            value={formatReportPercentage(report.projectsImprovementsPercentage)}
            reference={formatTargetReference("Meta ≥", kpiReference?.projectsTarget)}
            detail={formatKpiStatus(report.projectsImprovementsStatus)}
            tone={report.projectsImprovementsStatus}
            variant="strategic"
          />
          <Metric
            label="Erros de TI + bugs"
            value={formatReportPercentage(report.errorsBugsPercentage)}
            reference={formatTargetReference("Limite ≤", kpiReference?.errorsLimit)}
            detail={formatKpiStatus(report.errorsBugsStatus)}
            tone={report.errorsBugsStatus}
            variant="strategic"
          />
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

function Metric({
  label,
  value,
  reference,
  detail,
  tone,
  variant = "operational",
}: {
  label: string;
  value: string;
  reference?: string;
  detail?: string;
  tone?: string | null;
  variant?: "operational" | "strategic";
}) {
  return (
    <div className={`saved-report-metric ${variant} ${tone ?? ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {reference && <small className="saved-report-metric-reference">{reference}</small>}
      {detail && <small className="saved-report-metric-status">{detail}</small>}
    </div>
  );
}

function formatTargetReference(label: string, value: number | null | undefined) {
  return value === null || value === undefined ? undefined : `${label} ${formatReportPercentage(value)}`;
}
