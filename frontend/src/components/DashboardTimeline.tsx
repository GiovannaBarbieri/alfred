import { BarChart3 } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimelinePoint } from "../types";
import { formatPeriodBR } from "../utils/date";

type DashboardTimelineProps = {
  data: TimelinePoint[];
};

export function DashboardTimeline({ data }: DashboardTimelineProps) {
  const chartData = data.map((point) => ({
    ...point,
    label: formatPeriodBR(point.period),
  }));

  return (
    <section className="workspace-grid dashboard-grid">
      <div className="panel timeline-panel">
        <div className="panel-heading">
          <BarChart3 size={20} />
          <h2>Linha do tempo</h2>
        </div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 4, right: 12, top: 12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip labelFormatter={(_, payload) => formatPeriodBR(String(payload?.[0]?.payload?.period ?? ""))} />
              <Line type="monotone" dataKey="horas" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
