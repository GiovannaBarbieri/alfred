import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CircleGauge,
  Clock3,
  Database,
  FileSpreadsheet,
  Layers3,
  Sparkles,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardOverview, DashboardRecentProject, TimelinePoint } from "../types";
import { formatDateBR, formatDateTimeBR } from "../utils/date";

type DashboardPageProps = {
  overview: DashboardOverview;
  onOpenReport: (importId: number) => void;
};

type QuickKpi = {
  label: string;
  value: string;
  icon: JSX.Element;
};

type AttentionItem = {
  label: string;
  value: number;
  icon: JSX.Element;
};

export function DashboardPage({
  overview,
  onOpenReport,
}: DashboardPageProps) {
  const hasProjects = overview.recentProjects.length > 0;
  const latestProject = overview.recentProjects[0];
  const topProject = [...overview.recentProjects].sort((a, b) => b.totalHours - a.totalHours)[0];
  const dominantCategory = [...overview.categorySummary].sort((a, b) => b.hours - a.hours)[0];
  const pendingItems = buildAttentionItems(overview);
  const totalPending = pendingItems.reduce((total, item) => total + item.value, 0);
  const isHealthy = totalPending === 0;
  const timelineData = buildTimelineData(overview.timeline);
  const activityItems = buildActivityItems(overview.recentProjects);
  const kpis: QuickKpi[] = [
    {
      label: "Horas analisadas",
      value: `${overview.summary.totalHours.toFixed(2)}h`,
      icon: <Clock3 size={17} />,
    },
    {
      label: "Projetos analisados",
      value: String(overview.summary.projectsCount),
      icon: <Layers3 size={17} />,
    },
    {
      label: "Registros importados",
      value: String(overview.summary.totalRecords),
      icon: <Database size={17} />,
    },
    {
      label: "Colaboradores",
      value: String(overview.summary.collaboratorsCount),
      icon: <UsersRound size={17} />,
    },
    {
      label: "Ultima importacao",
      value: latestProject ? formatDateBR(latestProject.importedAt) : "-",
      icon: <FileSpreadsheet size={17} />,
    },
  ];

  return (
    <section className="dashboard-command-center">
      <div className="dashboard-command-meta">
        <span>Centro de comando da analise operacional.</span>
        <small>
          Ultima atualizacao: {latestProject ? formatDateTimeBR(latestProject.importedAt) : "sem importacoes"}
        </small>
      </div>

      <section className="dashboard-kpi-grid" aria-label="Indicadores principais">
        {kpis.map((item) => (
          <article className="dashboard-kpi-card" key={item.label}>
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
              <h2>{isHealthy ? "Sistema saudavel" : "Atencao operacional"}</h2>
              <p>{isHealthy ? "Nenhuma inconsistencia relevante encontrada." : `${totalPending} ponto(s) precisam de revisao.`}</p>
            </div>
          </div>
          <div className="dashboard-status-lines">
            {isHealthy ? (
              <>
                <span>Todos colaboradores classificados</span>
                <span>Nenhuma pendencia operacional</span>
                <span>Sem alertas pendentes</span>
              </>
            ) : (
              pendingItems.filter((item) => item.value > 0).map((item) => (
                <span key={item.label}>
                  {item.value} {item.label}
                </span>
              ))
            )}
          </div>
        </article>

        <article className="panel dashboard-attention-panel">
          <div className="dashboard-section-heading compact">
            <span><CircleGauge size={18} /></span>
            <div>
              <h2>O que precisa da minha atencao?</h2>
              <p>Fila operacional consolidada.</p>
            </div>
          </div>
          {isHealthy ? (
            <div className="dashboard-clear-message">
              <CheckCircle2 size={17} />
              <span>Nenhuma pendencia operacional encontrada.</span>
            </div>
          ) : (
            <div className="dashboard-attention-list">
              {pendingItems.filter((item) => item.value > 0).map((item) => (
                <div className="dashboard-attention-item" key={item.label}>
                  <span>{item.icon}</span>
                  <strong>{item.value}</strong>
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-main-grid">
        <article className="panel dashboard-intelligence-card">
          <div className="dashboard-section-heading">
            <span><Sparkles size={18} /></span>
            <div>
              <h2>Analise Inteligente</h2>
              <p>Leitura automatica do ambiente.</p>
            </div>
          </div>
          <p>{buildIntelligentSummary({ isHealthy, totalPending, topProject, dominantCategory })}</p>
        </article>

        <article className="panel dashboard-insights-panel">
          <div className="dashboard-section-heading">
            <span><Sparkles size={18} /></span>
            <div>
              <h2>Insights Inteligentes</h2>
              <p>Sinais rapidos sobre os dados importados.</p>
            </div>
          </div>
          <div className="dashboard-insight-list">
            {topProject && (
              <DashboardInsight
                icon={<Layers3 size={16} />}
                title="Projeto com maior volume"
                description={`${topProject.projectName} concentra ${topProject.totalHours.toFixed(2)}h analisadas.`}
              />
            )}
            {dominantCategory && dominantCategory.hours > 0 && (
              <DashboardInsight
                icon={<BarChart3 size={16} />}
                title="Categoria predominante"
                description={`${dominantCategory.category} representa ${dominantCategory.percentage.toFixed(1)}% das horas.`}
              />
            )}
            <DashboardInsight
              icon={isHealthy ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              title={isHealthy ? "Ambiente consistente" : "Pontos de atencao"}
              description={isHealthy ? "Dados recentes sem pendencias relevantes." : `${totalPending} item(ns) pedem revisao operacional.`}
            />
          </div>
        </article>

        <article className="panel dashboard-recent-projects-panel">
          <div className="dashboard-section-heading">
            <span><Layers3 size={18} /></span>
            <div>
              <h2>Ultimos Projetos</h2>
              <p>Importacoes recentes disponiveis para analise.</p>
            </div>
          </div>
          {hasProjects ? (
            <div className="dashboard-project-table-wrap">
              <table className="dashboard-project-table">
                <thead>
                  <tr>
                    <th>Projeto</th>
                    <th>Horas</th>
                    <th>Registros</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th>Acao</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentProjects.map((project) => (
                    <tr key={project.importId}>
                      <td>
                        <strong>{project.projectName}</strong>
                        <small>{project.filename}</small>
                      </td>
                      <td>{project.totalHours.toFixed(2)}h</td>
                      <td>{project.recordsCount}</td>
                      <td><span className="dashboard-status-badge">{project.status}</span></td>
                      <td>{formatDateBR(project.importedAt)}</td>
                      <td>
                        <button className="secondary-button compact dashboard-open-button" type="button" onClick={() => onOpenReport(project.importId)}>
                          Abrir <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-empty-state">
              <strong>Nenhum projeto importado ainda</strong>
              <p className="muted">Conclua uma importacao para acompanhar projetos neste painel.</p>
            </div>
          )}
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="panel dashboard-chart-panel">
          <div className="dashboard-section-heading">
            <span><BarChart3 size={18} /></span>
            <div>
              <h2>Evolucao das horas importadas</h2>
              <p>Resumo visual do volume analisado por periodo.</p>
            </div>
          </div>
          {timelineData.length > 0 ? (
            <div className="dashboard-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={42} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}h`, "Horas"]} />
                  <Line type="monotone" dataKey="horas" stroke="#2563eb" strokeWidth={2.8} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="dashboard-empty-state compact">Sem dados suficientes para exibir o grafico.</div>
          )}
        </article>

        <article className="panel dashboard-activity-panel">
          <div className="dashboard-section-heading">
            <span><Clock3 size={18} /></span>
            <div>
              <h2>Ultimas Atividades</h2>
              <p>Eventos recentes sintetizados das importacoes.</p>
            </div>
          </div>
          {activityItems.length > 0 ? (
            <div className="dashboard-activity-list">
              {activityItems.map((item) => (
                <div className="dashboard-activity-item" key={`${item.time}-${item.title}-${item.detail}`}>
                  <time>{item.time}</time>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-empty-state compact">Nenhuma atividade registrada.</div>
          )}
        </article>
      </section>
    </section>
  );
}

function DashboardInsight({ icon, title, description }: { icon: JSX.Element; title: string; description: string }) {
  return (
    <div className="dashboard-insight-row">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{description}</small>
      </div>
    </div>
  );
}

function buildAttentionItems(overview: DashboardOverview): AttentionItem[] {
  return [
    {
      label: "classificacoes pendentes",
      value: overview.pendingItems.classificationPending,
      icon: <CheckCircle2 size={16} />,
    },
    {
      label: "analises de baixa confianca",
      value: overview.pendingItems.lowConfidence,
      icon: <AlertTriangle size={16} />,
    },
    {
      label: "colaboradores sem perfil",
      value: overview.pendingItems.collaboratorsWithoutProfile,
      icon: <UserRoundX size={16} />,
    },
    {
      label: "alertas pendentes",
      value: overview.pendingItems.alertsPending,
      icon: <AlertTriangle size={16} />,
    },
  ];
}

function buildTimelineData(data: TimelinePoint[]) {
  return data.slice(-18).map((point) => ({
    ...point,
    label: formatDateBR(point.period),
  }));
}

function buildActivityItems(projects: DashboardRecentProject[]) {
  return projects.flatMap((project) => {
    const dateTimeParts = formatDateTimeBR(project.importedAt).split(" ");
    const time = dateTimeParts[dateTimeParts.length - 1] ?? formatDateBR(project.importedAt);
    return [
      {
        time,
        title: "Projeto importado",
        detail: project.projectName,
      },
      {
        time,
        title: "Classificacao concluida",
        detail: `${project.recordsCount} registros consolidados`,
      },
      {
        time,
        title: "Relatorio executivo disponivel",
        detail: project.status,
      },
    ];
  }).slice(0, 5);
}

function buildIntelligentSummary({
  isHealthy,
  totalPending,
  topProject,
  dominantCategory,
}: {
  isHealthy: boolean;
  totalPending: number;
  topProject?: DashboardRecentProject;
  dominantCategory?: { category: string; hours: number; percentage: number };
}) {
  if (!topProject) {
    return "Nenhum projeto foi importado ainda. Assim que a primeira base for consolidada, este painel passara a indicar saude operacional, volume analisado e pontos de atencao.";
  }

  const projectPart = `${topProject.projectName} e o projeto recente com maior volume, com ${topProject.totalHours.toFixed(2)}h analisadas.`;
  const categoryPart = dominantCategory && dominantCategory.hours > 0
    ? `A categoria ${dominantCategory.category} concentra ${dominantCategory.percentage.toFixed(1)}% do esforco.`
    : "Nao ha concentracao de categoria suficiente para destacar.";
  const healthPart = isHealthy
    ? "Nenhuma inconsistencia relevante foi encontrada no ambiente."
    : `${totalPending} ponto(s) exigem revisao antes de considerar o ambiente totalmente saudavel.`;

  return `${healthPart} ${projectPart} ${categoryPart}`;
}
