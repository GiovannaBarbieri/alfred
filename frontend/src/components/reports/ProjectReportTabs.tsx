import type { ProjectTabId } from "./reportsConfig";
import { projectTabs } from "./reportsConfig";
import { BarChart3, BriefcaseBusiness, CheckSquare, ClipboardList, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";

type ProjectReportTabsProps = {
  activeTab: ProjectTabId;
  onChange: (tab: ProjectTabId) => void;
};

export function ProjectReportTabs({ activeTab, onChange }: ProjectReportTabsProps) {
  const icons: Record<ProjectTabId, ReactNode> = {
    executive: <LayoutDashboard size={15} />,
    operational: <BriefcaseBusiness size={15} />,
    charts: <BarChart3 size={15} />,
    pending: <CheckSquare size={15} />,
    tasks: <ClipboardList size={15} />,
  };

  return (
    <section className="project-tabs" aria-label="Navegacao do relatorio do projeto">
      {projectTabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {icons[tab.id]}
          {tab.label}
        </button>
      ))}
    </section>
  );
}
