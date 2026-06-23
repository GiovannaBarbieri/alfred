import { AlertTriangle, BriefcaseBusiness, CalendarDays, CalendarRange, ChevronDown, Target, Trophy } from "lucide-react";
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
            <p className="muted">Interpretação automática baseada nos números do projeto.</p>
          </div>
          <ChevronDown size={20} />
        </button>
        {isSmartSummaryOpen && (
          smartSummary.length === 0 ? (
            <div className="chart-empty-state compact">
              <strong>Sem dados suficientes</strong>
              <span>Conclua uma importação para gerar leituras automáticas do projeto.</span>
            </div>
          ) : (
            <div className="smart-summary-text-block">
              {smartSummary.map((sentence) => (
                <p key={sentence}>{sentence}</p>
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
            <h2>📊 Destaques do Projeto <span className="accordion-badge">Insights</span></h2>
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
  if (kind === "top_user" || kind === "concentration") {
    return { className: "collaborator", label: "Maior Participação", icon: <Trophy size={15} /> };
  }
  if (kind === "top_category") {
    return { className: "category", label: "Categoria Predominante", icon: <Target size={15} /> };
  }
  if (kind === "top_task") {
    return { className: "task", label: "Task com Maior Esforço", icon: <BriefcaseBusiness size={15} /> };
  }
  if (kind === "peak_day" || kind === "top_day" || kind === "daily_peak") {
    return { className: "day", label: "Dia com Maior Volume", icon: <CalendarDays size={15} /> };
  }
  if (kind === "peak_week") {
    return { className: "week", label: "Semana com Maior Volume", icon: <CalendarRange size={15} /> };
  }
  if (kind.toLowerCase().includes("retrabalho")) {
    return { className: "rework", label: "Retrabalho", icon: <AlertTriangle size={15} /> };
  }
  return { className: "default", label: "Destaque do Projeto", icon: <Target size={15} /> };
}

function buildSmartSummary(projectExecutiveSummary: ProjectExecutiveSummary) {
  const topCategory = projectExecutiveSummary.categories[0];
  const topUser = projectExecutiveSummary.topUsers[0];
  const retrabalho = projectExecutiveSummary.categories.find((item) =>
    `${item.key} ${item.label}`.toLowerCase().includes("retrabalho"),
  );
  const pending = projectExecutiveSummary.pending;
  const metrics = projectExecutiveSummary.metrics;
  const sentences: string[] = [];

  sentences.push(
    `O projeto possui ${metrics.totalHours.toFixed(2)}h apontadas distribuídas entre ${metrics.collaboratorsCount} colaboradores e ${metrics.tasksCount} tasks analisadas.`,
  );

  if (topCategory) {
    const categoryLabel = topCategory.label || topCategory.key;
    const categoryReading =
      topCategory.percentage >= 55
        ? "indicando forte concentração da atuação nessa frente."
        : "sendo a principal frente de atuação do período.";
    sentences.push(
      `A categoria ${categoryLabel} concentra ${topCategory.percentage.toFixed(1)}% do esforço total, ${categoryReading}`,
    );
  }

  if (topUser) {
    const userLabel = topUser.label || topUser.key;
    const userReading =
      topUser.percentage >= 35
        ? "sugerindo dependência relevante dessa participação individual."
        : "sem indicar concentração individual crítica.";
    sentences.push(
      `${userLabel} possui a maior participação individual, representando ${topUser.percentage.toFixed(1)}% das horas registradas, ${userReading}`,
    );
  }

  if (retrabalho && retrabalho.totalHours > 0) {
    const reworkReading =
      retrabalho.percentage >= 10
        ? "merecendo acompanhamento por representar uma fatia relevante do esforço."
        : "indicando um nível controlado de reexecução de atividades.";
    sentences.push(
      `O volume de retrabalho corresponde a ${retrabalho.percentage.toFixed(1)}% das horas do projeto, ${reworkReading}`,
    );
  }

  if (pending.lowConfidence > 0) {
    sentences.push(
      `${pending.lowConfidence} classificação(ões) com baixa confiança podem afetar a precisão das categorias e devem ser revisadas antes do compartilhamento executivo.`,
    );
  }

  return sentences.slice(0, 5);
}

function formatInsightValue(insight: ProjectInsightCard) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(insight.value)) return insight.value;
  return insight.kind === "peak_week" ? formatWeekRangeBR(insight.value) : formatPeriodBR(insight.value);
}
