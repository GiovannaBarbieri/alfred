import { BarChart3, FolderOpen, Scale } from "lucide-react";
import type { ReactNode } from "react";

import type { ReportLandingTabId } from "./reportsConfig";
import { reportLandingTabs } from "./reportsConfig";

type ReportLandingTabsProps = {
  activeTab: ReportLandingTabId;
  projectCount: number;
  onChange: (tab: ReportLandingTabId) => void;
};

export function ReportLandingTabs({ activeTab, projectCount, onChange }: ReportLandingTabsProps) {
  const icons: Record<ReportLandingTabId, ReactNode> = {
    projects: <FolderOpen size={18} />,
    evolution: <BarChart3 size={18} />,
    comparisons: <Scale size={18} />,
  };

  return (
    <section className="report-landing-tabs" aria-label="Organização dos relatórios">
      {reportLandingTabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {icons[tab.id]}
          <span>{tab.label}</span>
          {tab.id === "projects" && <small>({projectCount})</small>}
        </button>
      ))}
    </section>
  );
}
