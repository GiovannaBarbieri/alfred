import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  FileSpreadsheet,
  Layers3,
  RotateCcw,
  UsersRound,
} from "lucide-react";
import type { DashboardCategorySummary, DashboardOverview, DashboardRecentProject } from "../types";
import { formatDateTimeBR } from "../utils/date";

type DashboardPageProps = {
  overview: DashboardOverview;
};

type QuickKpi = {
  label: string;
  value: string;
  detail?: string;
  icon: JSX.Element;
  tooltip: string;
};

type EnvironmentIndicator = {
  label: string;
  value: string;
  detail?: string;
  icon: JSX.Element;
};

export function DashboardPage({
  overview,
}: DashboardPageProps) {
  const latestProject = overview.recentProjects[0];
  const totalPending = getTotalPending(overview);
  const isHealthy = totalPending === 0;
  const categoryDistribution = buildCategoryDistribution(overview.categorySummary);
  const environmentIndicators = buildEnvironmentIndicators(overview.recentProjects, overview.summary.projectsCount);
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
      value: latestImportParts.length >= 2 ? `${latestImportParts[0]} às ${latestImportParts[1]}` : "-",
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
                  <strong><span>{getCategoryIcon(item.category)}</span>{item.category}</strong>
                  <span className="dashboard-percent-value">{item.percentage.toFixed(1)}%</span>
                </div>
                <div className="dashboard-bar-track">
                  <span style={{ width: `${Math.max(item.percentage, item.hours > 0 ? 3 : 0)}%` }} data-rank={index + 1} />
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
                  <span className="dashboard-collaborator-meta"><b>{collaborator.hours.toFixed(2)}h</b><em>{collaborator.percentage.toFixed(1)}%</em></span>
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
                <span className="dashboard-highlight-icon">{item.icon}</span>
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

function getTotalPending(overview: DashboardOverview) {
  return (
    overview.pendingItems.classificationPending +
    overview.pendingItems.lowConfidence +
    overview.pendingItems.collaboratorsWithoutProfile +
    overview.pendingItems.alertsPending
  );
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
      icon: <Layers3 size={16} />,
    },
    {
      label: "Média de horas por projeto",
      value: `${(totalHours / analyzedProjects).toFixed(2)}h`,
      detail: `${projectsCount} projeto(s) analisado(s)`,
      icon: <Clock3 size={16} />,
    },
    {
      label: "Média de colaboradores por projeto",
      value: `${(totalCollaborators / analyzedProjects).toFixed(1)}`,
      detail: "colaboradores por projeto",
      icon: <UsersRound size={16} />,
    },
    {
      label: "Retrabalho médio do ambiente",
      value: `${(totalRework / analyzedProjects).toFixed(2)}h`,
      detail: "média por projeto",
      icon: <RotateCcw size={16} />,
    },
  ];
}

function getMedal(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
}

function getCategoryIcon(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("desenvolvimento")) return "💻";
  if (normalized.includes("acompanhamento")) return "📋";
  if (normalized.includes("defini")) return "📑";
  if (normalized.includes("homologa")) return "🧪";
  if (normalized.includes("retrabalho")) return "🔁";
  if (normalized.includes("impedimento")) return "🚫";
  return "•";
}
