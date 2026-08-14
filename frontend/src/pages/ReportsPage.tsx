import { AlertTriangle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
  ProjectRefreshPendingTask,
  ProjectTimelineCharts,
} from "../types";

export type ReportViewId = "user" | "epic" | "pbi" | "category" | "subcategory";

type ReportNoticeState = { tone: "success" | "error"; message: string };
const taskPageSize = 20;

export function ReportsPage({
  categoryOptions,
  imports,
  landingCollaboratorsCount,
  selectedImportId,
  isLoadingProjectReport,
  projectTimelineCharts,
  projectExecutiveSummary,
  projectInsights,
  projectRecommendations,
  subcategoryOptions,
  onOpenProject,
}: {
  categoryOptions: string[];
  imports: ImportSummary[];
  landingCollaboratorsCount: number;
  selectedImportId: number | null;
  isLoadingProjectReport: boolean;
  projectTimelineCharts: ProjectTimelineCharts;
  projectExecutiveSummary: ProjectExecutiveSummary;
  projectInsights: ProjectInsights;
  projectRecommendations: ProjectRecommendation[];
  subcategoryOptions: string[];
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
  const [pendingRefreshTasks, setPendingRefreshTasks] = useState<ProjectRefreshPendingTask[]>([]);
  const [pendingRefreshOverrides, setPendingRefreshOverrides] = useState<Record<string, { category: string; subcategory: string }>>({});
  const [taskPage, setTaskPage] = useState(1);
  const {
    selectedCollaborator,
    collaboratorTasks,
    collaboratorCategoryTimeline,
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
    setPendingRefreshTasks([]);
    setPendingRefreshOverrides({});
    setIsRefreshingProject(true);
    try {
      const result = await refreshProjectImport(selectedImport.id);
      if (result.status === "pendente_classificacao" && result.pendingTasks?.length) {
        setPendingRefreshTasks(result.pendingTasks);
        setPendingRefreshOverrides(
          Object.fromEntries(
            result.pendingTasks.map((task) => [
              task.idTask,
              {
                category: isUnclassifiedValue(task.category) ? "" : task.category,
                subcategory: isUnclassifiedValue(task.subcategory) ? "" : task.subcategory,
              },
            ]),
          ),
        );
        return;
      }
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

  async function handleConfirmRefreshClassifications() {
    if (!selectedImport || isRefreshingProject || pendingRefreshTasks.length === 0) return;
    const overrides = pendingRefreshTasks.flatMap((task) => {
      const selected = pendingRefreshOverrides[task.idTask];
      if (!selected) return [];
      return task.lines.map((line) => ({ line, category: selected.category, subcategory: selected.subcategory }));
    });
    setReportNotice(null);
    setIsRefreshingProject(true);
    try {
      const result = await refreshProjectImport(selectedImport.id, overrides);
      if (result.status === "pendente_classificacao" && result.pendingTasks?.length) {
        setPendingRefreshTasks(result.pendingTasks);
        setPendingRefreshOverrides((current) => ({
          ...Object.fromEntries(
            result.pendingTasks!.map((task) => [
              task.idTask,
              current[task.idTask] ?? {
                category: isUnclassifiedValue(task.category) ? "" : task.category,
                subcategory: isUnclassifiedValue(task.subcategory) ? "" : task.subcategory,
              },
            ]),
          ),
        }));
        setReportNotice({ tone: "error", message: "Ainda existem Tasks pendentes de classificação." });
        return;
      }
      setPendingRefreshTasks([]);
      setPendingRefreshOverrides({});
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

  function closePendingRefreshModal() {
    if (isRefreshingProject) return;
    setPendingRefreshTasks([]);
    setPendingRefreshOverrides({});
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

      {pendingRefreshTasks.length > 0 && (
        <ProjectRefreshClassificationModal
          busy={isRefreshingProject}
          categoryOptions={categoryOptions}
          overrides={pendingRefreshOverrides}
          pendingTasks={pendingRefreshTasks}
          subcategoryOptions={subcategoryOptions}
          onCancel={closePendingRefreshModal}
          onConfirm={() => void handleConfirmRefreshClassifications()}
          onOverrideChange={(taskId, field, value) => {
            setPendingRefreshOverrides((current) => ({
              ...current,
              [taskId]: {
                category: field === "category" ? value : current[taskId]?.category ?? "",
                subcategory: field === "subcategory" ? value : current[taskId]?.subcategory ?? "",
              },
            }));
          }}
        />
      )}

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
          collaboratorCategoryTimeline={collaboratorCategoryTimeline}
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

type ProjectRefreshClassificationModalProps = {
  busy: boolean;
  categoryOptions: string[];
  overrides: Record<string, { category: string; subcategory: string }>;
  pendingTasks: ProjectRefreshPendingTask[];
  subcategoryOptions: string[];
  onCancel: () => void;
  onConfirm: () => void;
  onOverrideChange: (taskId: string, field: "category" | "subcategory", value: string) => void;
};

function ProjectRefreshClassificationModal({
  busy,
  categoryOptions,
  overrides,
  pendingTasks,
  subcategoryOptions,
  onCancel,
  onConfirm,
  onOverrideChange,
}: ProjectRefreshClassificationModalProps) {
  const canConfirm = useMemo(
    () =>
      pendingTasks.every((task) => {
        const selected = overrides[task.idTask];
        return selected && !isUnclassifiedValue(selected.category) && !isUnclassifiedValue(selected.subcategory);
      }),
    [overrides, pendingTasks],
  );
  const pendingLabel = pendingTasks.length === 1 ? "1 Task pendente" : `${pendingTasks.length} Tasks pendentes`;

  return (
    <div className="saved-report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <div className="saved-report-modal project-refresh-classification-modal" role="dialog" aria-modal="true" aria-labelledby="project-refresh-classification-title">
        <header>
          <span>
            <AlertTriangle size={20} />
          </span>
          <div>
            <h2 id="project-refresh-classification-title">Classificações pendentes</h2>
            <p>Foram encontradas Tasks que precisam ser classificadas antes de atualizar o relatório.</p>
          </div>
          <button type="button" aria-label="Fechar modal" disabled={busy} onClick={onCancel}><X size={18} /></button>
        </header>

        <div className="project-refresh-classification-count">{pendingLabel}</div>

        <div className="project-refresh-classification-list">
          {pendingTasks.map((task) => {
            const selected = overrides[task.idTask] ?? { category: "", subcategory: "" };
            return (
              <article className="project-refresh-classification-item" key={task.idTask}>
                <div className="project-refresh-classification-task">
                  <span>#{task.idTask}</span>
                  <strong title={task.tituloTask}>{task.tituloTask}</strong>
                  <small>{task.loginUsuario} · {task.totalRecords} {task.totalRecords === 1 ? "registro" : "registros"}</small>
                </div>
                <label>
                  <span>Categoria</span>
                  <select
                    disabled={busy}
                    value={selected.category}
                    onChange={(event) => onOverrideChange(task.idTask, "category", event.target.value)}
                  >
                    <option value="">Selecionar categoria</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Subcategoria</span>
                  <select
                    disabled={busy}
                    value={selected.subcategory}
                    onChange={(event) => onOverrideChange(task.idTask, "subcategory", event.target.value)}
                  >
                    <option value="">Selecionar subcategoria</option>
                    {subcategoryOptions.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>{subcategory}</option>
                    ))}
                  </select>
                </label>
              </article>
            );
          })}
        </div>

        <footer>
          <button className="secondary-button" disabled={busy} type="button" onClick={onCancel}>Cancelar</button>
          <button className="primary-button" disabled={busy || !canConfirm} type="button" onClick={onConfirm}>
            {busy ? "Confirmando..." : "Confirmar atualização"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function isUnclassifiedValue(value: string | undefined | null) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  return normalized === "" || normalized === "nao classificado";
}
