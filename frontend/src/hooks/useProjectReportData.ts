import { useMemo } from "react";

import { timelineCharts, type TimelineChartId } from "../components/reports/reportsConfig";
import { buildExportUrl } from "../services/api";
import type { ImportSummary, ProjectTimelineCharts } from "../types";
import { projectTitleFromFilename } from "../utils/project";

type UseProjectReportDataParams = {
  imports: ImportSummary[];
  selectedImportId: number | null;
  selectedCollaborator: string;
  projectTimelineCharts: ProjectTimelineCharts;
  projectSearch: string;
  selectedChartId: TimelineChartId;
};

export function useProjectReportData({
  imports,
  selectedImportId,
  selectedCollaborator,
  projectTimelineCharts,
  projectSearch,
  selectedChartId,
}: UseProjectReportDataParams) {
  const selectedImport = imports.find((item) => item.id === selectedImportId) ?? null;
  const selectedChart = timelineCharts.find((chart) => chart.id === selectedChartId) ?? timelineCharts[0];
  const projectTitle = selectedImport ? projectTitleFromFilename(selectedImport.filename) : "";
  const importedAt = selectedImport ? new Date(selectedImport.importedAt).toLocaleDateString("pt-BR") : "";
  const excelExportUrl = selectedImportId
    ? buildExportUrl("/exports/project-analysis.xlsx", undefined, {
        importId: String(selectedImportId),
        ...(selectedCollaborator ? { user: selectedCollaborator } : {}),
      })
    : "#";

  const collaboratorOptions = useMemo(
    () =>
      Array.from(
        new Set(projectTimelineCharts.dailyByUser.map((item) => item.series).filter((item): item is string => Boolean(item))),
      ).sort((a, b) => a.localeCompare(b)),
    [projectTimelineCharts.dailyByUser],
  );

  const filteredImports = useMemo(() => {
    const search = projectSearch.trim().toLowerCase();
    if (!search) return imports;
    return imports.filter((item) => projectTitleFromFilename(item.filename).toLowerCase().includes(search));
  }, [imports, projectSearch]);

  return {
    selectedImport,
    selectedChart,
    projectTitle,
    importedAt,
    excelExportUrl,
    collaboratorOptions,
    filteredImports,
  };
}
