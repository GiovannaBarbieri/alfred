import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProjectTimelinePoint } from "../types";
import { formatPeriodBR } from "../utils/date";

type ProjectTimelineChartProps = {
  title: string;
  description: string;
  data: ProjectTimelinePoint[];
};

const colors = ["#2563eb", "#0f766e", "#c2410c", "#7c3aed", "#be123c", "#4d7c0f", "#0369a1", "#a16207"];

export function ProjectTimelineChart({ title, description, data }: ProjectTimelineChartProps) {
  const seriesTotals = useMemo(() => {
    const totals = new Map<string, number>();
    data.forEach((item) => {
      const series = item.series ?? "Total";
      totals.set(series, (totals.get(series) ?? 0) + item.horas);
    });
    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [data]);
  const seriesNames = useMemo(() => seriesTotals.map((item) => item.name), [seriesTotals]);
  const defaultVisibleSeries = useMemo(
    () => (seriesNames.length > 5 ? seriesNames.slice(0, 5) : seriesNames),
    [seriesNames],
  );
  const defaultVisibleSeriesKey = defaultVisibleSeries.join("|");
  const [visibleSeries, setVisibleSeries] = useState<string[]>(defaultVisibleSeries);
  const rowsByPeriod = new Map<string, Record<string, string | number>>();
  const activeSeries = seriesNames.length > 1 ? visibleSeries : seriesNames;

  useEffect(() => {
    setVisibleSeries(defaultVisibleSeries);
  }, [defaultVisibleSeriesKey]);

  data.forEach((item) => {
    const series = item.series ?? "Total";
    const current = rowsByPeriod.get(item.period) ?? { period: item.period, label: formatPeriodBR(item.period) };
    current[series] = item.horas;
    rowsByPeriod.set(item.period, current);
  });

  const chartData = Array.from(rowsByPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));

  function toggleSeries(series: string) {
    setVisibleSeries((current) =>
      current.includes(series) ? current.filter((item) => item !== series) : [...current, series],
    );
  }

  return (
    <section className="panel timeline-chart-panel">
      <div className="panel-heading timeline-chart-heading">
        <BarChart3 size={20} />
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="chart-empty-state">
          <strong>Nenhum dado encontrado</strong>
          <span>Este projeto ainda nao possui registros para montar esta linha do tempo.</span>
        </div>
      ) : (
        <>
          {seriesNames.length > 1 && (
            <div className="chart-series-controls">
              <div className="chart-series-header">
                <strong>Linhas exibidas no grafico</strong>
                <span>Clique nos nomes abaixo para mostrar ou ocultar colaboradores/categorias.</span>
              </div>
              <div className="chart-series-actions">
                <button type="button" onClick={() => setVisibleSeries(seriesNames.slice(0, 5))}>Top 5</button>
                <button type="button" onClick={() => setVisibleSeries(seriesNames)}>Mostrar todas</button>
                <button type="button" onClick={() => setVisibleSeries([])}>Limpar</button>
              </div>
              <div className="chart-series-list" aria-label="Series do grafico">
                {seriesTotals.map((series) => (
                  <button
                    className={visibleSeries.includes(series.name) ? "active" : ""}
                    key={series.name}
                    type="button"
                    onClick={() => toggleSeries(series.name)}
                    title={`${series.name} - ${series.total.toFixed(2)}h`}
                  >
                    <span>{series.name}</span>
                    <small>{series.total.toFixed(2)}h</small>
                  </button>
                ))}
              </div>
              <p className="chart-series-status">
                {visibleSeries.length} de {seriesNames.length} linhas selecionadas.
              </p>
            </div>
          )}
          {activeSeries.length === 0 ? (
            <div className="chart-empty-state compact">
              <strong>Nenhuma serie selecionada</strong>
              <span>Selecione ao menos uma serie para visualizar o grafico.</span>
            </div>
          ) : (
            <div className="chart-wrap project-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 4, right: 16, top: 12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(value) => [`${Number(value).toFixed(2)}h`, "Horas"]}
                    labelFormatter={(_, payload) => formatPeriodBR(String(payload?.[0]?.payload?.period ?? ""))}
                  />
                  {activeSeries.length > 1 && <Legend verticalAlign="bottom" height={32} />}
                  {activeSeries.map((series, index) => (
                    <Line
                      key={series}
                      type="monotone"
                      dataKey={series}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </section>
  );
}
