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
  onViewReports: () => void;
};

type QuickKpi = {
  label: string;
  value: string;
  detail?: string;
  icon: JSX.Element;
  tooltip: string;
};

type AttentionItem = {
  label: string;
  value: number;
};

type EnvironmentIndicator = {
  label: string;
  value: string;
  detail?: string;
};

export function DashboardPage({
  overview,
  onOpenReport,
  onViewReports,
}: DashboardPageProps) {
  const hasProjects = overview.recentProjects.length > 0;
  const latestProject = overview.recentProjects[0];
  const totalPending = getTotalPending(overview);
  const isHealthy = totalPending === 0;
  const attentionItems = buildAttentionItems(overview).filter((item) => item.value > 0);
  const categoryDistribution = buildCategoryDistribution(overview.categorySummary);
  const environmentIndicators = buildEnvironmentIndicators(overview.recentProjects, overview.summary.projectsCount);
  const recommendations = buildAiRecommendations(overview, isHealthy, totalPending);
  const lastUpdate = latestProject ? formatDateTimeBR(latestProject.importedAt).replace(" ", " • ") : "Sem importações";
  const latestImportParts = latestProject ? formatDateTimeBR(latestProject.importedAt).split(" ") : [];
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
      value: latestImportParts[0] ?? "-",
      detail: latestImportParts[1],
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
              {item.detail && <em>{item.detail}</em>}
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
            <span><CheckCircle2 size={14} />Sistema saudável</span>
            <span><CheckCircle2 size={14} />Todos os colaboradores classificados</span>
            <span><CheckCircle2 size={14} />Importações concluídas</span>
            <span>{isHealthy ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{isHealthy ? "Nenhuma pendência operacional" : `${totalPending} pendência(s) operacional(is)`}</span>
            <span>{overview.summary.pendingAlerts === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}{overview.summary.pendingAlerts === 0 ? "Nenhum alerta encontrado" : `${overview.summary.pendingAlerts} alerta(s) pendente(s)`}</span>
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

      <section className="dashboard-panorama-row">
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
                <button className="secondary-button compact dashboard-see-all-button" type="button" onClick={onViewReports}>
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
              <p>Checklist objetivo para tomada de decisão.</p>
            </div>
          </div>
          <div className="dashboard-ai-list">
            {recommendations.map((recommendation) => (
              <span key={recommendation.text} className={recommendation.tone}>
                {recommendation.tone === "warning" ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                {recommendation.text}
              </span>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-analysis-grid">
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
                  <span style={{ width: `${Math.max(item.percentage, item.hours > 0 ? 3 : 0)}%` }} data-rank={index + 1}>
                    {item.percentage >= 12 ? `${item.percentage.toFixed(0)}%` : ""}
                  </span>
                </div>
                <small>{item.hours.toFixed(2)}h</small>
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
                  <strong><span>{getMedal(index)}</span>{index + 1}. {collaborator.loginUsuario}</strong>
                  <span>{collaborator.hours.toFixed(2)}h <small>{collaborator.percentage.toFixed(1)}%</small></span>
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

      <section className="dashboard-command-grid secondary">
        <article className="panel dashboard-highlights-panel">
          <div className="dashboard-section-heading">
            <span><Layers3 size={18} /></span>
            <div>
              <h2>Indicadores do Ambiente</h2>
              <p>Métricas consolidadas sem repetir projetos.</p>
            </div>
          </div>
          <div className="dashboard-highlight-list">
            {environmentIndicators.map((item) => (
              <div className="dashboard-highlight-item" key={item.label}>
                <div>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  {item.detail && <small>{item.detail}</small>}
                </div>
              </div>
            ))}
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

function buildEnvironmentIndicators(projects: DashboardRecentProject[], projectsCount: number): EnvironmentIndicator[] {
  const highestVolume = [...projects].sort((a, b) => b.totalHours - a.totalHours)[0];
  const analyzedProjects = Math.max(projectsCount || projects.length, 1);
  const totalHours = projects.reduce((total, project) => total + project.totalHours, 0);
  const totalCollaborators = projects.reduce((total, project) => total + project.collaboratorsCount, 0);
  const totalRework = projects.reduce((total, project) => total + project.reworkHours, 0);

  return [
    {
      label: "Projeto com maior volume",
      value: highestVolume?.projectName ?? "Não disponível",
      detail: highestVolume ? `${highestVolume.totalHours.toFixed(2)}h analisadas` : undefined,
    },
    {
      label: "Média de horas por projeto",
      value: `${(totalHours / analyzedProjects).toFixed(2)}h`,
      detail: `${projectsCount} projeto(s) analisado(s)`,
    },
    {
      label: "Média de colaboradores por projeto",
      value: `${(totalCollaborators / analyzedProjects).toFixed(1)}`,
      detail: "colaboradores por projeto",
    },
    {
      label: "Retrabalho médio do ambiente",
      value: `${(totalRework / analyzedProjects).toFixed(2)}h`,
      detail: "média por projeto",
    },
  ];
}

function buildAiRecommendations(overview: DashboardOverview, isHealthy: boolean, totalPending: number) {
  const recommendations: Array<{ text: string; tone: "info" | "success" | "warning" | "critical" }> = [];
  const topCategory = buildCategoryDistribution(overview.categorySummary)[0];
  const reworkCategory = overview.categorySummary.find((item) => item.category === "Retrabalho");

  recommendations.push({
    text: isHealthy ? "Ambiente saudável" : `${totalPending} pendência(s) exigem revisão`,
    tone: isHealthy ? "success" : totalPending >= 10 ? "critical" : "warning",
  });
  recommendations.push({
    text: isHealthy ? "Nenhuma inconsistência encontrada" : "Existem pontos operacionais para análise",
    tone: isHealthy ? "success" : "warning",
  });
  recommendations.push({
    text: isHealthy ? "Todos os projetos classificados" : "Há classificações pendentes ou de baixa confiança",
    tone: isHealthy ? "success" : "warning",
  });

  if (reworkCategory) {
    recommendations.push({
      text: reworkCategory.percentage <= 10
        ? "Retrabalho abaixo da média"
        : `Retrabalho em ${reworkCategory.percentage.toFixed(1)}% do esforço`,
      tone: reworkCategory.percentage <= 10 ? "success" : reworkCategory.percentage >= 20 ? "critical" : "warning",
    });
  }

  if (topCategory) {
    recommendations.push({
      text: `Categoria predominante: ${topCategory.category} (${topCategory.percentage.toFixed(1)}%)`,
      tone: topCategory.percentage >= 55 ? "warning" : "info",
    });
  }

  return recommendations.slice(0, 5);
}

function formatProjectStatus(status: string) {
  if (status.toLowerCase() === "concluido") {
    return "Concluído";
  }
  return status;
}

function getMedal(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
}
