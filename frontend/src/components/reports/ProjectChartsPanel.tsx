import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { HoursReportItem, ProjectExecutiveSummary, ProjectTimelineCharts } from "../../types";
import { ProjectTimelineChart } from "../ProjectTimelineChart";
import { ChartExportButton } from "../general-indicators/ChartExportButton";
import { projectAdjustmentColor } from "./projectChartStyles";
import { timelineCharts, type TimelineChartId } from "./reportsConfig";

type ProjectChartsPanelProps = {
  selectedChartId: TimelineChartId;
  projectExportPrefix: string;
  projectExecutiveSummary: ProjectExecutiveSummary;
  projectTimelineCharts: ProjectTimelineCharts;
  onSelectedChartChange: (chartId: TimelineChartId) => void;
};

type SpecificTab = "collaborators" | "categories";
type ChartPeriodicity = "daily" | "weekly" | "monthly";

const donutColors = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#0891b2", "#64748b"];
const chartIdByTabAndPeriodicity: Record<SpecificTab, Partial<Record<ChartPeriodicity, TimelineChartId>>> = {
  collaborators: {
    daily: "dailyByUser",
    weekly: "weeklyByUser",
  },
  categories: {
    daily: "dailyByCategory",
    weekly: "weeklyByCategory",
    monthly: "monthlyByCategory",
  },
};

export function ProjectChartsPanel({
  selectedChartId,
  projectExportPrefix,
  projectExecutiveSummary,
  projectTimelineCharts,
  onSelectedChartChange,
}: ProjectChartsPanelProps) {
  const initialTab = selectedChartId.includes("Category") ? "categories" : "collaborators";
  const [activeTab, setActiveTab] = useState<SpecificTab>(initialTab);
  const [periodicity, setPeriodicity] = useState<ChartPeriodicity>(() => getPeriodicityFromChartId(selectedChartId));
  const availablePeriodicities = activeTab === "collaborators"
    ? (["daily", "weekly"] as ChartPeriodicity[])
    : (["daily", "weekly", "monthly"] as ChartPeriodicity[]);
  const safePeriodicity = availablePeriodicities.includes(periodicity) ? periodicity : "daily";
  const activeChartId = chartIdByTabAndPeriodicity[activeTab][safePeriodicity] ?? chartIdByTabAndPeriodicity[activeTab].daily!;
  const selectedChart = timelineCharts.find((chart) => chart.id === activeChartId) ?? timelineCharts[1];

  function handleTabChange(tab: SpecificTab) {
    setActiveTab(tab);
    setPeriodicity("daily");
    onSelectedChartChange(chartIdByTabAndPeriodicity[tab].daily!);
  }

  function handlePeriodicityChange(nextPeriodicity: ChartPeriodicity) {
    setPeriodicity(nextPeriodicity);
    const nextChartId = chartIdByTabAndPeriodicity[activeTab][nextPeriodicity];
    if (nextChartId) onSelectedChartChange(nextChartId);
  }

  return (
    <>
      <ProjectTimelineChart
        title="Evolução Diária do Projeto"
        description="Tendência diária do volume total de horas apontadas no projeto."
        data={projectTimelineCharts.dailyTotal}
        chartExportTitle={buildProjectChartExportTitle(projectExportPrefix, "Evolucao Diaria do Projeto")}
      />

      <CategoryDonutChart
        exportTitle={buildProjectChartExportTitle(projectExportPrefix, "Distribuicao das Horas por Categoria")}
        items={projectExecutiveSummary.categories}
      />

      <section className="panel chart-specific-analysis-panel">
        <div className="reports-section-title">
          <BarChart3 size={18} />
          <div>
            <h2>Análises Específicas</h2>
            <p className="muted">Explore tendências por colaborador ou categoria.</p>
          </div>
        </div>

        <div className="chart-specific-tabs" role="tablist" aria-label="Tipo de análise gráfica">
          <button
            className={activeTab === "collaborators" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === "collaborators"}
            onClick={() => handleTabChange("collaborators")}
          >
            Colaboradores
          </button>
          <button
            className={activeTab === "categories" ? "active" : ""}
            type="button"
            role="tab"
            aria-selected={activeTab === "categories"}
            onClick={() => handleTabChange("categories")}
          >
            Categorias
          </button>
        </div>

        <ProjectTimelineChart
          title={selectedChart.title}
          description={selectedChart.description}
          data={projectTimelineCharts[activeChartId]}
          chartExportTitle={buildProjectChartExportTitle(projectExportPrefix, selectedChart.title)}
          seriesSummaryTitle={activeTab === "collaborators" ? "Selecionar colaboradores" : "Selecionar categorias"}
          timelineControl={(
            <label className="chart-periodicity-control">
              <span>Linha do tempo</span>
              <select value={safePeriodicity} onChange={(event) => handlePeriodicityChange(event.target.value as ChartPeriodicity)}>
                <option value="daily">Diária</option>
                <option value="weekly">Semanal</option>
                {activeTab === "categories" && <option value="monthly">Mensal</option>}
              </select>
            </label>
          )}
        />
      </section>
    </>
  );
}

function buildProjectChartExportTitle(projectExportPrefix: string, chartTitle: string) {
  const trimmedPrefix = projectExportPrefix.trim();
  return trimmedPrefix ? `${trimmedPrefix} - ${chartTitle}` : chartTitle;
}

function getPeriodicityFromChartId(chartId: TimelineChartId): ChartPeriodicity {
  if (chartId === "weeklyByUser" || chartId === "weeklyByCategory") return "weekly";
  if (chartId === "monthlyByCategory") return "monthly";
  return "daily";
}

function CategoryDonutChart({ exportTitle, items }: { exportTitle: string; items: HoursReportItem[] }) {
  const chartData = items.slice(0, 6).map((item) => ({
    name: item.label || item.key,
    value: Number(item.totalHours.toFixed(2)),
    percentage: item.percentage,
    developmentAdjustments: item.developmentAdjustments,
  }));
  const dominantValue = Math.max(...chartData.map((item) => item.value), 0);

  return (
    <section
      className="panel category-donut-panel"
      data-chart-export-card="true"
      data-chart-export-period=""
      data-chart-export-title={exportTitle}
    >
      <div className="reports-section-title">
        <PieChartIcon size={18} />
        <div>
          <h2>Distribuição das Horas por Categoria</h2>
          <p className="muted">Leitura visual da composição de esforço por categoria.</p>
        </div>
        <ChartExportButton compact />
      </div>
      {chartData.length === 0 ? (
        <div className="chart-empty-state compact">Sem categorias para exibir.</div>
      ) : (
        <div className="category-donut-layout">
          <div className="category-donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="88%" paddingAngle={3}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={donutColors[index % donutColors.length]}
                      stroke="#ffffff"
                      strokeWidth={entry.value === dominantValue ? 4 : 2}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)}h`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="category-donut-table" role="table" aria-label="Distribuição das horas por categoria">
            <div className="category-donut-table-header" role="row">
              <span>Categoria</span>
              <span>Horas</span>
              <span>%</span>
            </div>
            {chartData.map((item, index) => (
              <div
                className={`category-donut-table-row ${item.value === dominantValue ? "dominant" : ""}`}
                key={item.name}
                role="row"
              >
                <span className="category-donut-category">
                  <span className="category-donut-name">
                    <i style={{ background: donutColors[index % donutColors.length] }} />
                    <strong>
                      #{index + 1} {item.name}
                    </strong>
                    {item.value === dominantValue && <em>Dominante</em>}
                  </span>
                  <CategoryProgressBar
                    color={donutColors[index % donutColors.length]}
                    percentage={item.percentage}
                    developmentAdjustments={item.developmentAdjustments}
                  />
                </span>
                <span>{item.value.toFixed(2)}h</span>
                <span>{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function CategoryProgressBar({
  color,
  percentage,
  developmentAdjustments,
}: {
  color: string;
  percentage: number;
  developmentAdjustments?: HoursReportItem["developmentAdjustments"];
}) {
  const progressWidth = `${Math.max(percentage, 3)}%`;
  if (!developmentAdjustments || developmentAdjustments.adjustmentHours <= 0) {
    return (
      <span className="category-donut-progress">
        <span
          style={{
            background: color,
            width: progressWidth,
          }}
        />
      </span>
    );
  }

  const adjustmentDisplayPercentage =
    developmentAdjustments.adjustmentPercentage > 0 && developmentAdjustments.adjustmentPercentage < 6
      ? 6
      : developmentAdjustments.adjustmentPercentage;
  const regularDisplayPercentage = Math.max(100 - adjustmentDisplayPercentage, 0);

  return (
    <span className="category-donut-progress segmented" style={{ width: progressWidth }}>
      {developmentAdjustments.regularHours > 0 && (
        <span
          className="category-donut-progress-segment"
          style={{
            background: color,
            width: `${regularDisplayPercentage}%`,
          }}
        />
      )}
      <span
        className="category-donut-progress-segment adjustments"
        tabIndex={0}
        style={{
          background: projectAdjustmentColor,
          width: `${adjustmentDisplayPercentage}%`,
        }}
      >
        <span className="category-adjustments-tooltip" role="tooltip">
          <strong>Ajustes de testes cruzados</strong>
          <b>{developmentAdjustments.adjustmentHours.toFixed(2)}h</b>
          <small>{developmentAdjustments.adjustmentPercentage.toFixed(1)}% das horas de Desenvolvimento</small>
        </span>
      </span>
    </span>
  );
}
