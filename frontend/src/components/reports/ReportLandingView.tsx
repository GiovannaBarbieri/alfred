import { FileSpreadsheet, FolderOpen } from "lucide-react";

import type { ImportSummary } from "../../types";
import { ReportsProjectList } from "./ReportsProjectList";
import type { ProjectTabId } from "./reportsConfig";

type ReportLandingViewProps = {
  imports: ImportSummary[];
  filteredImports: ImportSummary[];
  projectSearch: string;
  landingCollaboratorsCount: number;
  onProjectSearchChange: (search: string) => void;
  onOpenProject: (importId: number, tab?: ProjectTabId) => void;
};

export function ReportLandingView({
  imports,
  filteredImports,
  projectSearch,
  landingCollaboratorsCount,
  onProjectSearchChange,
  onOpenProject,
}: ReportLandingViewProps) {
  return (
    <>
      <ReportsProjectList
        imports={filteredImports}
        collaboratorCount={imports.length === 1 ? landingCollaboratorsCount : undefined}
        search={projectSearch}
        onSearchChange={onProjectSearchChange}
        onOpenProject={(importId) => onOpenProject(importId)}
      />

      {filteredImports.length === 0 && imports.length > 0 && (
        <section className="panel empty-state-panel report-empty-state-panel">
          <div className="panel-heading">
            <FileSpreadsheet size={20} />
            <h2>Nenhum projeto encontrado</h2>
          </div>
          <p className="muted">Tente buscar por outro trecho do nome do projeto.</p>
        </section>
      )}

      {imports.length === 0 && (
        <section className="panel empty-state-panel report-empty-state-panel">
          <div className="panel-heading">
            <FolderOpen size={20} />
            <h2>Nenhum projeto importado</h2>
          </div>
          <p className="muted">Importe um arquivo para começar suas análises.</p>
        </section>
      )}
    </>
  );
}
