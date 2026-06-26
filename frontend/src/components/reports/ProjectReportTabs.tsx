import type { ProjectTabId } from "./reportsConfig";
import { projectTabs } from "./reportsConfig";
import { BarChart3, ClipboardList, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";

type ProjectReportTabsProps = {
  activeTab: ProjectTabId;
  taskCount: number;
  onChange: (tab: ProjectTabId) => void;
};

export function ProjectReportTabs({ activeTab, taskCount, onChange }: ProjectReportTabsProps) {
  const icons: Record<ProjectTabId, ReactNode> = {
    executive: <LayoutDashboard size={18} />,
    charts: <BarChart3 size={18} />,
    tasks: <ClipboardList size={18} />,
  };
  const badges: Partial<Record<ProjectTabId, string>> = {
    executive: "Resumo",
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
          {badges[tab.id] && <small>{badges[tab.id]}</small>}
        </button>
      ))}
    </section>
  );
}
