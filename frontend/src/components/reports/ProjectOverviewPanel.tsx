import { AlertTriangle, ChevronDown, Gauge, Target } from "lucide-react";
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
            <h2>Resumo inteligente</h2>
            <p className="muted">Leitura automatica baseada nos numeros do projeto.</p>
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
            <h2>Analises principais</h2>
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
              {projectInsights.cards.map((insight) => (
                <article className={`project-insight-card ${insight.tone}`} key={`${insight.kind}-${insight.title}`}>
                  <span>{insight.title}</span>
                  <strong title={formatInsightValue(insight)}>{formatInsightValue(insight)}</strong>
                  <small>{insight.detail}</small>
                </article>
              ))}
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
            <h2>Resumo executivo</h2>
            <p className="muted">KPIs, rankings e distribuicao principal para tomada de decisao.</p>
          </div>
          <ChevronDown size={20} />
        </button>

        {isExecutiveSummaryOpen && (
          <>
            <div className="executive-metrics-grid">
              <span><strong>{projectExecutiveSummary.metrics.totalDuration}</strong><small>Total apontado</small></span>
              <span><strong>{projectExecutiveSummary.metrics.collaboratorsCount}</strong><small>Colaboradores</small></span>
              <span><strong>{projectExecutiveSummary.metrics.tasksCount}</strong><small>Tasks</small></span>
            </div>

            <div className="executive-summary-grid">
              <ExecutiveSummaryList title="Top colaboradores" items={projectExecutiveSummary.topUsers} />
              <ExecutiveSummaryList title="Top Tasks" items={projectExecutiveSummary.topTasks} showKey />
              <ExecutiveSummaryList title="Categorias" items={projectExecutiveSummary.categories} />
            </div>
          </>
        )}
      </section>
    </>
  );
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
