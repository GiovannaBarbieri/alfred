import { ProjectTimelineChart } from "../ProjectTimelineChart";
import type {
  ImportSummary,
  ProjectCollaboratorTask,
  ProjectExecutiveSummary,
  ProjectInsightCard,
  ProjectInsights,
  ProjectTimelineCharts,
} from "../../types";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";
import type { ProjectPdfOptions } from "./ProjectDownloadMenu";
import { timelineCharts, type TimelineChartId } from "./reportsConfig";
import { formatPeriodBR, formatWeekRangeBR } from "../../utils/date";

type ProjectPdfReportProps = {
  projectTitle: string;
  selectedImport: ImportSummary;
  importedAt: string;
  pdfOptions: ProjectPdfOptions;
  projectInsights: ProjectInsights;
  projectExecutiveSummary: ProjectExecutiveSummary;
  selectedChart: {
    id: TimelineChartId;
    title: string;
    description: string;
  };
  projectTimelineCharts: ProjectTimelineCharts;
  selectedCollaborator: string;
  filteredCollaboratorTasks: ProjectCollaboratorTask[];
  collaboratorTasksTotal: string;
};

export function ProjectPdfReport({
  projectTitle,
  selectedImport,
  importedAt,
  pdfOptions,
  projectInsights,
  projectExecutiveSummary,
  selectedChart,
  projectTimelineCharts,
  selectedCollaborator,
  filteredCollaboratorTasks,
  collaboratorTasksTotal,
}: ProjectPdfReportProps) {
  const averageHoursByCollaborator = projectExecutiveSummary.metrics.collaboratorsCount
    ? projectExecutiveSummary.metrics.totalHours / projectExecutiveSummary.metrics.collaboratorsCount
    : 0;
  const topCollaborator = projectExecutiveSummary.topUsers[0];

  return (
    <section className="pdf-report-section" aria-label="Relatório PDF">
      <div className="pdf-report-cover">
        <span>Relatório operacional de horas</span>
        <h1>{projectTitle}</h1>
        <p>{selectedImport.filename}</p>
        <p>Atualizado em {importedAt}</p>
      </div>

      <div className="pdf-summary-grid">
        <div><strong>{projectExecutiveSummary.metrics.totalHours.toFixed(2)}h</strong><span>Horas</span></div>
        <div><strong>{selectedImport.validRows}</strong><span>Registros</span></div>
        <div><strong>{projectExecutiveSummary.metrics.collaboratorsCount}</strong><span>Colaboradores</span></div>
        <div><strong>{projectExecutiveSummary.categories.length}</strong><span>Categorias</span></div>
        <div><strong>{averageHoursByCollaborator.toFixed(1)}h</strong><span>Média por colaborador</span></div>
        <div><strong>{topCollaborator ? topCollaborator.totalHours.toFixed(1) : "0"}h</strong><span>{topCollaborator?.label || topCollaborator?.key || "Maior participação"}</span></div>
      </div>

      {projectInsights.cards.length > 0 && (
        <div className="pdf-insights-summary">
          <h2>Destaques do Projeto</h2>
          <div className="project-insights-grid">
            {projectInsights.cards.map((insight) => (
              <article className={`project-insight-card ${insight.tone}`} key={`pdf-${insight.kind}-${insight.title}`}>
                <span>{insight.title}</span>
                <strong title={formatInsightValue(insight)}>{formatInsightValue(insight)}</strong>
                <small>{insight.detail}</small>
              </article>
            ))}
          </div>
        </div>
      )}

      {pdfOptions.executiveSummary && (
        <div className="pdf-executive-summary">
          <ExecutiveSummaryList title="Top 3 Colaboradores" items={projectExecutiveSummary.topUsers.slice(0, 3)} />
          <ExecutiveSummaryList title="Top Tasks" items={projectExecutiveSummary.topTasks} showKey />
          <ExecutiveSummaryList title="Top 3 Categorias" items={projectExecutiveSummary.categories.slice(0, 3)} />
        </div>
      )}

      {pdfOptions.chartMode !== "none" && (
        pdfOptions.chartMode === "all" ? (
          timelineCharts.map((chart) => (
            <ProjectTimelineChart
              key={chart.id}
              title={chart.title}
              description={chart.description}
              data={projectTimelineCharts[chart.id]}
            />
          ))
        ) : (
          <ProjectTimelineChart
            title={selectedChart.title}
            description={selectedChart.description}
            data={projectTimelineCharts[selectedChart.id]}
          />
        )
      )}

      {pdfOptions.collaboratorTasks && selectedCollaborator && filteredCollaboratorTasks.length > 0 && (
        <div className="pdf-task-summary">
          <h2>Tasks de {selectedCollaborator}</h2>
          <table className="task-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Titulo</th>
                <th>Categoria</th>
                <th>Subcategoria</th>
                <th>Duracao</th>
              </tr>
            </thead>
            <tbody>
              {filteredCollaboratorTasks.map((task) => (
                <tr key={`pdf-${task.idTask}-${task.categoria}-${task.subcategoria}`}>
                  <td>{task.idTask}</td>
                  <td>{task.tituloTask}</td>
                  <td>{task.categoria}</td>
                  <td>{task.subcategoria}</td>
                  <td>{task.totalDuration}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td colSpan={3}></td>
                <td>{collaboratorTasksTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function formatInsightValue(insight: ProjectInsightCard) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(insight.value)) return insight.value;
  return insight.kind === "peak_week" ? formatWeekRangeBR(insight.value) : formatPeriodBR(insight.value);
}
