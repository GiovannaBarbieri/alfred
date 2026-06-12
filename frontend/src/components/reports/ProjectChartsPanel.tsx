import { BarChart3 } from "lucide-react";

import { ProjectTimelineChart } from "../ProjectTimelineChart";
import type { ProjectTimelineCharts } from "../../types";
import { timelineCharts, type TimelineChartId } from "./reportsConfig";

type ProjectChartsPanelProps = {
  selectedChartId: TimelineChartId;
  projectTimelineCharts: ProjectTimelineCharts;
  onSelectedChartChange: (chartId: TimelineChartId) => void;
};

export function ProjectChartsPanel({
  selectedChartId,
  projectTimelineCharts,
  onSelectedChartChange,
}: ProjectChartsPanelProps) {
  const selectedChart = timelineCharts.find((chart) => chart.id === selectedChartId) ?? timelineCharts[0];

  return (
    <>
      <section className="timeline-selector" aria-label="Graficos do projeto">
        {timelineCharts.map((chart) => (
          <button
            className={`timeline-selector-button ${selectedChartId === chart.id ? "active" : ""}`}
            key={chart.id}
            type="button"
            onClick={() => onSelectedChartChange(chart.id)}
          >
            <BarChart3 size={16} />
            <span>{chart.title}</span>
          </button>
        ))}
      </section>

      <ProjectTimelineChart
        title={selectedChart.title}
        description={selectedChart.description}
        data={projectTimelineCharts[selectedChart.id]}
      />
    </>
  );
}
