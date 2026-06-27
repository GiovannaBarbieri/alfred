import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  Layers3,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { DashboardCategorySummary, DashboardOverview, DashboardRecentProject } from "../types";
import { formatDateBR, formatDateTimeBR } from "../utils/date";

type DashboardPageProps = {
  overview: DashboardOverview;
  onOpenReport: (importId: number) => void;
};

type QuickKpi = {
  label: string;
  value: string;
  icon: JSX.Element;
  tooltip: string;
};

type AttentionItem = {
  label: string;
  value: number;
};

type HighlightItem = {
  label: string;
  project?: DashboardRecentProject;
  value: string;
};

export function DashboardPage({ overview, onOpenReport }: DashboardPageProps) {
  const hasProjects = overview.recentProjects.length > 0;
  const latestProject = overview.recentProjects[0];
  const totalPending = getTotalPending(overview);
  const isHealthy = totalPending === 0;
  const attentionItems = buildAttentionItems(overview).filter((item) => item.value > 0);
  const categoryDistribution = buildCategoryDistribution(overview.categorySummary);
  const highlights = buildProjectHighlights(overview.recentProjects);
  const recommendations = buildAiRecommendations(overview, isHealthy, totalPending);
  const lastUpdate = latestProject ? formatDateTimeBR(latestProject.importedAt).replace(" ", " • ") : "Sem importações";
  const kpis: QuickKpi[] = [
    {
      label: "Horas analisadas",
      value: `${overview.summary.totalHours.toFixed(2)}h`,
      icon: <Clock3 size={17} />,
      tooltip: "Total de horas válidas importadas para análise.",
    },
    {
      label: "Projetos analisados",
      value: String(overview.summary.projectsCount),
      icon: <Layers3 size={17} />,
      tooltip: "Quantidade de projetos processados.",
    },
    {
      label: "Registros",
      value: String(overview.summary.totalRecords),
      icon: <Database size={17} />,
      tooltip: "Total de registros utilizados nas análises.",
    },
    {
      label: "Colaboradores",
      value: String(overview.summary.collaboratorsCount),
      icon: <UsersRound size={17} />,
      tooltip: "Quantidade de colaboradores identificados nas importações.",
    },
    {
      label: "Última importação",
      value: latestProject ? formatDateBR(latestProject.importedAt) : "-",
      icon: <FileSpreadsheet size={17} />,
      tooltip: "Data da importação mais recente considerada na Dashboard.",
    },
  ];

  return (
    <section className="dashboard-command-center">
      <div className="dashboard-command-meta">
        <small><span>Atualizado em</span>{lastUpdate}</small>
      </div>

      <section className="dashboard-kpi-grid" aria-label="Indicadores principais">
        {kpis.map((item) => (
          <article className="dashboard-kpi-card" key={item.label} title={item.tooltip}>
            <span>{item.icon}</span>
            <div>
              <strong>{item.value}</strong>
              <small>{item.label}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-status-grid">
        <article className={`panel dashboard-status-card ${isHealthy ? "healthy" : "attention"}`}>
          <div className="dashboard-section-heading">
            <span>{isHealthy ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
            <div>
              <h2>Situação Geral</h2>
              <p>{isHealthy ? "Ambiente operacional estável." : "Existem pontos que exigem revisão."}</p>
            </div>
          </div>
          <div className="dashboard-status-lines">
            <span><CheckCircle2 size={14} />{overview.summary.projectsCount} projeto(s) analisado(s)</span>
            <span><CheckCircle2 size={14} />{overview.summary.totalRecords} registro(s) consolidados</span>
            <span>{isHealthy ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{isHealthy ? "Nenhum alerta encontrado" : `${totalPending} pendência(s) operacional(is)`}</span>
          </div>
        </article>

        <article className="panel dashboard-attention-panel">
          <div className="dashboard-section-heading compact">
            <span>{isHealthy ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}</span>
            <div>
              <h2>Painel de Pendências</h2>
              <p>Somente itens relevantes para ação.</p>
            </div>
          </div>
          {isHealthy ? (
            <div className="dashboard-clear-message">
              <CheckCircle2 size={17} />
              <span>Nenhuma pendência operacional encontrada.</span>
            </div>
          ) : (
            <div className="dashboard-attention-simple-list">
              {attentionItems.map((item) => (
                <span key={item.label}><AlertTriangle size={14} />{item.value} {item.label}</span>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-command-grid">
        <article className="panel dashboard-panorama-panel">
          <div className="dashboard-section-heading">
            <span><Layers3 size={18} /></span>
            <div>
              <h2>Panorama Geral dos Projetos</h2>
              <p>Últimos projetos analisados no ambiente.</p>
            </div>
          </div>
          {hasProjects ? (
            <>
              <div className="dashboard-project-card-grid">
                {overview.recentProjects.slice(0, 5).map((project) => (
                  <button
                    className="dashboard-project-card"
                    key={project.importId}
                    type="button"
                    onClick={() => onOpenReport(project.importId)}
                  >
                    <div>
                      <strong>{project.projectName}</strong>
                      <small>{project.filename}</small>
                    </div>
                    <div className="dashboard-project-metrics">
                      <span><b>{project.totalHours.toFixed(2)}h</b> Horas</span>
                      <span><b>{project.collaboratorsCount}</b> colaboradores</span>
                      <span><b>{project.recordsCount}</b> registros</span>
                    </div>
                    <footer>
                      <span className="dashboard-status-badge">{formatProjectStatus(project.status)}</span>
                      <span>Abrir relatório <ArrowUpRight size={13} /></span>
                    </footer>
                  </button>
                ))}
              </div>
              {overview.summary.projectsCount > overview.recentProjects.length && (
                <button className="secondary-button compact dashboard-see-all-button" type="button">
                  Ver todos os projetos
                </button>
              )}
            </>
          ) : (
            <div className="dashboard-empty-state compact">Nenhum projeto importado ainda.</div>
          )}
        </article>

        <article className="panel dashboard-ai-panel">
          <div className="dashboard-section-heading">
            <span><Sparkles size={18} /></span>
            <div>
              <h2>Recomendações da IA</h2>
              <p>Observações objetivas para tomada de decisão.</p>
            </div>
          </div>
          <div className="dashboard-ai-list">
            {recommendations.map((recommendation) => (
              <span key={recommendation}><CheckCircle2 size={14} />{recommendation}</span>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-command-grid secondary">
        <article className="panel dashboard-distribution-panel">
          <div className="dashboard-section-heading">
            <span><BarChart3 size={18} /></span>
            <div>
              <h2>Distribuição Geral</h2>
              <p>Horas consolidadas por categoria em todos os projetos.</p>
            </div>
          </div>
          <div className="dashboard-horizontal-bars">
            {categoryDistribution.map((item, index) => (
              <div className="dashboard-horizontal-bar" key={item.category}>
                <div>
                  <strong>{item.category}</strong>
                  <span>{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="dashboard-bar-track">
                  <span style={{ width: `${Math.max(item.percentage, item.hours > 0 ? 3 : 0)}%` }} data-rank={index + 1} />
                </div>
                <small>{item.hours.toFixed(2)}h</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel dashboard-highlights-panel">
          <div className="dashboard-section-heading">
            <span><Layers3 size={18} /></span>
            <div>
              <h2>Projetos em Destaque</h2>
              <p>Principais sinais globais do ambiente.</p>
            </div>
          </div>
          <div className="dashboard-highlight-list">
            {highlights.map((item) => (
              <div className="dashboard-highlight-item" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.project?.projectName ?? "Não disponível"}</strong>
                  <small>{item.value}</small>
                </div>
                {item.project && (
                  <button className="secondary-button compact dashboard-open-button" type="button" onClick={() => onOpenReport(item.project!.importId)}>
                    Abrir <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="panel dashboard-collaborators-panel">
          <div className="dashboard-section-heading">
            <span><UsersRound size={18} /></span>
            <div>
              <h2>Colaboradores</h2>
              <p>Top 5 por volume de horas no ambiente.</p>
            </div>
          </div>
          <div className="dashboard-collaborator-ranking">
            {overview.collaboratorSummary.length > 0 ? overview.collaboratorSummary.map((collaborator, index) => (
              <div className="dashboard-collaborator-row" key={collaborator.loginUsuario}>
                <div>
                  <strong>{index + 1}. {collaborator.loginUsuario}</strong>
                  <span>{collaborator.hours.toFixed(2)}h</span>
                </div>
                <div className="dashboard-bar-track compact">
                  <span style={{ width: `${Math.max(collaborator.percentage, 3)}%` }} />
                </div>
              </div>
            )) : (
              <div className="dashboard-empty-state compact">Nenhum colaborador identificado.</div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}

function buildAttentionItems(overview: DashboardOverview): AttentionItem[] {
  return [
    { label: "classificações pendentes", value: overview.pendingItems.classificationPending },
    { label: "análises de baixa confiança", value: overview.pendingItems.lowConfidence },
    { label: "colaboradores sem perfil", value: overview.pendingItems.collaboratorsWithoutProfile },
    { label: "alertas pendentes", value: overview.pendingItems.alertsPending },
  ];
}

function getTotalPending(overview: DashboardOverview) {
  return buildAttentionItems(overview).reduce((total, item) => total + item.value, 0);
}

function buildCategoryDistribution(categories: DashboardCategorySummary[]) {
  return [...categories]
    .filter((item) => item.hours > 0)
    .sort((a, b) => b.hours - a.hours);
}

function buildProjectHighlights(projects: DashboardRecentProject[]): HighlightItem[] {
  const highestVolume = [...projects].sort((a, b) => b.totalHours - a.totalHours)[0];
  const mostCollaborators = [...projects].sort((a, b) => b.collaboratorsCount - a.collaboratorsCount)[0];
  const highestRework = [...projects].sort((a, b) => b.reworkHours - a.reworkHours)[0];
  const mostRecent = projects[0];

  return [
    {
      label: "Projeto com maior volume",
      project: highestVolume,
      value: highestVolume ? `${highestVolume.totalHours.toFixed(2)}h analisadas` : "-",
    },
    {
      label: "Maior quantidade de colaboradores",
      project: mostCollaborators,
      value: mostCollaborators ? `${mostCollaborators.collaboratorsCount} colaboradores` : "-",
    },
    {
      label: "Maior retrabalho",
      project: highestRework,
      value: highestRework ? `${highestRework.reworkHours.toFixed(2)}h em retrabalho` : "-",
    },
    {
      label: "Projeto mais recente",
      project: mostRecent,
      value: mostRecent ? formatDateBR(mostRecent.importedAt) : "-",
    },
  ];
}

function buildAiRecommendations(overview: DashboardOverview, isHealthy: boolean, totalPending: number) {
  const recommendations: string[] = [];
  const topCategory = buildCategoryDistribution(overview.categorySummary)[0];
  const topProject = [...overview.recentProjects].sort((a, b) => b.totalHours - a.totalHours)[0];
  const topCollaborator = overview.collaboratorSummary[0];
  const reworkCategory = overview.categorySummary.find((item) => item.category === "Retrabalho");

  if (isHealthy) {
    recommendations.push("Nenhuma inconsistência encontrada no ambiente.");
    recommendations.push("Todos os projetos estão classificados dentro dos critérios atuais.");
  } else {
    recommendations.push(`${totalPending} pendência(s) exigem revisão operacional.`);
  }

  if (topCategory) {
    recommendations.push(`${topCategory.category} representa ${topCategory.percentage.toFixed(1)}% do esforço total.`);
  }

  if (reworkCategory && reworkCategory.percentage > 0) {
    recommendations.push(`Retrabalho corresponde a ${reworkCategory.percentage.toFixed(1)}% das horas consolidadas.`);
  }

  if (topProject && overview.summary.totalHours > 0) {
    const projectShare = (topProject.totalHours / overview.summary.totalHours) * 100;
    if (projectShare >= 40) {
      recommendations.push(`${topProject.projectName} concentra ${projectShare.toFixed(1)}% das horas analisadas.`);
    }
  }

  if (topCollaborator && topCollaborator.percentage >= 40) {
    recommendations.push(`${topCollaborator.loginUsuario} concentra ${topCollaborator.percentage.toFixed(1)}% das horas do ambiente.`);
  }

  return recommendations.slice(0, 6);
}

function formatProjectStatus(status: string) {
  if (status.toLowerCase() === "concluido") {
    return "Concluído";
  }
  return status;
}
