import { ArrowLeft, BarChart3, Brain, Clock3, History, Layers3, ScrollText, Settings, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { sectionMeta } from "../types/navigation";
import type { SectionId } from "../types/navigation";

type AppShellProps = {
  activeSection: SectionId;
  onSectionChange: (section: SectionId) => void;
  headerBackAction?: {
    label: string;
    onClick: () => void;
  } | null;
  children: ReactNode;
};

const navItems: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
  { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={18} /> },
  { id: "analytics", label: "Inteligencia", icon: <Brain size={18} /> },
  { id: "import", label: "Importacao", icon: <Upload size={18} /> },
  { id: "reports", label: "Relatorios", icon: <Layers3 size={18} /> },
  { id: "history", label: "Historico", icon: <History size={18} /> },
  { id: "audit", label: "Auditoria", icon: <ScrollText size={18} /> },
  { id: "settings", label: "Configuracoes", icon: <Settings size={18} /> },
];

export function AppShell({ activeSection, onSectionChange, headerBackAction, children }: AppShellProps) {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Clock3 size={20} />
          </div>
          <div>
            <strong>Gerenciador de Projetos</strong>
            <span>Analise operacional</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegacao principal">
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
              <h1>{sectionMeta[activeSection].title}</h1>
            )}
            <p>{sectionMeta[activeSection].description}</p>
          </div>
        </header>

        {children}
      </section>
    </main>
  );
}
