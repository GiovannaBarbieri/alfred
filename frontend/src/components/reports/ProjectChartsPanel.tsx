import { BarChart3, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { HoursReportItem, ProjectExecutiveSummary, ProjectTimelineCharts, ProjectTimelinePoint } from "../../types";
import { formatPeriodBR } from "../../utils/date";
import { ProjectTimelineChart } from "../ProjectTimelineChart";
import { timelineCharts, type TimelineChartId } from "./reportsConfig";

type ProjectChartsPanelProps = {
  selectedChartId: TimelineChartId;
  projectExecutiveSummary: ProjectExecutiveSummary;
  projectTimelineCharts: ProjectTimelineCharts;
  onSelectedChartChange: (chartId: TimelineChartId) => void;
};

type SpecificTab = "collaborators" | "categories";

const donutColors = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#0891b2", "#64748b"];
const collaboratorChartIds: TimelineChartId[] = ["dailyByUser", "weeklyByUser"];
const categoryChartIds: TimelineChartId[] = ["dailyByCategory", "weeklyByCategory", "monthlyByCategory"];

export function ProjectChartsPanel({
  selectedChartId,
  projectExecutiveSummary,
  projectTimelineCharts,
  onSelectedChartChange,
}: ProjectChartsPanelProps) {
  const initialTab = categoryChartIds.includes(selectedChartId) ? "categories" : "collaborators";
  const [activeTab, setActiveTab] = useState<SpecificTab>(initialTab);
  const activeChartIds = activeTab === "collaborators" ? collaboratorChartIds : categoryChartIds;
  const fallbackChartId = activeChartIds[0];
  const activeChartId = activeChartIds.includes(selectedChartId) ? selectedChartId : fallbackChartId;
  const selectedChart = timelineCharts.find((chart) => chart.id === activeChartId) ?? timelineCharts[1];
  const cumulativeData = useMemo(() => buildCumulativeData(projectTimelineCharts.dailyTotal), [projectTimelineCharts.dailyTotal]);

  function handleTabChange(tab: SpecificTab) {
    setActiveTab(tab);
    onSelectedChartChange(tab === "collaborators" ? collaboratorChartIds[0] : categoryChartIds[0]);
  }

  return (
    <>
      <ProjectTimelineChart
        title="Evolução Diária do Projeto"
        description="Tendência diária do volume total de horas apontadas no projeto."
        data={projectTimelineCharts.dailyTotal}
      />

      <CategoryDonutChart items={projectExecutiveSummary.categories} />

      <CumulativeHoursChart data={cumulativeData} />

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

        <section className="timeline-selector compact" aria-label="Gráficos especializados do projeto">
          {activeChartIds.map((chartId) => {
            const chart = timelineCharts.find((item) => item.id === chartId);
            if (!chart) return null;
            return (
              <button
                className={`timeline-selector-button ${activeChartId === chart.id ? "active" : ""}`}
                key={chart.id}
                type="button"
                onClick={() => onSelectedChartChange(chart.id)}
              >
                <BarChart3 size={16} />
                <span>{chart.title}</span>
              </button>
            );
          })}
        </section>

        <ProjectTimelineChart
          title={selectedChart.title}
          description={selectedChart.description}
          data={projectTimelineCharts[activeChartId]}
          chartType={activeChartId === "weeklyByUser" ? "bar" : "line"}
          seriesSummaryTitle={activeTab === "collaborators" ? "Top colaboradores" : "Top categorias"}
        />
      </section>
    </>
  );
}

function buildCumulativeData(data: ProjectTimelinePoint[]) {
  let total = 0;
  return [...data]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((point) => {
      total += point.horas;
      return {
        period: point.period,
        label: formatPeriodBR(point.period),
        horas: Number(total.toFixed(2)),
      };
    });
}

function CategoryDonutChart({ items }: { items: HoursReportItem[] }) {
  const chartData = items.slice(0, 6).map((item) => ({
    name: item.label || item.key,
    value: Number(item.totalHours.toFixed(2)),
    percentage: item.percentage,
  }));
  const dominantValue = Math.max(...chartData.map((item) => item.value), 0);

  return (
    <section className="panel category-donut-panel">
      <div className="reports-section-title">
        <PieChartIcon size={18} />
        <div>
          <h2>Distribuição das Horas por Categoria</h2>
          <p className="muted">Leitura visual da composição de esforço por categoria.</p>
        </div>
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
                  <span className="category-donut-progress" aria-hidden="true">
                    <span
                      style={{
                        background: donutColors[index % donutColors.length],
                        width: `${Math.max(item.percentage, 3)}%`,
                      }}
                    />
                  </span>
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

function CumulativeHoursChart({ data }: { data: Array<{ period: string; label: string; horas: number }> }) {
  return (
    <section className="panel cumulative-hours-panel">
      <div className="reports-section-title">
        <TrendingUp size={18} />
        <div>
          <h2>Evolução Acumulada de Horas</h2>
          <p className="muted">Crescimento do esforço ao longo do projeto.</p>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="chart-empty-state compact">Sem dados acumulados para exibir.</div>
      ) : (
        <div className="mini-line-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 0, right: 10, top: 8, bottom: 0 }}>
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis tickLine={false} axisLine={false} width={42} />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(2)}h`, "Horas acumuladas"]}
                labelFormatter={(_, payload) => formatPeriodBR(String(payload?.[0]?.payload?.period ?? ""))}
              />
              <Line type="monotone" dataKey="horas" stroke="#2563eb" strokeWidth={2.8} dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
