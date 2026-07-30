import type { ReportPeriodAnalysisResponse } from "../types";

type ReportPeriodAnalysisExtendedFields =
  | "reportName"
  | "summary"
  | "granularity"
  | "evolution"
  | "appliedWeights";

export type ReportPeriodAnalysisWireResponse =
  Omit<ReportPeriodAnalysisResponse, ReportPeriodAnalysisExtendedFields>
  & Partial<Pick<ReportPeriodAnalysisResponse, ReportPeriodAnalysisExtendedFields>>;

export function normalizePeriodAnalysisResponse(
  payload: ReportPeriodAnalysisWireResponse,
): ReportPeriodAnalysisResponse {
  const projectsImprovements = payload.kpis.projectsImprovements;
  const errorsBugs = payload.kpis.errorsBugs;
  return {
    ...payload,
    reportName: payload.reportName ?? "",
    summary: payload.summary ?? {
      totalHours: payload.totalHours,
      consideredLaunchCount: payload.recordCount,
      projectsImprovementsHours: projectsImprovements.hours,
      projectsImprovementsPercentage: projectsImprovements.percentage,
      errorsBugsHours: errorsBugs.hours,
      errorsBugsPercentage: errorsBugs.percentage,
    },
    granularity: payload.granularity ?? "MONTH",
    evolution: payload.evolution ?? payload.months ?? [],
    appliedWeights: payload.appliedWeights ?? [],
  };
}
