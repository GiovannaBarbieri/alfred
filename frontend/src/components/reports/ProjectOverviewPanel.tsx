import { AlertTriangle, BriefcaseBusiness, CalendarRange, ChevronDown, Gauge, Target, UserRound } from "lucide-react";
import type { ReactNode } from "react";

import type { ProjectExecutiveSummary, ProjectInsightCard, ProjectInsights } from "../../types";
import { formatPeriodBR, formatWeekRangeBR } from "../../utils/date";
import { ExecutiveSummaryList } from "./ExecutiveSummaryList";

type ProjectOverviewPanelProps = {
  projectInsights: ProjectInsights;
  projectExecutiveSummary: ProjectExecutiveSummary;
  isSmartSummaryOpen: boolean;
  isProjectInsightsOpen: boolean;
  isExecutiveSummaryOpen: boolean;
  onToggleSmartSummary: () => void;
  onToggleProjectInsights: () => void;
  onToggleExecutiveSummary: () => void;
};

export function ProjectOverviewPanel({
  projectInsights,
  projectExecutiveSummary,
  isSmartSummaryOpen,
  isProjectInsightsOpen,
  isExecutiveSummaryOpen,
  onToggleSmartSummary,
  onToggleProjectInsights,
  onToggleExecutiveSummary,
}: ProjectOverviewPanelProps) {
  const smartSummary = buildSmartSummary(projectExecutiveSummary);
  const executiveAlerts = buildExecutiveAlerts(projectExecutiveSummary);
  const topThreeUsers = projectExecutiveSummary.topUsers.slice(0, 3);
  const topThreeCategories = projectExecutiveSummary.categories.slice(0, 3);

  return (
    <>
      <section className="panel smart-summary-panel">
        <button
          className="executive-summary-toggle"
          type="button"
          aria-expanded={isSmartSummaryOpen}
          onClick={onToggleSmartSummary}
        >
          <div>
            <h2>Resumo Inteligente <span className="accordion-badge">IA</span></h2>
            <p className="muted">Leitura automática baseada nos números do projeto.</p>
          </div>
          <ChevronDown size={20} />
        </button>
        {isSmartSummaryOpen && (
          smartSummary.length === 0 ? (
            <div className="chart-empty-state compact">
              <strong>Sem dados suficientes</strong>
              <span>Conclua uma importação para gerar leituras automaticas do projeto.</span>
            </div>
          ) : (
            <div className="smart-summary-grid">
              {smartSummary.map((item) => (
                <article className={`smart-summary-card ${item.tone}`} key={item.title}>
                  <span>{item.icon}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))}
            </div>
          )
        )}
      </section>

      <section className="panel project-insights-panel">
        <button
          className="executive-summary-toggle"
          type="button"
          aria-expanded={isProjectInsightsOpen}
          onClick={onToggleProjectInsights}
        >
          <div>
            <h2>Análises Principais <span className="accordion-badge">Insights</span></h2>
            <p className="muted">Resumo executivo dos pontos mais relevantes deste projeto.</p>
          </div>
          <ChevronDown size={20} />
        </button>
        {isProjectInsightsOpen && (
          projectInsights.cards.length === 0 ? (
            <div className="chart-empty-state compact">
              <strong>Sem análises calculadas</strong>
              <span>Conclua uma importação com dados validos para exibir os destaques.</span>
            </div>
          ) : (
            <div className="project-insights-grid">
              {projectInsights.cards.map((insight) => {
                const identity = getInsightIdentity(insight.kind);
                return (
                  <article className={`project-insight-card ${insight.tone} ${identity.className}`} key={`${insight.kind}-${insight.title}`}>
                    <span className="project-insight-title"><span>{identity.icon}</span>{identity.label}</span>
                    <strong title={formatInsightValue(insight)}>{formatInsightValue(insight)}</strong>
                    <small>{insight.detail}</small>
                  </article>
                );
              })}
            </div>
          )
        )}
      </section>

      <section className="panel executive-summary-panel">
        <button
          className="executive-summary-toggle"
          type="button"
          aria-expanded={isExecutiveSummaryOpen}
          onClick={onToggleExecutiveSummary}
        >
          <div>
            <h2>Resumo Executivo <span className="accordion-badge">KPIs</span></h2>
            <p className="muted">KPIs, rankings e distribuição principal para tomada de decisão.</p>
          </div>
          <ChevronDown size={20} />
        </button>

        {isExecutiveSummaryOpen && (
          <>
            <div className="executive-summary-grid">
              <ExecutiveSummaryList title="Top 3 Colaboradores" items={topThreeUsers} />
              <ExecutiveSummaryList title="Top 3 Categorias" items={topThreeCategories} />
              <ExecutiveSummaryList title="Top Tasks" items={projectExecutiveSummary.topTasks} showKey />
              <div className="executive-summary-card executive-alerts-card">
                <h3>Alertas Executivos</h3>
                <ul className="executive-alert-list">
                  {executiveAlerts.map((alert) => (
                    <li className={alert.tone} key={alert.message}>{alert.icon} {alert.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function buildExecutiveAlerts(projectExecutiveSummary: ProjectExecutiveSummary) {
  const alerts: Array<{ tone: "success" | "warning" | "danger"; icon: string; message: string }> = [];
  const topCategory = projectExecutiveSummary.categories[0];
  const topUser = projectExecutiveSummary.topUsers[0];
  const rework = projectExecutiveSummary.categories.find((item) =>
    `${item.key} ${item.label}`.toLowerCase().includes("retrabalho"),
  );

  if (topCategory && topCategory.percentage > 45) {
    alerts.push({
      tone: "warning",
      icon: "🟡",
      message: `Categoria ${topCategory.label || topCategory.key} representa ${topCategory.percentage.toFixed(1)}% das horas`,
    });
  }

  if (topUser && topUser.percentage > 35) {
    alerts.push({
      tone: "danger",
      icon: "🔴",
      message: `${topUser.label || topUser.key} concentra ${topUser.percentage.toFixed(1)}% do esforço total`,
    });
  }

  if (rework && rework.percentage > 10) {
    alerts.push({
      tone: "warning",
      icon: "🟠",
      message: `Retrabalho acima de 10% (${rework.percentage.toFixed(1)}%)`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      tone: "success",
      icon: "🟢",
      message: "Nenhum alerta relevante encontrado",
    });
  }

  return alerts;
}

function getInsightIdentity(kind: string): { className: string; label: string; icon: ReactNode } {
  if (kind === "top_user") {
    return { className: "collaborator", label: "Colaborador destaque", icon: <UserRound size={15} /> };
  }
  if (kind === "top_category") {
    return { className: "category", label: "Categoria predominante", icon: <Target size={15} /> };
  }
  if (kind === "top_task") {
    return { className: "task", label: "Task com maior esforço", icon: <BriefcaseBusiness size={15} /> };
  }
  if (kind === "peak_week") {
    return { className: "week", label: "Semana com maior volume", icon: <CalendarRange size={15} /> };
  }
  if (kind.toLowerCase().includes("retrabalho")) {
    return { className: "rework", label: "Retrabalho", icon: <AlertTriangle size={15} /> };
  }
  return { className: "default", label: "Insight executivo", icon: <Gauge size={15} /> };
}

function buildSmartSummary(projectExecutiveSummary: ProjectExecutiveSummary) {
  const topCategory = projectExecutiveSummary.categories[0];
  const topUser = projectExecutiveSummary.topUsers[0];
  const retrabalho = projectExecutiveSummary.categories.find((item) =>
    `${item.key} ${item.label}`.toLowerCase().includes("retrabalho"),
  );
  const pending = projectExecutiveSummary.pending;

  const insights: Array<{
    title: string;
    description: string;
    tone: "info" | "success" | "warning" | "danger";
    icon: ReactNode;
  }> = [];

  if (topCategory) {
    insights.push({
      title: "Categoria dominante",
      description: `${topCategory.label || topCategory.key} concentra ${topCategory.percentage.toFixed(1)}% das horas do projeto.`,
      tone: topCategory.percentage >= 60 ? "warning" : "info",
      icon: <Target size={18} />,
    });
  }

  if (topUser) {
    insights.push({
      title: "Maior participação",
      description: `${topUser.label || topUser.key} representa ${topUser.percentage.toFixed(1)}% do esforço total apontado.`,
      tone: topUser.percentage >= 40 ? "warning" : "info",
      icon: <Gauge size={18} />,
    });
  }

  if (retrabalho && retrabalho.totalHours > 0) {
    insights.push({
      title: "Retrabalho/Bugs",
      description: `Retrabalho/Bugs consumiu ${retrabalho.totalHours.toFixed(2)}h (${retrabalho.percentage.toFixed(1)}%). Vale validar o impacto operacional.`,
      tone: retrabalho.percentage >= 15 ? "danger" : "warning",
      icon: <AlertTriangle size={18} />,
    });
  }

  if (pending.open > 0) {
    insights.push({
      title: "Confiabilidade da análise",
      description: `${pending.open} pendência(s) aberta(s) podem afetar a leitura final. Revise antes de compartilhar o relatório.`,
      tone: pending.open >= 10 ? "danger" : "warning",
      icon: <AlertTriangle size={18} />,
    });
  }

  if (pending.lowConfidence > 0) {
    insights.push({
      title: "Baixa confiança",
      description: `${pending.lowConfidence} classificação(oes) com baixa confiança merecem revisão para melhorar a precisão das categorias.`,
      tone: "warning",
      icon: <Gauge size={18} />,
    });
  }

  return insights.slice(0, 6);
}

function formatInsightValue(insight: ProjectInsightCard) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(insight.value)) return insight.value;
  return insight.kind === "peak_week" ? formatWeekRangeBR(insight.value) : formatPeriodBR(insight.value);
}
