import { ProjectTimelineChart } from "../ProjectTimelineChart";
import type {
  ImportSummary,
  ProjectCollaboratorTask,
  ProjectExecutiveSummary,
  ProjectInsights,
  ProjectRecommendation,
  ProjectTimelineCharts,
} from "../../types";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";
import type { ProjectPdfOptions } from "./ProjectDownloadMenu";
import { timelineCharts, type TimelineChartId } from "./reportsConfig";
import type { PendingActionItem } from "../../hooks/useProjectPendingQueue";

type ProjectPdfReportProps = {
  projectTitle: string;
  selectedImport: ImportSummary;
  importedAt: string;
  pdfOptions: ProjectPdfOptions;
  projectInsights: ProjectInsights;
  projectRecommendations: ProjectRecommendation[];
  projectExecutiveSummary: ProjectExecutiveSummary;
  openPendingByType: {
    unclassified: number;
    lowConfidence: number;
    zeroDuration: number;
    alerts: number;
  };
  pendingStatusSummary: {
    open: number;
    reviewed: number;
    ignored: number;
  };
  openPendingPreview: PendingActionItem[];
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
  projectRecommendations,
  projectExecutiveSummary,
  openPendingByType,
  pendingStatusSummary,
  openPendingPreview,
  selectedChart,
  projectTimelineCharts,
  selectedCollaborator,
  filteredCollaboratorTasks,
  collaboratorTasksTotal,
}: ProjectPdfReportProps) {
  return (
    <section className="pdf-report-section" aria-label="Relatorio PDF">
      <div className="pdf-report-cover">
        <span>Relatorio operacional de horas</span>
        <h1>{projectTitle}</h1>
        <p>{selectedImport.filename}</p>
      </div>

      <div className="pdf-summary-grid">
        <div><strong>{selectedImport.totalHours}h</strong><span>Total de horas</span></div>
        <div><strong>{selectedImport.validRows}</strong><span>Registros</span></div>
        <div><strong>{selectedImport.alertRows}</strong><span>Alertas</span></div>
        <div><strong>{importedAt}</strong><span>{selectedImport.status}</span></div>
      </div>

      {projectInsights.cards.length > 0 && (
        <div className="pdf-insights-summary">
          <h2>Analises principais</h2>
          <div className="project-insights-grid">
            {projectInsights.cards.map((insight) => (
              <article className={`project-insight-card ${insight.tone}`} key={`pdf-${insight.kind}-${insight.title}`}>
                <span>{insight.title}</span>
                <strong title={insight.value}>{insight.value}</strong>
                <small>{insight.detail}</small>
              </article>
            ))}
          </div>
        </div>
      )}

      {projectRecommendations.length > 0 && (
        <div className="pdf-recommendations-summary">
          <h2>Recomendacoes operacionais</h2>
          <div className="project-recommendations-list">
            {projectRecommendations.map((recommendation) => (
              <article
                className={`project-recommendation-card ${recommendation.priority}`}
                key={`pdf-${recommendation.source}-${recommendation.title}`}
              >
                <span>{recommendation.priority}</span>
                <strong>{recommendation.title}</strong>
                <p>{recommendation.reason}</p>
                <small>{recommendation.action}</small>
              </article>
            ))}
          </div>
        </div>
      )}

      {pdfOptions.executiveSummary && (
        <div className="pdf-executive-summary">
          <ExecutiveSummaryList title="Top colaboradores" items={projectExecutiveSummary.topUsers} />
          <ExecutiveSummaryList title="Top Tasks" items={projectExecutiveSummary.topTasks} showKey />
          <ExecutiveSummaryList title="Categorias" items={projectExecutiveSummary.categories} />
        </div>
      )}

      {pdfOptions.pendingItems && (
        <div className="pdf-pending-summary">
          <h2>Pendencias do projeto</h2>
          <div className="pending-project-counts">
            <span><strong>{openPendingByType.unclassified}</strong><small>Sem classificacao abertas</small></span>
            <span><strong>{openPendingByType.lowConfidence}</strong><small>Baixa confianca abertas</small></span>
            <span><strong>{openPendingByType.zeroDuration}</strong><small>Duracao zerada abertas</small></span>
            <span><strong>{openPendingByType.alerts}</strong><small>Alertas abertos</small></span>
          </div>
          <div className="pending-status-summary">
            <span><strong>{pendingStatusSummary.open}</strong><small>Pendentes</small></span>
            <span><strong>{pendingStatusSummary.reviewed}</strong><small>Revisadas</small></span>
            <span><strong>{pendingStatusSummary.ignored}</strong><small>Ignoradas</small></span>
          </div>
          {openPendingPreview.length > 0 && (
            <table className="pdf-pending-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Prioridade</th>
                  <th>Colaborador</th>
                  <th>Titulo/Mensagem</th>
                  <th>Acao</th>
                </tr>
              </thead>
              <tbody>
                {openPendingPreview.map((item) => (
                  <tr key={`pdf-pending-${item.id}`}>
                    <td>{item.typeLabel}</td>
                    <td>{item.priority}</td>
                    <td>{item.user || "-"}</td>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </td>
                    <td>{item.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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
                <th>IdTask</th>
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
