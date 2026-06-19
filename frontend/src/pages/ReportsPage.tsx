import { useEffect, useState } from "react";

import { ProjectChartsPanel } from "../components/reports/ProjectChartsPanel";
import { ProjectCollaboratorTasksPanel } from "../components/reports/ProjectCollaboratorTasksPanel";
import { ProjectDownloadMenu } from "../components/reports/ProjectDownloadMenu";
import { ProjectOverviewPanel } from "../components/reports/ProjectOverviewPanel";
import { ProjectPdfReport } from "../components/reports/ProjectPdfReport";
import { ProjectReportHeader } from "../components/reports/ProjectReportHeader";
import { ProjectReportTabs } from "../components/reports/ProjectReportTabs";
import { ReportLandingView } from "../components/reports/ReportLandingView";
import { ReportNotice } from "../components/reports/ReportNotice";
import {
  type ProjectTabId,
  type ReportLandingTabId,
  type TaskSortId,
  type TimelineChartId,
} from "../components/reports/reportsConfig";
import { useProjectCollaboratorTaskLoader } from "../hooks/useProjectCollaboratorTaskLoader";
import { useProjectCollaboratorTasks } from "../hooks/useProjectCollaboratorTasks";
import { useProjectComparisons } from "../hooks/useProjectComparisons";
import { useProjectEvolution } from "../hooks/useProjectEvolution";
import { useProjectExports } from "../hooks/useProjectExports";
import { useProjectPendingQueue } from "../hooks/useProjectPendingQueue";
import { useProjectReportData } from "../hooks/useProjectReportData";
import type {
  ImportSummary,
  ProjectExecutiveSummary,
  ProjectInsights,
  ProjectPendingItems,
  ProjectRecommendation,
  ProjectTimelineCharts,
} from "../types";

export type ReportViewId = "user" | "epic" | "pbi" | "category" | "subcategory";

type ReportNoticeState = { tone: "success" | "error"; message: string };

export function ReportsPage({
  imports,
  selectedImportId,
  projectTimelineCharts,
  projectExecutiveSummary,
  projectPendingItems,
  projectInsights,
  projectRecommendations,
  onOpenProject,
}: {
  imports: ImportSummary[];
  selectedImportId: number | null;
  projectTimelineCharts: ProjectTimelineCharts;
  projectExecutiveSummary: ProjectExecutiveSummary;
  projectPendingItems: ProjectPendingItems;
  projectInsights: ProjectInsights;
  projectRecommendations: ProjectRecommendation[];
  onOpenProject: (importId: number) => void;
}) {
  const [projectSearch, setProjectSearch] = useState("");
  const [reportNotice, setReportNotice] = useState<ReportNoticeState | null>(null);
  const {
    evolutionOptions,
    selectedEvolutionProject,
    projectEvolution,
    isLoadingEvolution,
    evolutionError,
    evolutionExportUrl,
    setSelectedEvolutionProject,
    setProjectEvolution,
    loadEvolution,
  } = useProjectEvolution();
  const {
    comparisonSelection,
    projectComparison,
    isLoadingComparison,
    comparisonError,
    savedComparisons,
    saveComparisonName,
    isLoadingSavedComparisons,
    savedComparisonActionId,
    isSavingComparison,
    savedComparisonError,
    comparisonExportUrl,
    comparisonProjectOptions,
    setSaveComparisonName,
    toggleComparisonSelection,
    clearComparison,
    compareProjects,
    compareEvolutionImports,
    saveComparison,
    openSavedComparison,
    deleteSavedComparison,
  } = useProjectComparisons({ imports, projectEvolution, onNotice: setReportNotice });
  const [selectedChartId, setSelectedChartId] = useState<TimelineChartId>("dailyTotal");
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTabId>("executive");
  const [reportLandingTab, setReportLandingTab] = useState<ReportLandingTabId>("projects");
  const [nextProjectTab, setNextProjectTab] = useState<ProjectTabId | null>(null);
  const [isSmartSummaryOpen, setIsSmartSummaryOpen] = useState(false);
  const [isProjectInsightsOpen, setIsProjectInsightsOpen] = useState(false);
  const [isExecutiveSummaryOpen, setIsExecutiveSummaryOpen] = useState(false);
  const {
    showDownloadMenu,
    showPdfOptions,
    isPreparingPdf,
    pdfOptions,
    toggleDownloadMenu,
    closeDownloadMenu,
    showPdfOptionsPanel,
    closePdfOptions,
    setPdfOptions,
    preparePdf,
  } = useProjectExports();
  const {
    selectedCollaborator,
    collaboratorTasks,
    taskSearch,
    taskCategoryFilter,
    taskSort,
    isLoadingTasks,
    tasksError,
    setSelectedCollaborator,
    setTaskSearch,
    setTaskCategoryFilter,
    setTaskSort,
    resetCollaboratorTasks,
  } = useProjectCollaboratorTaskLoader(selectedImportId);
  const { taskCategoryOptions, filteredCollaboratorTasks, collaboratorTasksTotal } = useProjectCollaboratorTasks({
    collaboratorTasks,
    taskSearch,
    taskCategoryFilter,
    taskSort,
  });
  const {
    pendingStatusSummary,
    openPendingByType,
    openPendingPreview,
  } = useProjectPendingQueue({
    projectPendingItems,
    pendingSearch: "",
    pendingTypeFilter: "all",
    pendingStatusFilter: "pendente",
    pendingUserFilter: "",
    selectedPendingIds: [],
  });
  const {
    selectedImport,
    selectedChart,
    projectTitle,
    importedAt,
    excelExportUrl,
    collaboratorOptions,
    filteredImports,
  } = useProjectReportData({
    imports,
    selectedImportId,
    selectedCollaborator,
    projectTimelineCharts,
    projectSearch,
    selectedChartId,
  });

  useEffect(() => {
    if (!reportNotice) return;
    const timeoutId = window.setTimeout(() => setReportNotice(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [reportNotice]);

  useEffect(() => {
    setActiveProjectTab(nextProjectTab ?? "executive");
    setNextProjectTab(null);
    resetCollaboratorTasks();
  }, [selectedImportId]);

  function handleOpenProject(importId: number, tab: ProjectTabId = "executive") {
    setNextProjectTab(tab);
    onOpenProject(importId);
  }

  if (!selectedImport) {
    return (
      <>
        <ReportNotice notice={reportNotice} />
        <ReportLandingView
          imports={imports}
          filteredImports={filteredImports}
          projectSearch={projectSearch}
          reportLandingTab={reportLandingTab}
          evolutionOptions={evolutionOptions}
          selectedEvolutionProject={selectedEvolutionProject}
          projectEvolution={projectEvolution}
          isLoadingEvolution={isLoadingEvolution}
          isLoadingComparison={isLoadingComparison}
          evolutionError={evolutionError}
          evolutionExportUrl={evolutionExportUrl}
          comparisonProjectOptions={comparisonProjectOptions}
          comparisonSelection={comparisonSelection}
          projectComparison={projectComparison}
          comparisonError={comparisonError}
          savedComparisons={savedComparisons}
          isLoadingSavedComparisons={isLoadingSavedComparisons}
          savedComparisonActionId={savedComparisonActionId}
          savedComparisonError={savedComparisonError}
          saveComparisonName={saveComparisonName}
          isSavingComparison={isSavingComparison}
          comparisonExportUrl={comparisonExportUrl}
          onLandingTabChange={setReportLandingTab}
          onProjectSearchChange={setProjectSearch}
          onOpenProject={handleOpenProject}
          onSelectedEvolutionProjectChange={setSelectedEvolutionProject}
          onClearEvolution={() => setProjectEvolution(null)}
          onLoadEvolution={() => loadEvolution()}
          onCompareEvolutionImports={compareEvolutionImports}
          onClearComparison={clearComparison}
          onToggleComparisonSelection={toggleComparisonSelection}
          onCompareProjects={compareProjects}
          onSaveComparisonNameChange={setSaveComparisonName}
          onSaveComparison={saveComparison}
          onOpenSavedComparison={openSavedComparison}
          onDeleteSavedComparison={deleteSavedComparison}
        />
      </>
    );
  }

  return (
    <>
      <ReportNotice notice={reportNotice} />
      <ProjectReportHeader
        projectTitle={projectTitle}
        selectedImport={selectedImport}
        importedAt={importedAt}
        excelExportUrl={excelExportUrl}
        showDownloadMenu={showDownloadMenu}
        isPreparingPdf={isPreparingPdf}
        pdfOptions={pdfOptions}
        hasSelectedCollaborator={Boolean(selectedCollaborator)}
        onToggleDownloadMenu={toggleDownloadMenu}
        onCloseDownloadMenu={closeDownloadMenu}
        onShowPdfOptions={showPdfOptionsPanel}
        onClosePdfOptions={closePdfOptions}
        onPdfOptionsChange={setPdfOptions}
        onPreparePdf={preparePdf}
      />

      <ProjectDownloadMenu
        excelExportUrl={excelExportUrl}
        showDownloadMenu={false}
        showPdfOptions={showPdfOptions}
        isPreparingPdf={isPreparingPdf}
        pdfOptions={pdfOptions}
        hasSelectedCollaborator={Boolean(selectedCollaborator)}
        showTrigger={false}
        onToggleDownloadMenu={toggleDownloadMenu}
        onCloseDownloadMenu={closeDownloadMenu}
        onShowPdfOptions={showPdfOptionsPanel}
        onClosePdfOptions={closePdfOptions}
        onPdfOptionsChange={setPdfOptions}
        onPreparePdf={preparePdf}
      />

      <ProjectReportTabs activeTab={activeProjectTab} onChange={setActiveProjectTab} />

      {activeProjectTab === "executive" && (
        <ProjectOverviewPanel
          projectInsights={projectInsights}
          projectExecutiveSummary={projectExecutiveSummary}
          isSmartSummaryOpen={isSmartSummaryOpen}
          isProjectInsightsOpen={isProjectInsightsOpen}
          isExecutiveSummaryOpen={isExecutiveSummaryOpen}
          onToggleSmartSummary={() => setIsSmartSummaryOpen((current) => !current)}
          onToggleProjectInsights={() => setIsProjectInsightsOpen((current) => !current)}
          onToggleExecutiveSummary={() => setIsExecutiveSummaryOpen((current) => !current)}
        />
      )}

      {activeProjectTab === "charts" && (
        <ProjectChartsPanel
          selectedChartId={selectedChartId}
          projectTimelineCharts={projectTimelineCharts}
          onSelectedChartChange={setSelectedChartId}
        />
      )}

      {activeProjectTab === "tasks" && (
        <ProjectCollaboratorTasksPanel
          collaboratorOptions={collaboratorOptions}
          selectedCollaborator={selectedCollaborator}
          collaboratorTasks={collaboratorTasks}
          filteredCollaboratorTasks={filteredCollaboratorTasks}
          taskCategoryOptions={taskCategoryOptions}
          taskSearch={taskSearch}
          taskCategoryFilter={taskCategoryFilter}
          taskSort={taskSort}
          collaboratorTasksTotal={collaboratorTasksTotal}
          isLoadingTasks={isLoadingTasks}
          tasksError={tasksError}
          onCollaboratorChange={setSelectedCollaborator}
          onTaskSearchChange={setTaskSearch}
          onTaskCategoryFilterChange={setTaskCategoryFilter}
          onTaskSortChange={setTaskSort}
        />
      )}

      {isPreparingPdf && (
        <ProjectPdfReport
          projectTitle={projectTitle}
          selectedImport={selectedImport}
          importedAt={importedAt}
          pdfOptions={pdfOptions}
          projectInsights={projectInsights}
          projectExecutiveSummary={projectExecutiveSummary}
          openPendingByType={openPendingByType}
          pendingStatusSummary={pendingStatusSummary}
          openPendingPreview={openPendingPreview}
          selectedChart={selectedChart}
          projectTimelineCharts={projectTimelineCharts}
          selectedCollaborator={selectedCollaborator}
          filteredCollaboratorTasks={filteredCollaboratorTasks}
          collaboratorTasksTotal={collaboratorTasksTotal}
        />
      )}
    </>
  );
}
