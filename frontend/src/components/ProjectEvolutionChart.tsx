import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProjectEvolutionPoint } from "../types";
import { formatDateBR } from "../utils/date";

type EvolutionMetricId = "hours" | "pendings" | "records";

type ProjectEvolutionChartProps = {
  points: ProjectEvolutionPoint[];
};

const metrics: Array<{
  id: EvolutionMetricId;
  label: string;
  valueKey: "totalHours" | "openPendings" | "recordsCount";
  color: string;
  suffix: string;
}> = [
  { id: "hours", label: "Horas", valueKey: "totalHours", color: "#2563eb", suffix: "h" },
  { id: "pendings", label: "Pendencias", valueKey: "openPendings", color: "#c2410c", suffix: "" },
  { id: "records", label: "Registros", valueKey: "recordsCount", color: "#0f766e", suffix: "" },
];

export function ProjectEvolutionChart({ points }: ProjectEvolutionChartProps) {
  const [selectedMetricId, setSelectedMetricId] = useState<EvolutionMetricId>("pendings");
  const selectedMetric = metrics.find((metric) => metric.id === selectedMetricId) ?? metrics[0];
  const chartData = useMemo(
    () =>
      points.map((point, index) => ({
        label: `${index + 1}a`,
        importedAt: formatDateBR(point.importedAt),
        value: point[selectedMetric.valueKey],
      })),
    [points, selectedMetric.valueKey],
  );

  return (
    <section className="project-evolution-chart-panel">
      <div className="project-evolution-chart-heading">
        <div>
          <BarChart3 size={18} />
          <strong>Linha do tempo das importações</strong>
        </div>
        <div className="project-evolution-metric-tabs" aria-label="Métrica da evolução">
          {metrics.map((metric) => (
            <button
              className={metric.id === selectedMetricId ? "active" : ""}
              key={metric.id}
              type="button"
              onClick={() => setSelectedMetricId(metric.id)}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>
      <div className="project-evolution-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ left: 4, right: 16, top: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(selectedMetric.id === "hours" ? 2 : 0)}${selectedMetric.suffix}`, selectedMetric.label]}
              labelFormatter={(_, payload) => String(payload?.[0]?.payload?.importedAt ?? "")}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={selectedMetric.color}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
