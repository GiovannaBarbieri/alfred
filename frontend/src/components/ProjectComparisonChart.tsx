import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProjectComparisonItem } from "../types";

type ComparisonMetricId = "hours" | "records" | "pendings";

type ProjectComparisonChartProps = {
  projects: ProjectComparisonItem[];
};

const metrics: Array<{
  id: ComparisonMetricId;
  label: string;
  valueKey: "totalHours" | "recordsCount" | "openPendings";
  color: string;
  suffix: string;
}> = [
  { id: "hours", label: "Horas", valueKey: "totalHours", color: "#2563eb", suffix: "h" },
  { id: "records", label: "Registros", valueKey: "recordsCount", color: "#0f766e", suffix: "" },
  { id: "pendings", label: "Pendencias", valueKey: "openPendings", color: "#c2410c", suffix: "" },
];

function shortProjectName(name: string, index: number) {
  const cleanName = name.trim();
  if (!cleanName) return `Projeto ${index + 1}`;
  return cleanName.length > 24 ? `${cleanName.slice(0, 24)}...` : cleanName;
}

export function ProjectComparisonChart({ projects }: ProjectComparisonChartProps) {
  const [selectedMetricId, setSelectedMetricId] = useState<ComparisonMetricId>("hours");
  const selectedMetric = metrics.find((metric) => metric.id === selectedMetricId) ?? metrics[0];
  const chartData = useMemo(
    () =>
      projects.map((project, index) => ({
        name: shortProjectName(project.projectName, index),
        fullName: project.projectName,
        value: project[selectedMetric.valueKey],
      })),
    [projects, selectedMetric.valueKey],
  );

  return (
    <section className="project-comparison-chart-panel">
      <div className="project-comparison-chart-heading">
        <div>
          <BarChart3 size={18} />
          <strong>Grafico comparativo</strong>
        </div>
        <div className="project-comparison-metric-tabs" aria-label="Metrica do comparativo">
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
      <div className="project-comparison-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 4, right: 16, top: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} minTickGap={12} />
            <YAxis tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(selectedMetric.id === "hours" ? 2 : 0)}${selectedMetric.suffix}`, selectedMetric.label]}
              labelFormatter={(_, payload) => String(payload?.[0]?.payload?.fullName ?? "")}
            />
            <Bar dataKey="value" fill={selectedMetric.color} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
