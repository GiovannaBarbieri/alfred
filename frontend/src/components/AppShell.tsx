import { ArrowLeft, Boxes, ChevronDown, FileBarChart, Files, FolderKanban, FolderOpen, Gauge, ListChecks, Network, Scale, Settings, SlidersHorizontal, Upload } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  analysisReportActiveItem,
  projectModuleActiveItem,
  sectionMeta,
} from "../types/navigation";
import type { SectionId } from "../types/navigation";
import {
  navigationGroupForSection,
  toggleNavigationGroup,
  type NavigationGroupId,
} from "../utils/navigationAccordion";

type AppShellProps = {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  headerOverride?: {
    title: string;
    description: string;
  } | null;
  headerBackAction?: {
    label: string;
    onClick: () => void;
  } | null;
  hideHeader?: boolean;
  children: ReactNode;
};

const analysisReportItems: Array<{ id: "import" | "general-indicators" | "my-reports" | "report-comparison"; label: string; icon: ReactNode }> = [
  { id: "import", label: "Projetos", icon: <FolderKanban size={17} /> },
  { id: "general-indicators", label: "Indicadores Gerais", icon: <Gauge size={17} /> },
  { id: "my-reports", label: "Meus Relatórios", icon: <Files size={17} /> },
  { id: "report-comparison", label: "Comparação de Relatórios", icon: <Scale size={17} /> },
];

export function AppShell({ activeSection, onSectionChange, headerOverride, headerBackAction, hideHeader = false, children }: AppShellProps) {
  const headerMeta = headerOverride ?? sectionMeta[activeSection];
  const analysisActiveItem = analysisReportActiveItem(activeSection);
  const projectActiveItem = projectModuleActiveItem(activeSection);
  const [expandedGroup, setExpandedGroup] = useState<NavigationGroupId | null>(
    () => navigationGroupForSection(activeSection),
  );
  const analysisExpanded = expandedGroup === "reports";
  const settingsExpanded = expandedGroup === "settings";

  useEffect(() => {
    const activeGroup = navigationGroupForSection(activeSection);
    if (activeGroup) setExpandedGroup(activeGroup);
  }, [activeSection]);

  function toggleGroup(group: NavigationGroupId) {
    setExpandedGroup((current) => toggleNavigationGroup(current, group));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Network size={20} />
          </div>
          <div>
            <strong>ADVISE</strong>
            <span>Gerenciador de horas</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegação principal">
          <div className="nav-group">
            <button
              className="nav-item nav-group-trigger"
              type="button"
              aria-expanded={analysisExpanded}
              aria-controls="analysis-reports-navigation"
              onClick={() => toggleGroup("reports")}
            >
              <FileBarChart size={18} />
              <span>Relatórios</span>
              <ChevronDown className="nav-group-chevron" size={16} />
            </button>
            <div
              className="nav-submenu"
              id="analysis-reports-navigation"
              aria-hidden={!analysisExpanded}
            >
              <div className="nav-submenu-inner">
                {analysisReportItems.map((item) => (
                  <button
                    key={item.id}
                    className={`nav-subitem ${analysisActiveItem === item.id ? "active" : ""}`}
                    type="button"
                    tabIndex={analysisExpanded ? 0 : -1}
                    aria-current={analysisActiveItem === item.id ? "page" : undefined}
                    onClick={() => onSectionChange(item.id)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="nav-group">
            <button
              className="nav-item nav-group-trigger"
              type="button"
              aria-expanded={settingsExpanded}
              aria-controls="settings-navigation"
              onClick={() => toggleGroup("settings")}
            >
              <Settings size={18} />
              <span>Configurações</span>
              <ChevronDown className="nav-group-chevron" size={16} />
            </button>
            <div
              className="nav-submenu"
              id="settings-navigation"
              aria-hidden={!settingsExpanded}
            >
              <div className="nav-submenu-inner">
                <button
                  className={`nav-subitem ${activeSection === "settings" ? "active" : ""}`}
                  type="button"
                  tabIndex={settingsExpanded ? 0 : -1}
                  aria-current={activeSection === "settings" ? "page" : undefined}
                  onClick={() => onSectionChange("settings")}
                >
                  <ListChecks size={17} />
                  <span>Configurações gerais</span>
                </button>
                <button
                  className={`nav-subitem ${activeSection === "distribution-weights" ? "active" : ""}`}
                  type="button"
                  tabIndex={settingsExpanded ? 0 : -1}
                  aria-current={activeSection === "distribution-weights" ? "page" : undefined}
                  onClick={() => onSectionChange("distribution-weights")}
                >
                  <SlidersHorizontal size={17} />
                  <span>Distribuição das categorias</span>
                </button>
                <button
                  className={`nav-subitem ${activeSection === "indicator-modules" ? "active" : ""}`}
                  type="button"
                  tabIndex={settingsExpanded ? 0 : -1}
                  aria-current={activeSection === "indicator-modules" ? "page" : undefined}
                  onClick={() => onSectionChange("indicator-modules")}
                >
                  <Boxes size={17} />
                  <span>Módulos</span>
                </button>
              </div>
            </div>
          </div>
        </nav>
      </aside>

      <section className="content">
        {!hideHeader && <header className="page-header">
          <div>
            {headerBackAction ? (
              <button className="page-title-back" type="button" onClick={headerBackAction.onClick}>
                <ArrowLeft size={24} />
                {headerBackAction.label}
              </button>
            ) : (
              <h1>{headerMeta.title}</h1>
            )}
            <p>{headerMeta.description}</p>
          </div>
        </header>}

        {projectActiveItem && (
          <nav className="project-module-navigation" aria-label="Navegação do módulo Projetos">
            <button
              className={projectActiveItem === "import" ? "active" : ""}
              type="button"
              aria-current={projectActiveItem === "import" ? "page" : undefined}
              onClick={() => onSectionChange("import")}
            >
              <Upload size={16} />
              Importação
            </button>
            <button
              className={projectActiveItem === "reports" ? "active" : ""}
              type="button"
              aria-current={projectActiveItem === "reports" ? "page" : undefined}
              onClick={() => onSectionChange("reports")}
            >
              <FolderOpen size={16} />
              Relatórios de projetos
            </button>
          </nav>
        )}

        {children}
      </section>
    </main>
  );
}
