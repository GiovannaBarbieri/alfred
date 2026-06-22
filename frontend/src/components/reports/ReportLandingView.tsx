import { FileSpreadsheet, FolderOpen, Scale } from "lucide-react";

import type {
  ImportSummary,
  ProjectComparison,
  ProjectEvolution,
  ProjectEvolutionOption,
  SavedProjectComparisonSummary,
} from "../../types";
import { ProjectComparisonPanel } from "./ProjectComparisonPanel";
import { ProjectEvolutionPanel } from "./ProjectEvolutionPanel";
import { ReportLandingTabs } from "./ReportLandingTabs";
import { ReportsProjectList } from "./ReportsProjectList";
import type { ProjectTabId, ReportLandingTabId } from "./reportsConfig";

type ReportLandingViewProps = {
  imports: ImportSummary[];
  filteredImports: ImportSummary[];
  projectSearch: string;
  reportLandingTab: ReportLandingTabId;
  evolutionOptions: ProjectEvolutionOption[];
  selectedEvolutionProject: string;
  projectEvolution: ProjectEvolution | null;
  isLoadingEvolution: boolean;
  isLoadingComparison: boolean;
  evolutionError: string | null;
  evolutionExportUrl: string;
  comparisonProjectOptions: ImportSummary[];
  comparisonSelection: number[];
  projectComparison: ProjectComparison | null;
  comparisonError: string | null;
  savedComparisons: SavedProjectComparisonSummary[];
  isLoadingSavedComparisons: boolean;
  savedComparisonActionId: number | null;
  savedComparisonError: string | null;
  saveComparisonName: string;
  isSavingComparison: boolean;
  comparisonExportUrl: string;
  landingCollaboratorsCount: number;
  onLandingTabChange: (tab: ReportLandingTabId) => void;
  onProjectSearchChange: (search: string) => void;
  onOpenProject: (importId: number, tab?: ProjectTabId) => void;
  onSelectedEvolutionProjectChange: (projectName: string) => void;
  onClearEvolution: () => void;
  onLoadEvolution: () => void;
  onCompareEvolutionImports: () => void;
  onClearComparison: () => void;
  onToggleComparisonSelection: (importId: number) => void;
  onCompareProjects: () => void;
  onSaveComparisonNameChange: (name: string) => void;
  onSaveComparison: () => void;
  onOpenSavedComparison: (comparisonId: number) => void;
  onDeleteSavedComparison: (comparisonId: number) => void;
};

export function ReportLandingView({
  imports,
  filteredImports,
  projectSearch,
  reportLandingTab,
  evolutionOptions,
  selectedEvolutionProject,
  projectEvolution,
  isLoadingEvolution,
  isLoadingComparison,
  evolutionError,
  evolutionExportUrl,
  comparisonProjectOptions,
  comparisonSelection,
  projectComparison,
  comparisonError,
  savedComparisons,
  isLoadingSavedComparisons,
  savedComparisonActionId,
  savedComparisonError,
  saveComparisonName,
  isSavingComparison,
  comparisonExportUrl,
  landingCollaboratorsCount,
  onLandingTabChange,
  onProjectSearchChange,
  onOpenProject,
  onSelectedEvolutionProjectChange,
  onClearEvolution,
  onLoadEvolution,
  onCompareEvolutionImports,
  onClearComparison,
  onToggleComparisonSelection,
  onCompareProjects,
  onSaveComparisonNameChange,
  onSaveComparison,
  onOpenSavedComparison,
  onDeleteSavedComparison,
}: ReportLandingViewProps) {
  return (
    <>
      <ReportLandingTabs activeTab={reportLandingTab} projectCount={imports.length} onChange={onLandingTabChange} />

      {reportLandingTab === "evolution" && (
        <ProjectEvolutionPanel
          evolutionOptions={evolutionOptions}
          selectedProject={selectedEvolutionProject}
          projectEvolution={projectEvolution}
          isLoadingEvolution={isLoadingEvolution}
          isLoadingComparison={isLoadingComparison}
          evolutionError={evolutionError}
          evolutionExportUrl={evolutionExportUrl}
          onSelectedProjectChange={onSelectedEvolutionProjectChange}
          onClearEvolution={onClearEvolution}
          onLoadEvolution={onLoadEvolution}
          onOpenProject={onOpenProject}
          onCompareEvolutionImports={onCompareEvolutionImports}
        />
      )}

      {reportLandingTab === "comparisons" && imports.length >= 2 && (
        <ProjectComparisonPanel
          imports={comparisonProjectOptions}
          comparisonSelection={comparisonSelection}
          projectComparison={projectComparison}
          isLoadingComparison={isLoadingComparison}
          comparisonError={comparisonError}
          savedComparisons={savedComparisons}
          isLoadingSavedComparisons={isLoadingSavedComparisons}
          savedComparisonActionId={savedComparisonActionId}
          savedComparisonError={savedComparisonError}
          saveComparisonName={saveComparisonName}
          isSavingComparison={isSavingComparison}
          comparisonExportUrl={comparisonExportUrl}
          onClearComparison={onClearComparison}
          onToggleSelection={onToggleComparisonSelection}
          onCompareProjects={onCompareProjects}
          onSaveComparisonNameChange={onSaveComparisonNameChange}
          onSaveComparison={onSaveComparison}
          onOpenSavedComparison={onOpenSavedComparison}
          onDeleteSavedComparison={onDeleteSavedComparison}
          onOpenProject={onOpenProject}
        />
      )}

      {reportLandingTab === "comparisons" && imports.length < 2 && (
        <section className="panel empty-state-panel report-empty-state-panel">
          <div className="panel-heading">
            <Scale size={20} />
            <h2>Comparativos indisponíveis</h2>
          </div>
          <p className="muted">Importe pelo menos dois projetos para visualizar comparações.</p>
        </section>
      )}

      {reportLandingTab === "projects" && (
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
      )}
    </>
  );
}
