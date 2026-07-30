import { useState } from "react";

import { ReportPeriodAnalysisPanel } from "./ReportPeriodAnalysisPanel";
import { ReportPeriodsComparisonPanel } from "./ReportPeriodsComparisonPanel";

type AnalysisType = "period" | "comparison";

const analysisOptions: Array<{ id: AnalysisType; label: string }> = [
  { id: "period", label: "Por período" },
  { id: "comparison", label: "Comparação" },
];

export function ReportAnalysesPanel({
  reportId,
  officialStart,
  officialEnd,
}: {
  reportId: number;
  officialStart: string;
  officialEnd: string;
}) {
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisType>("period");

  return (
    <section className="saved-report-analyses" aria-label="Análises">
      <div className="saved-report-analyses-header">
        <span>Tipos de análise</span>
        <nav className="saved-report-analysis-selector" aria-label="Tipo de análise">
          {analysisOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={activeAnalysis === option.id ? "active" : undefined}
              aria-pressed={activeAnalysis === option.id}
              onClick={() => setActiveAnalysis(option.id)}
            >
              {option.label}
            </button>
          ))}
        </nav>
      </div>

      {activeAnalysis === "period" && (
        <ReportPeriodAnalysisPanel
          reportId={reportId}
          officialStart={officialStart}
          officialEnd={officialEnd}
        />
      )}
      {activeAnalysis === "comparison" && (
        <ReportPeriodsComparisonPanel
          reportId={reportId}
          officialStart={officialStart}
          officialEnd={officialEnd}
        />
      )}
    </section>
  );
}
