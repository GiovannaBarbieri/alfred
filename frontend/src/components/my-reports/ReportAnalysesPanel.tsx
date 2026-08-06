import { ReportPeriodAnalysisPanel } from "./ReportPeriodAnalysisPanel";

export function ReportAnalysesPanel({
  reportId,
  officialStart,
  officialEnd,
}: {
  reportId: number;
  officialStart: string;
  officialEnd: string;
}) {
  return (
    <section className="saved-report-analyses" aria-label="Análises">
      <div className="saved-report-analyses-header">
        <span>Tipo de análise</span>
        <nav className="saved-report-analysis-selector" aria-label="Tipo de análise">
          <button type="button" className="active" aria-current="page">
            Por período
          </button>
        </nav>
      </div>

      <ReportPeriodAnalysisPanel
        reportId={reportId}
        officialStart={officialStart}
        officialEnd={officialEnd}
      />
    </section>
  );
}
