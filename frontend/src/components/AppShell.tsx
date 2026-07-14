import { ArrowLeft, Layers3, Network, Settings, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { sectionMeta } from "../types/navigation";
import type { SectionId } from "../types/navigation";

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
  children: ReactNode;
};

const navItems: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
  { id: "import", label: "Importação", icon: <Upload size={18} /> },
  { id: "reports", label: "Relatórios", icon: <Layers3 size={18} /> },
  { id: "settings", label: "Configurações", icon: <Settings size={18} /> },
];

export function AppShell({ activeSection, onSectionChange, headerOverride, headerBackAction, children }: AppShellProps) {
  const headerMeta = headerOverride ?? sectionMeta[activeSection];

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
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? "active" : ""}`}
              type="button"
              onClick={() => onSectionChange(item.id)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="page-header">
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
        </header>

        {children}
      </section>
    </main>
  );
}
