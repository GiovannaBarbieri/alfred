import { useEffect, useState } from "react";

import { ProjectChartsPanel } from "../components/reports/ProjectChartsPanel";
import { ProjectCollaboratorTasksPanel } from "../components/reports/ProjectCollaboratorTasksPanel";
import { ProjectOverviewPanel } from "../components/reports/ProjectOverviewPanel";
import { ProjectReportHeader } from "../components/reports/ProjectReportHeader";
import { ProjectReportTabs } from "../components/reports/ProjectReportTabs";
import { ReportLandingView } from "../components/reports/ReportLandingView";
import { ReportNotice } from "../components/reports/ReportNotice";
import {
  type ProjectTabId,
  type TaskSortId,
  type TimelineChartId,
} from "../components/reports/reportsConfig";
import { useProjectCollaboratorTaskLoader } from "../hooks/useProjectCollaboratorTaskLoader";
import { useProjectCollaboratorTasks } from "../hooks/useProjectCollaboratorTasks";
import { useProjectReportData } from "../hooks/useProjectReportData";
import { refreshProjectImport } from "../services/api";
import type {
  ImportSummary,
  ProjectExecutiveSummary,
  ProjectInsights,
  ProjectRecommendation,
  ProjectTimelineCharts,
} from "../types";

export type ReportViewId = "user" | "epic" | "pbi" | "category" | "subcategory";

type ReportNoticeState = { tone: "success" | "error"; message: string };
const taskPageSize = 20;

export function ReportsPage({
  imports,
  landingCollaboratorsCount,
  selectedImportId,
  isLoadingProjectReport,
  projectTimelineCharts,
  projectExecutiveSummary,
  projectInsights,
  projectRecommendations,
  onOpenProject,
}: {
  imports: ImportSummary[];
  landingCollaboratorsCount: number;
  selectedImportId: number | null;
  isLoadingProjectReport: boolean;
  projectTimelineCharts: ProjectTimelineCharts;
  projectExecutiveSummary: ProjectExecutiveSummary;
  projectInsights: ProjectInsights;
  projectRecommendations: ProjectRecommendation[];
  onOpenProject: (importId: number) => void | Promise<void>;
}) {
  const [projectSearch, setProjectSearch] = useState("");
  const [reportNotice, setReportNotice] = useState<ReportNoticeState | null>(null);
  const [selectedChartId, setSelectedChartId] = useState<TimelineChartId>("dailyTotal");
  const [activeProjectTab, setActiveProjectTab] = useState<ProjectTabId>("executive");
  const [nextProjectTab, setNextProjectTab] = useState<ProjectTabId | null>(null);
  const [isSmartSummaryOpen, setIsSmartSummaryOpen] = useState(false);
  const [isProjectInsightsOpen, setIsProjectInsightsOpen] = useState(false);
  const [isExecutiveSummaryOpen, setIsExecutiveSummaryOpen] = useState(false);
  const [isRefreshingProject, setIsRefreshingProject] = useState(false);
  const [taskPage, setTaskPage] = useState(1);
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
  const totalTaskPages = Math.max(1, Math.ceil(filteredCollaboratorTasks.length / taskPageSize));
  const paginatedCollaboratorTasks = filteredCollaboratorTasks.slice(
    (taskPage - 1) * taskPageSize,
    taskPage * taskPageSize,
  );
  const {
    selectedImport,
    projectTitle,
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
  const activeProjectTabLabel = activeProjectTab === "executive" ? "Executivo" : activeProjectTab === "charts" ? "Gráficos" : "Tasks";
  const averageHoursByCollaborator =
    projectExecutiveSummary.metrics.collaboratorsCount > 0
      ? projectExecutiveSummary.metrics.totalHours / projectExecutiveSummary.metrics.collaboratorsCount
      : 0;
  const topCollaborator = projectExecutiveSummary.topUsers[0];

  useEffect(() => {
    if (!reportNotice) return;
    const timeoutId = window.setTimeout(() => setReportNotice(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [reportNotice]);

  useEffect(() => {
    setActiveProjectTab(nextProjectTab ?? "executive");
    setNextProjectTab(null);
    resetCollaboratorTasks();
    setTaskPage(1);
  }, [selectedImportId]);

  useEffect(() => {
    setTaskPage(1);
  }, [selectedCollaborator, taskSearch, taskCategoryFilter, taskSort]);

  useEffect(() => {
    setTaskPage((current) => Math.min(current, totalTaskPages));
  }, [totalTaskPages]);

  function handleOpenProject(importId: number, tab: ProjectTabId = "executive") {
    setNextProjectTab(tab);
    onOpenProject(importId);
  }

  async function handleRefreshProjectData() {
    if (!selectedImport || isRefreshingProject) return;
    setReportNotice(null);
    setIsRefreshingProject(true);
    try {
      await refreshProjectImport(selectedImport.id);
      await onOpenProject(selectedImport.id);
      resetCollaboratorTasks();
      setTaskPage(1);
      setReportNotice({ tone: "success", message: "Dados do projeto atualizados com sucesso." });
    } catch (err) {
      setReportNotice({
        tone: "error",
        message: err instanceof Error ? err.message : "NÃ£o foi possÃ­vel atualizar os dados do projeto.",
      });
    } finally {
      setIsRefreshingProject(false);
    }
  }

  if (!selectedImport) {
    return (
      <>
        <ReportNotice notice={reportNotice} />
        <ReportLandingView
          imports={imports}
          filteredImports={filteredImports}
          projectSearch={projectSearch}
          landingCollaboratorsCount={landingCollaboratorsCount}
          onProjectSearchChange={setProjectSearch}
          onOpenProject={handleOpenProject}
        />
      </>
    );
  }

  return (
    <>
      <ReportNotice notice={reportNotice} />
      <nav className="report-breadcrumb" aria-label="Localização do relatório">
        <span>Relatórios</span>
        <span aria-hidden="true">/</span>
        <span>Projetos</span>
        <span aria-hidden="true">/</span>
        <strong>{projectTitle}</strong>
        <span aria-hidden="true">/</span>
        <span>{activeProjectTabLabel}</span>
      </nav>

      <ProjectReportHeader
        projectTitle={projectTitle}
        selectedImport={selectedImport}
        excelExportUrl={excelExportUrl}
        isRefreshing={isRefreshingProject}
        onRefreshData={handleRefreshProjectData}
      />

      {isLoadingProjectReport && (
        <section className="panel loading-panel">Carregando dados do projeto...</section>
      )}

      {!isLoadingProjectReport && (
        <>
      <section className="report-executive-kpis" aria-label="Indicadores executivos do projeto">
        <span><strong>{projectExecutiveSummary.metrics.totalHours.toFixed(2)}h</strong><small>Horas</small></span>
        <span><strong>{selectedImport.validRows}</strong><small>Registros</small></span>
        <span><strong>{projectExecutiveSummary.metrics.collaboratorsCount}</strong><small>Colaboradores</small></span>
        <span><strong>{projectExecutiveSummary.categories.length}</strong><small>Categorias</small></span>
        <span><strong>{averageHoursByCollaborator.toFixed(1)}h</strong><small>Média por colaborador</small></span>
        <span>
          <strong>{topCollaborator ? topCollaborator.totalHours.toFixed(1) : "0"}h</strong>
          <small>{topCollaborator?.label || topCollaborator?.key || "Maior colaborador"}</small>
        </span>
      </section>

      <ProjectReportTabs
        activeTab={activeProjectTab}
        taskCount={projectExecutiveSummary.metrics.tasksCount}
        onChange={setActiveProjectTab}
      />

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
          projectExportPrefix={projectTitle}
          projectExecutiveSummary={projectExecutiveSummary}
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
          paginatedCollaboratorTasks={paginatedCollaboratorTasks}
          taskCategoryOptions={taskCategoryOptions}
          taskSearch={taskSearch}
          taskCategoryFilter={taskCategoryFilter}
          taskSort={taskSort}
          collaboratorTasksTotal={collaboratorTasksTotal}
          taskPage={taskPage}
          totalTaskPages={totalTaskPages}
          taskPageSize={taskPageSize}
          isLoadingTasks={isLoadingTasks}
          tasksError={tasksError}
          onCollaboratorChange={setSelectedCollaborator}
          onTaskSearchChange={setTaskSearch}
          onTaskCategoryFilterChange={setTaskCategoryFilter}
          onTaskSortChange={setTaskSort}
          onTaskPageChange={setTaskPage}
        />
      )}
        </>
      )}

    </>
  );
}
