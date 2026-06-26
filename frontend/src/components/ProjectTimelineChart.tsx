import { BarChart3 } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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
  seriesSummaryTitle?: string;
  timelineControl?: ReactNode;
};

type SeriesLimitOption = "top5" | "top10" | "all" | "custom";

const colors = ["#2563eb", "#0f766e", "#c2410c", "#7c3aed", "#be123c", "#4d7c0f", "#0369a1", "#a16207"];

export function ProjectTimelineChart({
  title,
  description,
  data,
  seriesSummaryTitle = "Top series",
  timelineControl,
}: ProjectTimelineChartProps) {
  const [seriesLimit, setSeriesLimit] = useState<SeriesLimitOption>("top5");
  const [customSeries, setCustomSeries] = useState<string[]>([]);

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
  const topFiveSeries = useMemo(() => seriesNames.slice(0, 5), [seriesNames]);
  const activeSeries = useMemo(() => {
    if (seriesNames.length <= 1) return seriesNames;
    if (seriesLimit === "all") return seriesNames;
    if (seriesLimit === "top10") return seriesNames.slice(0, 10);
    if (seriesLimit === "custom") return customSeries.filter((series) => seriesNames.includes(series));
    return topFiveSeries;
  }, [customSeries, seriesLimit, seriesNames, topFiveSeries]);

  const chartData = useMemo(() => {
    const rowsByPeriod = new Map<string, Record<string, string | number>>();
    data.forEach((item) => {
      const series = item.series ?? "Total";
      const current = rowsByPeriod.get(item.period) ?? { period: item.period, label: formatPeriodBR(item.period) };
      current[series] = item.horas;
      rowsByPeriod.set(item.period, current);
    });
    return Array.from(rowsByPeriod.values()).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  }, [data]);

  const activeSeriesDetails = useMemo(
    () => activeSeries
      .map((series) => seriesTotals.find((item) => item.name === series))
      .filter((item): item is { name: string; total: number } => Boolean(item)),
    [activeSeries, seriesTotals],
  );

  const visibleValues = useMemo(() => {
    return data
      .filter((item) => activeSeries.includes(item.series ?? "Total"))
      .map((item) => item.horas)
      .filter((value) => value > 0);
  }, [activeSeries, data]);

  const averageValue = visibleValues.length > 0
    ? visibleValues.reduce((sum, value) => sum + value, 0) / visibleValues.length
    : 0;

  useEffect(() => {
    setSeriesLimit("top5");
    setCustomSeries(topFiveSeries);
  }, [title, topFiveSeries]);

  function handleSeriesLimitChange(value: SeriesLimitOption) {
    if (value === "custom" && customSeries.length === 0) {
      setCustomSeries(topFiveSeries);
    }
    setSeriesLimit(value);
  }

  function toggleCustomSeries(series: string) {
    setCustomSeries((current) => {
      if (current.includes(series)) {
        return current.length === 1 ? current : current.filter((item) => item !== series);
      }
      return [...current, series];
    });
  }

  return (
    <section className="panel timeline-chart-panel">
      <div className="panel-heading timeline-chart-heading">
        <BarChart3 size={20} />
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {timelineControl}
      </div>

      {chartData.length === 0 ? (
        <div className="chart-empty-state">
          <strong>Nenhum dado encontrado</strong>
          <span>Este projeto ainda não possui registros para montar esta linha do tempo.</span>
        </div>
      ) : (
        <>
          {seriesNames.length > 1 && (
            <div className="chart-series-executive">
              <label className="chart-series-limit">
                <span>Exibindo</span>
                <select value={seriesLimit} onChange={(event) => handleSeriesLimitChange(event.target.value as SeriesLimitOption)}>
                  <option value="top5">Top 5</option>
                  <option value="top10">Top 10</option>
                  <option value="all">Todos</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>
            </div>
          )}

          {seriesNames.length > 1 && (
            <div className="chart-series-rank-strip" aria-label={seriesSummaryTitle}>
              {activeSeriesDetails.map((series, index) => (
                <span className="chart-series-rank-card" key={series.name}>
                  <i style={{ background: colors[index % colors.length] }} />
                  <strong>{index + 1}º {series.name}</strong>
                  <small>{series.total.toFixed(2)}h</small>
                </span>
              ))}
            </div>
          )}

          {seriesLimit === "custom" && seriesNames.length > 1 && (
            <div className="chart-series-custom-list" aria-label="Selecao personalizada">
              {seriesTotals.map((series) => (
                <label key={series.name}>
                  <input
                    type="checkbox"
                    checked={activeSeries.includes(series.name)}
                    onChange={() => toggleCustomSeries(series.name)}
                  />
                  <span>{series.name}</span>
                  <strong>{series.total.toFixed(2)}h</strong>
                </label>
              ))}
            </div>
          )}

          <div className="chart-wrap project-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 4, right: 16, top: 12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value) => {
                    const hours = Number(value);
                    const difference = hours - averageValue;
                    const variation = averageValue > 0 ? (difference / averageValue) * 100 : 0;
                    const signal = difference >= 0 ? "+" : "";
                    return [
                      `${hours.toFixed(2)}h | média ${averageValue.toFixed(2)}h | ${signal}${difference.toFixed(2)}h (${signal}${variation.toFixed(1)}%)`,
                      "Horas",
                    ];
                  }}
                  labelFormatter={(_, payload) => formatPeriodBR(String(payload?.[0]?.payload?.period ?? ""))}
                />
                {averageValue > 0 && (
                  <ReferenceLine
                    y={averageValue}
                    stroke="#94a3b8"
                    strokeDasharray="6 4"
                    label={{ value: "Média do período", position: "insideTopRight", fill: "#64748b", fontSize: 12 }}
                  />
                )}
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
        </>
      )}
    </section>
  );
}
