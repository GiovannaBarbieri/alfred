import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, Layers3, Sparkles, UserRoundX, UsersRound } from "lucide-react";
import { Metric } from "../components/Metric";
import type { DashboardOverview } from "../types";
import { formatDateBR } from "../utils/date";

type DashboardPageProps = {
  overview: DashboardOverview;
  onOpenReport: (importId: number) => void;
};

export function DashboardPage({
  overview,
  onOpenReport,
}: DashboardPageProps) {
  const hasProjects = overview.recentProjects.length > 0;
  const topProject = [...overview.recentProjects].sort((a, b) => b.totalHours - a.totalHours)[0];
  const confidenceInsight =
    overview.pendingItems.lowConfidence > 0
      ? `${overview.pendingItems.lowConfidence} classificacoes com baixa confianca merecem uma olhada.`
      : "Classificacoes sem fila relevante de baixa confianca.";
  const profileInsight =
    overview.pendingItems.collaboratorsWithoutProfile > 0
      ? `${overview.pendingItems.collaboratorsWithoutProfile} colaborador${overview.pendingItems.collaboratorsWithoutProfile === 1 ? "" : "es"} sem perfil operacional cadastrado.`
      : "Todos os colaboradores importados possuem perfil operacional ativo.";
  const pendingCards = [
    {
      label: "Classificacoes pendentes",
      value: overview.pendingItems.classificationPending,
      icon: <CheckCircle2 size={18} />,
    },
    {
      label: "Baixa confianca",
      value: overview.pendingItems.lowConfidence,
      icon: <AlertTriangle size={18} />,
    },
    {
      label: "Colaboradores sem perfil",
      value: overview.pendingItems.collaboratorsWithoutProfile,
      icon: <UserRoundX size={18} />,
    },
  ];

  return (
    <>
      <section className="metrics-grid" aria-label="Indicadores principais">
        <Metric label="Total de horas importadas" value={String(overview.summary.totalHours)} icon={<Clock3 size={18} />} />
        <Metric label="Projetos analisados" value={String(overview.summary.projectsCount)} icon={<Layers3 size={18} />} />
        <Metric label="Colaboradores" value={String(overview.summary.collaboratorsCount)} icon={<UsersRound size={18} />} />
      </section>

      <section className="dashboard-insights-grid">
        <article className="panel dashboard-insights-panel">
          <div className="result-heading">
            <div className="panel-heading compact-heading">
              <Sparkles size={18} />
              <h2>Insights operacionais</h2>
            </div>
            <span>{hasProjects ? "ativo" : "vazio"}</span>
          </div>
          <div className="insight-list">
            <div className="insight-item info">
              <CheckCircle2 size={17} />
              <span>{confidenceInsight}</span>
            </div>
            <div className="insight-item neutral">
              <UserRoundX size={17} />
              <span>{profileInsight}</span>
            </div>
            {topProject && (
              <div className="insight-item strong">
                <Layers3 size={17} />
                <span>
                  Projeto com maior volume recente: <strong>{topProject.projectName}</strong> com {topProject.totalHours}h.
                </span>
              </div>
            )}
          </div>
        </article>

        <section className="panel pending-panel">
          <div className="result-heading">
            <h2>O que precisa da minha atencao?</h2>
          </div>
          <div className="pending-list">
            {pendingCards.map((item) => (
              <div className="pending-card" key={item.label}>
                <span>{item.icon}</span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            ))}
          </div>
        </section>
      </section>

      <section className="dashboard-focus-grid">
        <section className="panel recent-projects-panel">
          <div className="result-heading">
            <h2>Ultimos projetos analisados</h2>
            <span>{overview.recentProjects.length}</span>
          </div>
          {hasProjects ? (
            <div className="recent-project-list">
              {overview.recentProjects.map((project) => (
                <article className="recent-project-card" key={project.importId}>
                  <div className="recent-project-main">
                    <strong>{project.projectName}</strong>
                    <small>{formatDateBR(project.importedAt)} - {project.status}</small>
                  </div>
                  <div className="recent-project-stats">
                    <span>{project.totalHours}h</span>
                    <span>{project.recordsCount} registros</span>
                  </div>
                  <button className="secondary-button compact recent-project-action" type="button" onClick={() => onOpenReport(project.importId)}>
                    Abrir <ArrowUpRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <strong>Nenhum projeto importado ainda</strong>
              <p className="muted">Conclua uma importacao para acompanhar projetos, pendencias e categorias neste painel.</p>
            </div>
          )}
        </section>

      </section>
    </>
  );
}
