import { FileSpreadsheet } from "lucide-react";

import { ProjectEvolutionChart } from "../ProjectEvolutionChart";
import type { ProjectEvolution, ProjectEvolutionOption } from "../../types";
import type { ProjectTabId } from "./reportsConfig";

type ProjectEvolutionPanelProps = {
  evolutionOptions: ProjectEvolutionOption[];
  selectedProject: string;
  projectEvolution: ProjectEvolution | null;
  isLoadingEvolution: boolean;
  isLoadingComparison: boolean;
  evolutionError: string | null;
  evolutionExportUrl: string;
  onSelectedProjectChange: (projectName: string) => void;
  onClearEvolution: () => void;
  onLoadEvolution: () => void;
  onOpenProject: (importId: number, tab?: ProjectTabId) => void;
  onCompareEvolutionImports: () => void;
};

export function ProjectEvolutionPanel({
  evolutionOptions,
  selectedProject,
  projectEvolution,
  isLoadingEvolution,
  isLoadingComparison,
  evolutionError,
  evolutionExportUrl,
  onSelectedProjectChange,
  onClearEvolution,
  onLoadEvolution,
  onOpenProject,
  onCompareEvolutionImports,
}: ProjectEvolutionPanelProps) {
  if (evolutionOptions.length === 0) {
    return (
      <section className="panel empty-state-panel">
        <div className="panel-heading">
          <FileSpreadsheet size={20} />
          <h2>Nenhum projeto com historico</h2>
        </div>
        <p className="muted">Importe o mesmo projeto mais de uma vez para visualizar sua evolucao.</p>
      </section>
    );
  }

  const latestPoint = projectEvolution?.points[projectEvolution.points.length - 1] ?? null;

  return (
    <section className="panel project-evolution-panel">
      <div className="project-evolution-heading">
        <div>
          <span>Evolucao</span>
          <h2>Evolucao do projeto</h2>
          <p className="muted">Acompanhe como horas, registros, pendencias e nivel de atencao mudaram entre importacoes do mesmo projeto.</p>
        </div>
        <div className="project-evolution-controls">
          <select
            aria-label="Selecionar projeto para evolucao"
            value={selectedProject}
            onChange={(event) => {
              onSelectedProjectChange(event.target.value);
              onClearEvolution();
            }}
          >
            {evolutionOptions.map((option) => (
              <option key={option.projectName} value={option.projectName}>
                {option.projectName}
              </option>
            ))}
          </select>
          <button
            className="primary-button"
            type="button"
            onClick={onLoadEvolution}
            disabled={isLoadingEvolution || !selectedProject}
          >
            {isLoadingEvolution ? "Carregando..." : "Analisar evolucao"}
          </button>
          <a
            className={`secondary-button ${!projectEvolution ? "disabled-link" : ""}`}
            href={evolutionExportUrl}
            aria-disabled={!projectEvolution}
            onClick={(event) => {
              if (!projectEvolution) event.preventDefault();
            }}
          >
            <FileSpreadsheet size={16} />
            Exportar Excel
          </a>
        </div>
      </div>
      {evolutionError && <p className="error-text">{evolutionError}</p>}
      {projectEvolution && latestPoint && (
        <div className="project-evolution-results">
          <div className="project-evolution-guided-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => onOpenProject(latestPoint.importId)}
            >
              Ver projeto mais recente
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={onCompareEvolutionImports}
              disabled={isLoadingComparison || projectEvolution.points.length < 2}
            >
              Comparar primeira x ultima
            </button>
          </div>
          <div className="project-evolution-summary">
            <span><strong>{projectEvolution.importsCount}</strong><small>Importacoes</small></span>
            <span><strong>{projectEvolution.summary.hoursDelta >= 0 ? "+" : ""}{projectEvolution.summary.hoursDelta}h</strong><small>Variacao horas</small></span>
            <span><strong>{projectEvolution.summary.recordsDelta >= 0 ? "+" : ""}{projectEvolution.summary.recordsDelta}</strong><small>Variacao registros</small></span>
            <span><strong>{projectEvolution.summary.pendingsDelta >= 0 ? "+" : ""}{projectEvolution.summary.pendingsDelta}</strong><small>Variacao pendencias</small></span>
            <span><strong>{projectEvolution.summary.trendLabel}</strong><small>{projectEvolution.summary.firstAttention} para {projectEvolution.summary.latestAttention}</small></span>
          </div>
          <ProjectEvolutionChart points={projectEvolution.points} />
          <div className="project-evolution-alerts">
            <div className="project-evolution-alerts-heading">
              <strong>Alertas da evolucao</strong>
              <small>{projectEvolution.insights.length} alerta(s)</small>
            </div>
            <div className="project-evolution-alert-list">
              {projectEvolution.insights.map((insight) => (
                <article className={`project-evolution-alert ${insight.priority}`} key={`${insight.source}-${insight.title}`}>
                  <span>{insight.priority}</span>
                  <strong>{insight.title}</strong>
                  <p>{insight.reason}</p>
                  <small>{insight.action}</small>
                  <div className="project-evolution-alert-actions">
                    {insight.source === "consistencia" && (
                      <button
                        className="secondary-button compact"
                        type="button"
                        onClick={onCompareEvolutionImports}
                        disabled={isLoadingComparison}
                      >
                        Comparar importacoes
                      </button>
                    )}
                    {insight.source === "geral" && (
                      <a className="secondary-button compact" href={evolutionExportUrl}>
                        Exportar
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
          <div className="project-evolution-table-wrap">
            <table className="project-evolution-table">
              <thead>
                <tr>
                  <th>Importacao</th>
                  <th>Horas</th>
                  <th>Registros</th>
                  <th>Pendencias</th>
                  <th>Atencao</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectEvolution.points.map((point) => (
                  <tr key={point.importId}>
                    <td>
                      <strong>{new Date(point.importedAt).toLocaleDateString("pt-BR")}</strong>
                      <small>{point.filename}</small>
                    </td>
                    <td>{point.totalHours}h <small>{point.hoursDelta >= 0 ? "+" : ""}{point.hoursDelta}h</small></td>
                    <td>{point.recordsCount} <small>{point.recordsDelta >= 0 ? "+" : ""}{point.recordsDelta}</small></td>
                    <td>{point.openPendings} <small>{point.pendingsDelta >= 0 ? "+" : ""}{point.pendingsDelta}</small></td>
                    <td><span className={`attention-badge ${point.attentionLevel}`}>{point.attentionLabel}</span></td>
                    <td>
                      <button className="secondary-button compact" type="button" onClick={() => onOpenProject(point.importId)}>
                        Abrir
                      </button>
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
