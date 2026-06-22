import { BarChart3, Clock3, FileSpreadsheet, Search, X } from "lucide-react";

import type { ImportSummary } from "../../types";
import { formatDateTimeBR } from "../../utils/date";
import { projectIdentityFromFilename, projectTitleFromFilename } from "../../utils/project";

type ReportsProjectListProps = {
  imports: ImportSummary[];
  collaboratorCount?: number;
  search: string;
  onSearchChange: (value: string) => void;
  onOpenProject: (importId: number) => void;
};

export function ReportsProjectList({ imports, collaboratorCount, search, onSearchChange, onOpenProject }: ReportsProjectListProps) {
  const projectVersions = imports.reduce<Record<string, ImportSummary[]>>((grouped, item) => {
    const key = projectIdentityFromFilename(item.filename);
    grouped[key] = [...(grouped[key] ?? []), item];
    return grouped;
  }, {});

  Object.values(projectVersions).forEach((items) => {
    items.sort((a, b) => new Date(a.importedAt).getTime() - new Date(b.importedAt).getTime());
  });

  return (
    <section className="panel reports-projects-panel">
      <div className="reports-projects-toolbar">
        <h2>Projetos Importados ({imports.length})</h2>
        <div className="reports-search-box">
          <Search size={16} />
          <input
            aria-label="Buscar projeto"
            placeholder="Buscar por nome ou ID do projeto"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
          {search && (
            <button aria-label="Limpar busca" type="button" onClick={() => onSearchChange("")}>
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      <div className="reports-project-list" aria-label="Projetos importados">
        {imports.map((item) => {
          const sameProjectImports = projectVersions[projectIdentityFromFilename(item.filename)] ?? [];
          const hasVersions = sameProjectImports.length > 1;
          const versionNumber = hasVersions ? sameProjectImports.findIndex((version) => version.id === item.id) + 1 : 0;
          const status = getStatusPresentation(item);
          const alertBadge = getAlertBadge(item.alertRows);

          return (
            <article className={`reports-project-row ${hasVersions ? "has-versions" : ""}`} key={item.id}>
              <div className="reports-project-info">
                <div className="reports-project-title">
                  <span className="reports-project-icon"><FileSpreadsheet size={22} /></span>
                  <div>
                    <strong>
                      {projectTitleFromFilename(item.filename)}
                      {hasVersions && <em>v{versionNumber}</em>}
                    </strong>
                    <small className="reports-project-file">{item.filename}</small>
                  </div>
                </div>
                <div className="reports-project-meta-line">
                  {hasVersions && (
                    <small className="project-version-note">
                      Mesmo projeto com {sameProjectImports.length} importações. Esta é a versão {versionNumber}.
                    </small>
                  )}
                  <small className="reports-project-updated">
                    <Clock3 size={14} />
                    Atualizado em {formatDateTimeBR(item.importedAt)}
                  </small>
                </div>
                <div className="reports-project-metric-line">
                  <strong>{item.totalHours}h</strong>
                  <span>Horas</span>
                  <i aria-hidden="true">•</i>
                  <strong>{item.validRows}</strong>
                  <span>Registros</span>
                  <i aria-hidden="true">•</i>
                  <strong>{typeof collaboratorCount === "number" ? collaboratorCount : "-"}</strong>
                  <span>Colaboradores</span>
                </div>
              </div>

              <div className="reports-project-actions">
                <div className="reports-project-status-group">
                  <span className={`status-badge ${status.className}`}>{status.label}</span>
                  <span className={`alert-status-badge ${alertBadge.className}`}>{alertBadge.label}</span>
                </div>
                <button className="secondary-button compact" type="button" onClick={() => onOpenProject(item.id)}>
                  <BarChart3 size={16} />
                  Visualizar análise
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getAlertBadge(alertRows: number) {
  if (alertRows > 0) {
    return { label: `⚠ ${alertRows} Alertas`, className: "has-alerts" };
  }
  return { label: "✓ Sem alertas", className: "no-alerts" };
}

function getStatusPresentation(item: ImportSummary) {
  const normalized = item.status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (item.alertRows > 0) {
    return { label: "COM ALERTAS", className: "warning" };
  }

  if (normalized.includes("process")) {
    return { label: "PROCESSANDO", className: "processing" };
  }

  if (normalized.includes("conclu")) {
    return { label: "CONCLUÍDO", className: "success" };
  }

  return { label: (item.status || "Não informado").toUpperCase(), className: "neutral" };
}
