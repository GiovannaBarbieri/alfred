import { FileSpreadsheet } from "lucide-react";
import { useMemo } from "react";

import { ProjectComparisonChart } from "../ProjectComparisonChart";
import type { ImportSummary, ProjectComparison, SavedProjectComparisonSummary } from "../../types";
import { formatDateBR } from "../../utils/date";
import { projectTitleFromFilename } from "../../utils/project";
import type { ProjectTabId } from "./reportsConfig";

type ProjectComparisonPanelProps = {
  imports: ImportSummary[];
  comparisonSelection: number[];
  projectComparison: ProjectComparison | null;
  isLoadingComparison: boolean;
  comparisonError: string | null;
  savedComparisons: SavedProjectComparisonSummary[];
  isLoadingSavedComparisons: boolean;
  savedComparisonActionId: number | null;
  savedComparisonError: string | null;
  saveComparisonName: string;
  isSavingComparison: boolean;
  comparisonExportUrl: string;
  onClearComparison: () => void;
  onToggleSelection: (importId: number) => void;
  onCompareProjects: () => void;
  onSaveComparisonNameChange: (name: string) => void;
  onSaveComparison: () => void;
  onOpenSavedComparison: (comparisonId: number) => void;
  onDeleteSavedComparison: (comparisonId: number) => void;
  onOpenProject: (importId: number, tab?: ProjectTabId) => void;
};

export function ProjectComparisonPanel({
  imports,
  comparisonSelection,
  projectComparison,
  isLoadingComparison,
  comparisonError,
  savedComparisons,
  isLoadingSavedComparisons,
  savedComparisonActionId,
  savedComparisonError,
  saveComparisonName,
  isSavingComparison,
  comparisonExportUrl,
  onClearComparison,
  onToggleSelection,
  onCompareProjects,
  onSaveComparisonNameChange,
  onSaveComparison,
  onOpenSavedComparison,
  onDeleteSavedComparison,
  onOpenProject,
}: ProjectComparisonPanelProps) {
  const comparisonHighlights = useMemo(() => {
    if (!projectComparison || projectComparison.projects.length === 0) return null;
    const projects = projectComparison.projects;
    const byHours = [...projects].sort((a, b) => b.totalHours - a.totalHours)[0];
    const byPendings = [...projects].sort((a, b) => b.openPendings - a.openPendings)[0];
    const avgHours = projectComparison.summary.totalHours / projects.length;

    return {
      byHours,
      byPendings,
      avgHours: Number.isFinite(avgHours) ? avgHours.toFixed(2) : "0.00",
    };
  }, [projectComparison]);

  return (
    <section className="panel project-comparison-panel">
      <div className="project-comparison-heading">
        <div>
          <span>Comparativo</span>
          <h2>Comparar projetos</h2>
          <p className="muted">Selecione projetos importados para comparar volume, pendencias e concentracao operacional.</p>
        </div>
        <div className="project-comparison-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={onClearComparison}
            disabled={isLoadingComparison || comparisonSelection.length === 0}
          >
            Limpar
          </button>
          <a
            className={`secondary-button ${comparisonSelection.length < 2 ? "disabled-link" : ""}`}
            href={comparisonExportUrl}
            aria-disabled={comparisonSelection.length < 2}
            onClick={(event) => {
              if (comparisonSelection.length < 2) event.preventDefault();
            }}
          >
            <FileSpreadsheet size={16} />
            Exportar Excel
          </a>
          <button
            className="primary-button"
            type="button"
            onClick={onCompareProjects}
            disabled={isLoadingComparison || comparisonSelection.length < 2}
          >
            {isLoadingComparison ? "Comparando..." : "Comparar selecionados"}
          </button>
        </div>
      </div>

      {(savedComparisons.length > 0 || isLoadingSavedComparisons) && (
        <div className="saved-comparison-list">
          <div className="saved-comparison-list-heading">
            <strong>Comparativos salvos</strong>
            <small>{isLoadingSavedComparisons ? "Carregando..." : `${savedComparisons.length} salvo(s)`}</small>
          </div>
          {savedComparisons.map((item) => (
            <article className="saved-comparison-card" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <small>
                  {item.projectsCount} projetos - {item.totalHours}h - {item.openPendings} pendencias
                </small>
              </div>
              <div className="saved-comparison-actions">
                <button
                  className="secondary-button compact"
                  type="button"
                  onClick={() => onOpenSavedComparison(item.id)}
                  disabled={savedComparisonActionId === item.id}
                >
                  Abrir
                </button>
                <button
                  className="secondary-button compact danger"
                  type="button"
                  onClick={() => onDeleteSavedComparison(item.id)}
                  disabled={savedComparisonActionId === item.id}
                >
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="project-comparison-selector" aria-label="Selecionar projetos para comparar">
        {imports.map((item) => (
          <label className="project-comparison-option" key={item.id}>
            <input
              type="checkbox"
              checked={comparisonSelection.includes(item.id)}
              onChange={() => onToggleSelection(item.id)}
            />
            <span>
              <strong>{projectTitleFromFilename(item.filename)}</strong>
              <small>{formatDateBR(item.importedAt)} - {item.totalHours}h</small>
            </span>
          </label>
        ))}
      </div>

      {comparisonError && <p className="error-text">{comparisonError}</p>}
      {savedComparisonError && <p className="error-text">{savedComparisonError}</p>}

      {projectComparison && comparisonHighlights && (
        <div className="project-comparison-results">
          <div className="project-comparison-save-row">
            <input
              aria-label="Nome do comparativo"
              placeholder="Nome do comparativo"
              value={saveComparisonName}
              onChange={(event) => onSaveComparisonNameChange(event.target.value)}
            />
            <button
              className="primary-button"
              type="button"
              onClick={onSaveComparison}
              disabled={isSavingComparison || !saveComparisonName.trim()}
            >
              {isSavingComparison ? "Salvando..." : "Salvar comparativo"}
            </button>
          </div>
          <div className="project-comparison-summary">
            <span><strong>{projectComparison.summary.projectsCount}</strong><small>Projetos</small></span>
            <span><strong>{projectComparison.summary.totalHours}h</strong><small>Horas totais</small></span>
            <span><strong>{comparisonHighlights.avgHours}h</strong><small>Media por projeto</small></span>
            <span><strong>{projectComparison.summary.openPendings}</strong><small>Pendencias abertas</small></span>
            <span><strong>{projectComparison.summary.highAttentionProjects}</strong><small>Alta atencao</small></span>
          </div>
          <div className="project-comparison-insights">
            <span><strong>Maior volume:</strong> {comparisonHighlights.byHours.projectName}</span>
            <span><strong>Mais pendencias:</strong> {comparisonHighlights.byPendings.projectName}</span>
          </div>
          <ProjectComparisonChart projects={projectComparison.projects} />
          <div className="project-comparison-table-wrap">
            <table className="project-comparison-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Horas</th>
                  <th>Registros</th>
                  <th>Colab.</th>
                  <th>Tasks</th>
                  <th>Pendencias</th>
                  <th>Atencao</th>
                  <th>Categoria principal</th>
                  <th>Colaborador principal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectComparison.projects.map((item) => (
                  <tr key={item.importId}>
                    <td>
                      <strong>{item.projectName}</strong>
                      <small>{formatDateBR(item.importedAt)} - {item.status}</small>
                    </td>
                    <td>{item.totalHours}h</td>
                    <td>{item.recordsCount}</td>
                    <td>{item.collaboratorsCount}</td>
                    <td>{item.tasksCount}</td>
                    <td>{item.openPendings} <small>{item.pendingRate}%</small></td>
                    <td>
                      <span className={`attention-badge ${item.attentionLevel}`}>{item.attentionLabel}</span>
                    </td>
                    <td>{item.topCategory} <small>{item.topCategoryPercentage}%</small></td>
                    <td>{item.topCollaborator} <small>{item.topCollaboratorPercentage}%</small></td>
                    <td>
                      <div className="project-comparison-row-actions">
                        <button className="secondary-button compact" type="button" onClick={() => onOpenProject(item.importId)}>
                          Abrir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
