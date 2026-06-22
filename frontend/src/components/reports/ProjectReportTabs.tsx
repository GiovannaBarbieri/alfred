import type { ProjectTabId } from "./reportsConfig";
import { projectTabs } from "./reportsConfig";
import { BarChart3, ClipboardList, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";

type ProjectReportTabsProps = {
  activeTab: ProjectTabId;
  chartCount: number;
  taskCount: number;
  onChange: (tab: ProjectTabId) => void;
};

export function ProjectReportTabs({ activeTab, chartCount, taskCount, onChange }: ProjectReportTabsProps) {
  const icons: Record<ProjectTabId, ReactNode> = {
    executive: <LayoutDashboard size={18} />,
    charts: <BarChart3 size={18} />,
    tasks: <ClipboardList size={18} />,
  };
  const badges: Record<ProjectTabId, string> = {
    executive: "Resumo",
    charts: String(chartCount),
    tasks: String(taskCount),
  };

  return (
    <section className="project-tabs" aria-label="Navegação do relatório do projeto">
      {projectTabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {icons[tab.id]}
          <span>{tab.label}</span>
          <small>{badges[tab.id]}</small>
        </button>
      ))}
    </section>
  );
}
