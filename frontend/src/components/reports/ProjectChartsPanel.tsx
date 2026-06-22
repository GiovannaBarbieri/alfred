import { BarChart3, Filter, Flame, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import type { HoursReportItem, ProjectExecutiveSummary, ProjectTimelineCharts, ProjectTimelinePoint } from "../../types";
import { ProjectTimelineChart } from "../ProjectTimelineChart";
import { timelineCharts, type TimelineChartId } from "./reportsConfig";

type ProjectChartsPanelProps = {
  selectedChartId: TimelineChartId;
  projectExecutiveSummary: ProjectExecutiveSummary;
  projectTimelineCharts: ProjectTimelineCharts;
  onSelectedChartChange: (chartId: TimelineChartId) => void;
};

export function ProjectChartsPanel({
  selectedChartId,
  projectExecutiveSummary,
  projectTimelineCharts,
  onSelectedChartChange,
}: ProjectChartsPanelProps) {
  const [periodFilter, setPeriodFilter] = useState("all");
  const [seriesFilter, setSeriesFilter] = useState("");
  const [visualMode, setVisualMode] = useState("linha");
  const selectedChart = timelineCharts.find((chart) => chart.id === selectedChartId) ?? timelineCharts[0];
  const selectedChartData = projectTimelineCharts[selectedChart.id];
  const seriesOptions = useMemo(() => getSeriesOptions(selectedChartData), [selectedChartData]);
  const filteredChartData = useMemo(
    () => filterChartData(selectedChartData, periodFilter, seriesFilter),
    [periodFilter, selectedChartData, seriesFilter],
  );
  const heatmapRows = useMemo(() => buildHeatmap(projectTimelineCharts.dailyByUser), [projectTimelineCharts.dailyByUser]);

  return (
    <>
      <section className="reports-analytics-layout">
        <aside className="panel reports-chart-filters" aria-label="Filtros dos gráficos">
          <div className="reports-chart-filter-title">
            <Filter size={18} />
            <div>
              <h2>Filtros</h2>
              <p className="muted">Refine a leitura do gráfico atual.</p>
            </div>
          </div>

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

          <label>
            <span>Tipo de visualização</span>
            <select value={visualMode} onChange={(event) => setVisualMode(event.target.value)}>
              <option value="linha">Linha</option>
              <option value="analitico">Análise visual</option>
            </select>
          </label>

          <label>
            <span>Cargo</span>
            <select disabled>
              <option>Não disponível neste relatório</option>
            </select>
          </label>

          <label>
            <span>Grupo</span>
            <select disabled>
              <option>Não disponível neste relatório</option>
            </select>
          </label>
        </aside>

        <div className="reports-chart-main">
          <section className="timeline-selector" aria-label="Gráficos do projeto">
            {timelineCharts.map((chart) => (
              <button
                className={`timeline-selector-button ${selectedChartId === chart.id ? "active" : ""}`}
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

      <section className="reports-bi-grid">
        <ProductivityHeatmap rows={heatmapRows} />
        <VisualRanking title="Top colaboradores por horas" items={projectExecutiveSummary.topUsers} />
        <VisualRanking title="Top categorias" items={projectExecutiveSummary.categories} useCategoryChip />
        <VisualRanking title="Top cargos" items={[]} emptyText="Dados de cargo não disponíveis neste relatório atual." />
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
}: {
  rows: Array<{
    collaborator: string;
    days: Array<{ label: string; value: number; intensity: number }>;
  }>;
}) {
  return (
    <section className="panel productivity-heatmap-panel">
      <div className="reports-section-title">
        <Flame size={18} />
        <div>
          <h2>Mapa de calor de produtividade</h2>
          <p className="muted">Concentração de horas por colaborador e dia da semana.</p>
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

function VisualRanking({
  title,
  items,
  useCategoryChip = false,
  emptyText = "Sem dados para exibir.",
}: {
  title: string;
  items: HoursReportItem[];
  useCategoryChip?: boolean;
  emptyText?: string;
}) {
  const maxHours = Math.max(...items.map((item) => item.totalHours), 0);

  return (
    <section className="panel reports-visual-ranking">
      <div className="reports-section-title">
        <Trophy size={18} />
        <h2>{title}</h2>
      </div>
      {items.length === 0 ? (
        <div className="chart-empty-state compact">{emptyText}</div>
      ) : (
        <div className="reports-ranking-list">
          {items.slice(0, 5).map((item) => (
            <div className="reports-ranking-row" key={`${title}-${item.key}`}>
              <div>
                {useCategoryChip ? (
                  <span className={`report-category-chip ${categoryClassName(item.label || item.key)}`}>
                    {item.label || item.key}
                  </span>
                ) : (
                  <strong>{item.label || item.key}</strong>
                )}
                <small>{item.totalHours.toFixed(2)}h</small>
              </div>
              <span className="reports-ranking-track" aria-hidden="true">
                <i style={{ width: `${maxHours > 0 ? Math.max(8, (item.totalHours / maxHours) * 100) : 0}%` }} />
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function categoryClassName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("desenvolvimento")) return "development";
  if (normalized.includes("homologacao")) return "quality";
  if (normalized.includes("definicao")) return "definition";
  if (normalized.includes("acompanhamento")) return "followup";
  if (normalized.includes("impedimento")) return "blocked";
  if (normalized.includes("retrabalho")) return "rework";
  return "neutral";
}
