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
  const cumulativeData = useMemo(() => buildCumulativeData(projectTimelineCharts.dailyTotal), [projectTimelineCharts.dailyTotal]);

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

        <ProjectTimelineChart
          title={selectedChart.title}
          description={selectedChart.description}
          data={projectTimelineCharts[activeChartId]}
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

function getPeriodicityFromChartId(chartId: TimelineChartId): ChartPeriodicity {
  if (chartId === "weeklyByUser" || chartId === "weeklyByCategory") return "weekly";
  if (chartId === "monthlyByCategory") return "monthly";
  return "daily";
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
