import type { ReportLandingTabId } from "./reportsConfig";
import { reportLandingTabs } from "./reportsConfig";

type ReportLandingTabsProps = {
  activeTab: ReportLandingTabId;
  onChange: (tab: ReportLandingTabId) => void;
};

export function ReportLandingTabs({ activeTab, onChange }: ReportLandingTabsProps) {
  return (
    <section className="report-landing-tabs" aria-label="Organizacao dos relatorios">
      {reportLandingTabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </section>
  );
}
