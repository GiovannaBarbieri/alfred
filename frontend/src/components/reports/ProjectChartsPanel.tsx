import { BarChart3, ChevronDown, Filter, Flame, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
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

const donutColors = ["#2563eb", "#16a34a", "#f97316", "#7c3aed", "#0891b2", "#64748b"];

export function ProjectChartsPanel({
  selectedChartId,
  projectExecutiveSummary,
  projectTimelineCharts,
  onSelectedChartChange,
}: ProjectChartsPanelProps) {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const specializedCharts = timelineCharts.filter((chart) => chart.id !== "dailyTotal");
  const selectedChart = specializedCharts.find((chart) => chart.id === selectedChartId) ?? specializedCharts[0];
  const selectedChartData = projectTimelineCharts[selectedChart.id];
  const seriesOptions = useMemo(() => getSeriesOptions(selectedChartData), [selectedChartData]);
  const dailyProjectData = useMemo(
    () => filterChartData(projectTimelineCharts.dailyTotal, periodFilter, ""),
    [periodFilter, projectTimelineCharts.dailyTotal],
  );
  const filteredChartData = useMemo(
    () => filterChartData(selectedChartData, periodFilter, seriesFilter),
    [periodFilter, selectedChartData, seriesFilter],
  );
  const heatmapRows = useMemo(() => buildHeatmap(projectTimelineCharts.dailyByUser), [projectTimelineCharts.dailyByUser]);
  const cumulativeData = useMemo(() => buildCumulativeData(projectTimelineCharts.dailyTotal), [projectTimelineCharts.dailyTotal]);

  return (
    <>
      <ProductivityHeatmap rows={heatmapRows} highlighted />

      <ProjectTimelineChart
        title="Evolução Diária do Projeto"
        description="Tendência diária do volume total de horas apontadas no projeto."
        data={dailyProjectData}
      />

      <section className="reports-bi-grid charts-only-grid">
        <CategoryDonutChart items={projectExecutiveSummary.categories} />
        <CumulativeHoursChart data={cumulativeData} />
      </section>

      <section className="reports-analytics-layout">
        <aside className={`panel reports-chart-filters ${filtersOpen ? "open" : "collapsed"}`} aria-label="Filtros dos gráficos">
          <button
            className="reports-chart-filter-toggle"
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <Filter size={18} />
            <span>Filtros Avançados</span>
            <ChevronDown size={17} />
          </button>

          {filtersOpen && (
            <div className="reports-chart-filter-body">
              <p className="muted">Refine a leitura do gráfico atual.</p>

              <label>
                <span>Período</span>
                <select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>
                  <option value="all">Todo o projeto</option>
                  <option value="last30">Últimos 30 dias</option>
                  <option value="last90">Últimos 90 dias</option>
                </select>
              </label>

              <label>
                <span>Colaborador/Categoria</span>
                <select value={seriesFilter} onChange={(event) => setSeriesFilter(event.target.value)}>
                  <option value="">Todas as séries</option>
                  {seriesOptions.map((series) => (
                    <option key={series} value={series}>
                      {series}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </aside>

        <div className="reports-chart-main">
          <section className="timeline-selector" aria-label="Gráficos especializados do projeto">
            {specializedCharts.map((chart) => (
              <button
                className={`timeline-selector-button ${selectedChart.id === chart.id ? "active" : ""}`}
                key={chart.id}
                type="button"
                onClick={() => {
                  setSeriesFilter("");
                  onSelectedChartChange(chart.id);
                }}
              >
                <BarChart3 size={16} />
                <span>{chart.title}</span>
              </button>
            ))}
          </section>

          <ProjectTimelineChart
            title={selectedChart.title}
            description={selectedChart.description}
            data={filteredChartData}
          />
        </div>
      </section>
    </>
  );
}

function getSeriesOptions(data: ProjectTimelinePoint[]) {
  return Array.from(new Set(data.map((item) => item.series).filter(Boolean) as string[])).sort((a, b) =>
    a.localeCompare(b),
  );
}

function filterChartData(data: ProjectTimelinePoint[], periodFilter: string, seriesFilter: string) {
  const dateLimit = getPeriodLimit(periodFilter);
  return data.filter((item) => {
    const matchesSeries = !seriesFilter || item.series === seriesFilter;
    const matchesPeriod = !dateLimit || parsePeriodDate(item.period) >= dateLimit;
    return matchesSeries && matchesPeriod;
  });
}

function getPeriodLimit(periodFilter: string) {
  if (periodFilter === "all") return null;
  const days = periodFilter === "last30" ? 30 : 90;
  const limit = new Date();
  limit.setHours(0, 0, 0, 0);
  limit.setDate(limit.getDate() - days);
  return limit;
}

function parsePeriodDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(0);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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

function buildHeatmap(data: ProjectTimelinePoint[]) {
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const rows = new Map<string, { collaborator: string; values: number[]; total: number }>();

  data.forEach((point) => {
    const collaborator = point.series ?? "Total";
    const date = parsePeriodDate(point.period);
    const weekday = Number.isNaN(date.getTime()) ? 0 : date.getDay();
    const current = rows.get(collaborator) ?? { collaborator, values: [0, 0, 0, 0, 0, 0, 0], total: 0 };
    current.values[weekday] += point.horas;
    current.total += point.horas;
    rows.set(collaborator, current);
  });

  const sortedRows = Array.from(rows.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  const maxValue = Math.max(...sortedRows.flatMap((row) => row.values), 0);

  return sortedRows.map((row) => ({
    collaborator: row.collaborator,
    days: row.values.map((value, index) => ({
      label: weekdays[index],
      value,
      intensity: maxValue > 0 ? value / maxValue : 0,
    })),
  }));
}

function ProductivityHeatmap({
  rows,
  highlighted = false,
}: {
  rows: Array<{
    collaborator: string;
    days: Array<{ label: string; value: number; intensity: number }>;
  }>;
  highlighted?: boolean;
}) {
  return (
    <section className={`panel productivity-heatmap-panel ${highlighted ? "highlighted" : ""}`}>
      <div className="reports-section-title">
        <Flame size={18} />
        <div>
          <span className="visual-primary-badge">Análise visual principal</span>
          <h2>Mapa de calor de produtividade</h2>
          <p className="muted">Visualização da concentração de horas por colaborador e dia da semana.</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="chart-empty-state compact">Sem dados para montar o mapa de calor.</div>
      ) : (
        <div className="productivity-heatmap">
          <div className="productivity-heatmap-header">
            <span></span>
            {rows[0].days.map((day) => (
              <strong key={day.label}>{day.label}</strong>
            ))}
          </div>
          {rows.map((row) => (
            <div className="productivity-heatmap-row" key={row.collaborator}>
              <strong>{row.collaborator}</strong>
              {row.days.map((day) => (
                <span
                  key={`${row.collaborator}-${day.label}`}
                  style={{ opacity: Math.max(0.18, day.intensity) }}
                  title={`${row.collaborator} - ${day.label}: ${day.value.toFixed(2)}h`}
                >
                  {day.value > 0 ? day.value.toFixed(1) : "0"}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryDonutChart({ items }: { items: HoursReportItem[] }) {
  const chartData = items.slice(0, 6).map((item) => ({
    name: item.label || item.key,
    value: Number(item.totalHours.toFixed(2)),
    percentage: item.percentage,
  }));

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
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3}>
                  {chartData.map((entry, index) => (
                    <Cell key={entry.name} fill={donutColors[index % donutColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)}h`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="category-donut-legend">
            {chartData.map((item, index) => (
              <span key={item.name}>
                <i style={{ background: donutColors[index % donutColors.length] }} />
                <strong>{item.name}</strong>
                <small>{item.value.toFixed(2)}h · {item.percentage.toFixed(1)}%</small>
              </span>
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
